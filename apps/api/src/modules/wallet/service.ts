import {
  type Database,
  and,
  customerCards,
  customers,
  desc,
  eq,
  inArray,
  isNull,
  locations,
  messageDeliveries,
  messages,
  organizations,
  rewardGrants,
  rewards,
  sql,
  stampCards,
  walletPasses,
} from '@volvia/db'
import { type CampaignTextContext, type CardDesign, renderCampaignText } from '@volvia/shared'
import {
  type GoogleImageKind,
  type GoogleWalletConfig,
  type PassContent,
  buildAppleImages,
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildPkpass,
  buildSaveUrl,
  imageVersion,
  loadPassArtwork,
  renderGoogleImage,
  upsertLoyaltyClass,
} from '@volvia/wallet'
import type { FastifyBaseLogger } from 'fastify'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { orgHour } from '../../lib/time'
import { derivePassAuthToken } from '../../lib/tokens'
import { resolveOfferWords } from '../engagement/offer-words'
import { loadLiveOffer } from '../engagement/offers'
import { walletConfig } from './config'
import { passLinksFor, pinsOf, primaryPlaceOf } from './pass-details'

/**
 * Assembles everything a pass shows, from the customer's current card state.
 *
 * `textContext` is what the campaign placeholders resolve against for this customer;
 * it is returned so Google Wallet messages can be rendered the same way the pass is.
 */
export async function loadPassContent(
  db: Database,
  token: string,
): Promise<{
  content: PassContent
  orgId: string
  customerCardId: string
  textContext: CampaignTextContext
}> {
  const [row] = await db
    .select({
      customerCard: customerCards,
      card: stampCards,
      org: organizations,
      customer: customers,
    })
    .from(customerCards)
    .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
    .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .where(eq(customerCards.token, token))
    .limit(1)

  if (!row) throw new AppError('CUSTOMER_CARD_NOT_FOUND', { message: 'card not found' })

  const [cardRewards, pending, liveOffer, orgLocations, [latestDelivery]] = await Promise.all([
    db.select().from(rewards).where(eq(rewards.cardId, row.card.id)).orderBy(rewards.atStamp),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.customerCardId, row.customerCard.id),
          eq(rewardGrants.status, 'pending'),
        ),
      ),
    // Only this customer's own offer: a campaign aimed at twenty regulars must not
    // show on every pass of the business.
    loadLiveOffer(db, { customerCardId: row.customerCard.id, timezone: row.org.timezone }),
    loadPassLocations(db, row.org.id),
    // Queued counts too: the iPhone fetches the rebuilt pass the moment the push lands,
    // before the worker has had the chance to mark the delivery as done.
    db
      .select({
        headline: messages.headline,
        body: messages.body,
        sentAt: sql<Date>`coalesce(${messages.scheduledAt}, ${messages.createdAt})`,
      })
      .from(messageDeliveries)
      .innerJoin(messages, eq(messages.id, messageDeliveries.messageId))
      .where(
        and(
          eq(messageDeliveries.customerCardId, row.customerCard.id),
          inArray(messageDeliveries.status, ['queued', 'delivered']),
        ),
      )
      .orderBy(desc(sql`coalesce(${messages.scheduledAt}, ${messages.createdAt})`))
      .limit(1),
  ])

  const design = row.card.design as CardDesign
  const upcoming = cardRewards.find((reward) => reward.atStamp > row.customerCard.stampsCount)
  const nextReward = upcoming ?? cardRewards[cardRewards.length - 1]
  const places = pinsOf(orgLocations)
  const primaryPlace = primaryPlaceOf(orgLocations)

  const offerWords = liveOffer ? await resolveOfferWords(db, liveOffer) : null
  const override = liveOffer?.passOverride

  const textContext: CampaignTextContext = {
    name: row.customer.firstName,
    business: row.org.name,
    stamps: row.customerCard.stampsCount,
    remaining: Math.max(0, row.card.stampsRequired - row.customerCard.stampsCount),
    hour: orgHour(new Date(), row.org.timezone),
  }

  return {
    orgId: row.org.id,
    customerCardId: row.customerCard.id,
    textContext,
    content: {
      serial: row.customerCard.token,
      organizationName: row.org.name,
      cardName: row.card.name,
      stampsCount: row.customerCard.stampsCount,
      stampsRequired: row.card.stampsRequired,
      pendingRewardCount: pending[0]?.value ?? 0,
      rewardPositions: cardRewards.map((reward) => reward.atStamp),
      nextRewardAt: upcoming?.atStamp ?? null,
      cycleIndex: row.customerCard.cycleIndex,
      lastStampAt: row.customerCard.lastStampAt,
      headline: design.headline,
      rewardTitle: nextReward?.title ?? '',
      rewardDescription: nextReward?.description ?? '',
      terms: row.card.terms,
      logoUrl: design.logoUrl ?? row.org.logoUrl,
      bannerUrl: design.bannerUrl,
      backgroundColor: design.backgroundColor,
      foregroundColor: design.foregroundColor,
      labelColor: design.accentColor,
      emptyStampColor: design.emptyStampColor,
      stampIcon: design.stampIcon,
      // A campaign may restyle the stamps for its run; `hidden` is a strip matter.
      stampStyle:
        override?.stampStyle && override.stampStyle !== 'hidden'
          ? override.stampStyle
          : design.stampStyle,
      cardUrl: `${env.PASS_URL}/c/${row.customerCard.token}`,
      places,
      offer:
        liveOffer && offerWords && override
          ? {
              message: renderCampaignText(offerWords.headline, textContext),
              headerLabel: override.header
                ? renderCampaignText(override.header, textContext)
                : null,
              text: override.text ? renderCampaignText(override.text, textContext) : null,
              banner: override.banner,
              hideStamps: override.stampStyle === 'hidden',
              endsAt: liveOffer.endsAt,
            }
          : null,
      latestMessage: latestDelivery
        ? {
            headline: renderCampaignText(latestDelivery.headline, textContext),
            body: renderCampaignText(latestDelivery.body, textContext),
            sentAt: new Date(latestDelivery.sentAt),
          }
        : null,
      customerName: row.customer.firstName.trim(),
      about: row.org.about.trim(),
      links: passLinksFor({
        socialLinks: row.org.socialLinks,
        contactPhone: row.org.contactPhone,
        contactEmail: row.org.contactEmail,
        place: primaryPlace,
        locale: row.customer.locale,
      }),
      place: primaryPlace
        ? { address: primaryPlace.address, city: primaryPlace.city, hours: primaryPlace.hours }
        : null,
      // The card's own picture when it has one; otherwise the business's cover.
      promoImageUrl:
        design.banner.kind === 'image' ? design.banner.url : (row.org.coverUrl ?? null),
      locale: row.customer.locale,
      updatedAt: row.customerCard.updatedAt,
    },
  }
}

