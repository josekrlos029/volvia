import {
  type Database,
  and,
  campaigns,
  customerCards,
  customers,
  eq,
  gte,
  locations,
  lte,
  organizations,
  rewardGrants,
  rewards,
  sql,
  stampCards,
  walletPasses,
} from '@volvia/db'
import type { CardDesign } from '@volvia/shared'
import {
  type PassContent,
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildPkpass,
  buildSaveUrl,
  generateIcon,
  generateStrip,
} from '@volvia/wallet'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { isWithinActiveHours } from '../../lib/time'
import { derivePassAuthToken } from '../../lib/tokens'
import { walletConfig } from './config'

/** Assembles everything a pass shows, from the customer's current card state. */
export async function loadPassContent(
  db: Database,
  token: string,
): Promise<{ content: PassContent; orgId: string; customerCardId: string }> {
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

  const [cardRewards, pending, activeCampaigns] = await Promise.all([
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
    db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.orgId, row.org.id),
          eq(campaigns.status, 'running'),
          lte(campaigns.startsAt, new Date()),
          gte(campaigns.endsAt, new Date()),
        ),
      ),
  ])

  const design = row.card.design as CardDesign
  const nextReward =
    cardRewards.find((reward) => reward.atStamp > row.customerCard.stampsCount) ??
    cardRewards[cardRewards.length - 1]

  const liveCampaign = activeCampaigns.find((campaign) =>
    isWithinActiveHours(
      new Date(),
      row.org.timezone,
      campaign.activeWeekdays,
      campaign.activeHours,
    ),
  )

  return {
    orgId: row.org.id,
    customerCardId: row.customerCard.id,
    content: {
      serial: row.customerCard.token,
      organizationName: row.org.name,
      cardName: row.card.name,
      stampsCount: row.customerCard.stampsCount,
      stampsRequired: row.card.stampsRequired,
      pendingRewardCount: pending[0]?.value ?? 0,
      rewardTitle: nextReward?.title ?? '',
      rewardDescription: nextReward?.description ?? '',
      terms: row.card.terms,
      logoUrl: design.logoUrl ?? row.org.logoUrl,
      bannerUrl: design.bannerUrl,
      backgroundColor: design.backgroundColor,
      foregroundColor: design.foregroundColor,
      labelColor: design.accentColor,
      cardUrl: `${env.PASS_URL}/c/${row.customerCard.token}`,
      // Locations are attached below only when the business has geocoded them.
      places: [],
      offerMessage: liveCampaign ? liveCampaign.headline : null,
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
    images: {
      'icon.png': generateIcon(29, content.backgroundColor, content.labelColor),
      'icon@2x.png': generateIcon(58, content.backgroundColor, content.labelColor),
      'logo.png': generateIcon(50, content.backgroundColor, content.labelColor),
      'logo@2x.png': generateIcon(100, content.backgroundColor, content.labelColor),
      'strip.png': generateStrip(375, 123, content.backgroundColor),
      'strip@2x.png': generateStrip(750, 246, content.backgroundColor),
    },
    signing: walletConfig.apple.signing!,
  })

  return { buffer, serial: content.serial }
}

export async function issueGoogleSaveUrl(db: Database, token: string): Promise<string> {
  if (walletConfig.mode === 'disabled' || !walletConfig.google.available) {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: 'Google Wallet passes are not configured on this environment',
    })
  }

  const { content, orgId, customerCardId } = await loadPassContent(db, token)
  const config = walletConfig.google.config!

  const loyaltyClass = buildLoyaltyClass(config, {
    orgId,
    organizationName: content.organizationName,
    programLogoUrl: content.logoUrl,
    backgroundColor: content.backgroundColor,
  })
  const loyaltyObject = buildLoyaltyObject(config, content, orgId)

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

/** Attaches a business's geocoded locations so the pass can surface near the shop. */
export async function loadPassPlaces(db: Database, orgId: string) {
  return db
    .select({ name: locations.name, address: locations.address })
    .from(locations)
    .where(and(eq(locations.orgId, orgId), eq(locations.isActive, true)))
}