function assertAppleAvailable(): void {
  if (walletConfig.mode === 'disabled' || !walletConfig.apple.available) {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: 'Apple Wallet passes are not configured on this environment',
    })
  }
}

/**
 * Builds the signed `.pkpass` and records the pass so update pushes can find it later.
 * The auth token is generated once and only its hash is stored.
 */
export async function issueApplePass(
  db: Database,
  token: string,
): Promise<{ buffer: Buffer; serial: string }> {
  assertAppleAvailable()
  const { content, orgId, customerCardId } = await loadPassContent(db, token)

  // Stable across re-downloads by construction, so a device holding an older copy of
  // the pass keeps authenticating successfully.
  const authenticationToken = derivePassAuthToken(content.serial)

  await db
    .insert(walletPasses)
    .values({
      orgId,
      customerCardId,
      platform: 'apple',
      serial: content.serial,
      installedAt: new Date(),
    })
    .onConflictDoNothing()

  // The strip carries this customer's stamps, so the images are drawn per pass and
  // travel inside it: the iPhone re-downloads the whole archive after each push.
  const artwork = await loadPassArtwork(content)

  const buffer = await buildPkpass({
    content,
    options: {
      passTypeIdentifier: walletConfig.apple.passTypeIdentifier,
      teamIdentifier: walletConfig.apple.teamIdentifier,
      webServiceURL: `${env.API_URL}/wallet/apple`,
      authenticationToken,
      // Shown on the lock screen when the pass updates: the customer knows the shop,
      // not the platform behind it.
      organizationName: content.organizationName,
    },
    images: buildAppleImages(content, artwork),
    signing: walletConfig.apple.signing!,
  })

  return { buffer, serial: content.serial }
}

/**
 * Where Google fetches the pass pictures from. Google caches by URL, so the version
 * fingerprint is part of it: a new stamp or a new palette is a new URL.
 */
export function googleImageUrl(content: PassContent, kind: GoogleImageKind): string {
  return `${env.API_URL}/wallet/google/images/${content.serial}/${kind}.png?v=${imageVersion(content)}`
}

/** The loyalty class for this business, with the pictures it is branded with. */
export function googleClassFor(
  config: GoogleWalletConfig,
  content: PassContent,
  orgId: string,
): Record<string, unknown> {
  return buildLoyaltyClass(config, {
    orgId,
    organizationName: content.organizationName,
    backgroundColor: content.backgroundColor,
    images: {
      wideProgramLogoUrl: googleImageUrl(content, 'lockup'),
      programLogoUrl: googleImageUrl(content, 'logo'),
    },
  })
}

/** The loyalty object for this customer, hero image included. */
export function googleObjectFor(
  config: GoogleWalletConfig,
  content: PassContent,
  orgId: string,
): Record<string, unknown> {
  return buildLoyaltyObject(config, content, orgId, {
    heroImageUrl: googleImageUrl(content, 'hero'),
  })
}

/**
 * One of the pictures a Google pass links to. Public by necessity (Google's servers
 * fetch it), and guarded the same way as the card page: the serial is the card token.
 */
export async function renderGooglePassImage(
  db: Database,
  serial: string,
  kind: GoogleImageKind,
): Promise<Buffer> {
  const { content } = await loadPassContent(db, serial)
  const artwork = await loadPassArtwork(content)
  return renderGoogleImage(kind, content, artwork)
}

/**
 * Pushes the class to Google. The save link carries the class too, but Google only
 * reads it when the class does not exist yet; any later branding change (a new logo,
 * a new accent) has to be written through the API.
 */
export async function syncGoogleClass(
  content: PassContent,
  orgId: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (walletConfig.mode !== 'real' || !walletConfig.google.config) return
  try {
    await upsertLoyaltyClass(
      walletConfig.google.config,
      googleClassFor(walletConfig.google.config, content, orgId),
    )
  } catch (error) {
    // Not fatal for the customer: the object still saves against the class Google has.
    logger.warn({ err: error, orgId }, 'google wallet class sync failed')
  }
}

export async function issueGoogleSaveUrl(
  db: Database,
  token: string,
  logger: FastifyBaseLogger,
): Promise<string> {
  if (walletConfig.mode === 'disabled' || !walletConfig.google.available) {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: 'Google Wallet passes are not configured on this environment',
    })
  }

  const { content, orgId, customerCardId } = await loadPassContent(db, token)
  const config = walletConfig.google.config!

  const loyaltyClass = googleClassFor(config, content, orgId)
  const loyaltyObject = googleObjectFor(config, content, orgId)

  // Keeps an existing class current with the branding the card has today.
  await syncGoogleClass(content, orgId, logger)

  await db
    .insert(walletPasses)
    .values({
      orgId,
      customerCardId,
      platform: 'google',
      serial: content.serial,
      installedAt: new Date(),
    })
    .onConflictDoNothing()

  // The class travels inside the JWT so a brand-new business needs no pre-provisioning.
  return buildSaveUrl(config, { loyaltyObjects: [loyaltyObject], loyaltyClasses: [loyaltyClass] })
}

/**
 * The active branches of the business, oldest first. The pins come from the ones with
 * coordinates (`pinsOf`); the back of the pass describes one of them (`primaryPlaceOf`).
 */
export async function loadPassLocations(db: Database, orgId: string) {
  return db
    .select({
      address: locations.address,
      city: locations.city,
      phone: locations.phone,
      latitude: locations.latitude,
      longitude: locations.longitude,
      hours: locations.hours,
    })
    .from(locations)
    .where(
      and(eq(locations.orgId, orgId), eq(locations.isActive, true), isNull(locations.deletedAt)),
    )
    .orderBy(locations.createdAt)
}
