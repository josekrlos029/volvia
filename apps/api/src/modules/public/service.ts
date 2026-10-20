import {
  type Database,
  and,
  customerCards,
  customers,
  eq,
  locations,
  organizations,
  rewardGrants,
  rewards,
  stampCards,
} from '@volvia/db'
import {
  type PublicCardState,
  cardMessagesSchema,
  googleMapsUrl,
  googleReviewUrl,
  orgSettingsSchema,
  pickCardMessage,
  renderCampaignText,
} from '@volvia/shared'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { orgHour } from '../../lib/time'
import { resolveOfferWords } from '../engagement/offer-words'
import { loadLiveOffer } from '../engagement/offers'
import { loadPageSections } from '../page/service'
import { pickPendingSurvey } from './surveys'

/**
 * Everything the customer-facing card needs, in one query set.
 *
 * This is the hottest read in the product — every wallet refresh and every page open
 * hits it — so it is deliberately shaped to be cacheable and free of joins per reward.
 */
export async function loadPublicCardState(db: Database, token: string): Promise<PublicCardState> {
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
  if (row.customerCard.status === 'deleted' || row.org.deletedAt) {
    throw new AppError('CUSTOMER_CARD_NOT_FOUND', { message: 'card not found' })
  }

  const [cardRewards, orgLocations, pendingGrants, liveOffer] = await Promise.all([
    db.select().from(rewards).where(eq(rewards.cardId, row.card.id)).orderBy(rewards.atStamp),
    db
      .select({
        name: locations.name,
        address: locations.address,
        googlePlaceId: locations.googlePlaceId,
      })
      .from(locations)
      .where(and(eq(locations.orgId, row.org.id), eq(locations.isActive, true))),
    db
      .select()
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.customerCardId, row.customerCard.id),
          eq(rewardGrants.status, 'pending'),
        ),
      )
      .orderBy(rewardGrants.grantedAt),
    // This customer's own offer, already filtered to the campaign's weekday/hour
    // window — a happy-hour banner showing at 9am would be worse than no banner.
    loadLiveOffer(db, { customerCardId: row.customerCard.id, timezone: row.org.timezone }),
  ])
  const offerWords = liveOffer ? await resolveOfferWords(db, liveOffer) : null

  const nextReward =
    cardRewards.find((reward) => reward.atStamp > row.customerCard.stampsCount) ?? null

  const campaignContext = {
    name: row.customer.firstName,
    business: row.org.name,
    stamps: row.customerCard.stampsCount,
    remaining: nextReward ? nextReward.atStamp - row.customerCard.stampsCount : 0,
    hour: orgHour(new Date(), row.org.timezone),
  }

  const pendingSurvey = await pickPendingSurvey(db, {
    orgId: row.org.id,
    cardId: row.card.id,
    customerCardId: row.customerCard.id,
    stampsCount: row.customerCard.stampsCount,
  })

  return {
    token: row.customerCard.token,
    business: {
      name: row.org.name,
      slug: row.org.slug,
      logoUrl: row.org.logoUrl,
      locations: orgLocations.map((location) => ({
        name: location.name,
        address: location.address,
        mapsUrl: googleMapsUrl(location.googlePlaceId),
      })),
    },
    card: {
      id: row.card.id,
      name: row.card.name,
      stampsRequired: row.card.stampsRequired,
      design: row.card.design as unknown as Record<string, unknown>,
      terms: row.card.terms,
    },
    stampsCount: row.customerCard.stampsCount,
    cycleIndex: row.customerCard.cycleIndex,
    nextReward: nextReward
      ? {
          atStamp: nextReward.atStamp,
          title: nextReward.title,
          description: nextReward.description,
        }
      : null,
    rewards: cardRewards.map((reward) => ({
      atStamp: reward.atStamp,
      title: reward.title,
      description: reward.description,
    })),
    pendingRewards: pendingGrants.map((grant) => ({
      grantId: grant.id,
      title: grant.title,
      description: grant.description,
      code: grant.code,
      expiresAt: grant.expiresAt,
    })),
    activeOffer:
      liveOffer && offerWords
        ? {
            // Placeholders resolve against this customer, not an average one.
            title: renderCampaignText(offerWords.headline, campaignContext),
            description: renderCampaignText(offerWords.body, campaignContext),
            endsAt: liveOffer.endsAt,
            headerLabel: liveOffer.passOverride.header,
            bannerUrl:
              liveOffer.passOverride.banner?.kind === 'image'
                ? liveOffer.passOverride.banner.url
                : null,
            bannerPreset:
              liveOffer.passOverride.banner?.kind === 'preset'
                ? liveOffer.passOverride.banner.value
                : null,
            hideStamps: liveOffer.passOverride.stampStyle === 'hidden',
            stampStyle:
              liveOffer.passOverride.stampStyle && liveOffer.passOverride.stampStyle !== 'hidden'
                ? liveOffer.passOverride.stampStyle
                : null,
            endsOnFirstStamp: liveOffer.passOverride.endsOnFirstStamp,
          }
        : null,
    walletPasses: {
      appleUrl: `${env.API_URL}/wallet/apple/pass/${row.customerCard.token}`,
      googleUrl: `${env.API_URL}/wallet/google/save/${row.customerCard.token}`,
    },
    lastStampAt: row.customerCard.lastStampAt,
    message: pickCardMessage(
      cardMessagesSchema.parse(row.card.messages ?? {}),
      row.customerCard.stampsCount,
    ),
    pendingSurvey,
  }
}

/** The link-in-bio style public page for a business. */
export async function loadBusinessPage(db: Database, slug: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1)

  if (!org || org.deletedAt) throw new AppError('NOT_FOUND', { message: 'business not found' })

  const [activeCards, orgLocations] = await Promise.all([
    db
      .select({
        id: stampCards.id,
        name: stampCards.name,
        joinSlug: stampCards.joinSlug,
        stampsRequired: stampCards.stampsRequired,
        design: stampCards.design,
      })
      .from(stampCards)
      .where(and(eq(stampCards.orgId, org.id), eq(stampCards.status, 'active'))),
    db
      .select()
      .from(locations)
      .where(and(eq(locations.orgId, org.id), eq(locations.isActive, true))),
  ])

  const cardIds = activeCards.map((card) => card.id)
  const [rewardRows, sections] = await Promise.all([
    cardIds.length > 0 ? db.select().from(rewards).where(eq(rewards.orgId, org.id)) : [],
    loadPageSections(db, org.id, { activeOnly: true }),
  ])
  const settings = orgSettingsSchema.parse(org.settings ?? {})

  return {
    business: {
      name: org.name,
      slug: org.slug,
      tagline: org.tagline,
      about: org.about,
      category: org.category,
      locale: org.locale,
      currency: org.currency,
      logoUrl: org.logoUrl,
      coverUrl: org.coverUrl,
      brandColor: org.brandColor,
      /** The page's own accent, or the brand colour when none was picked. */
      accentColor: settings.pageAccentColor ?? org.brandColor,
      socialLinks: org.socialLinks,
      contactPhone: org.contactPhone,
      /** Empty when the business kept the default wording. */
      ctaLabel: settings.pageCtaLabel,
      wifi: settings.guestWifi,
      reservationsUrl: settings.reservationsUrl || null,
      showReviews: settings.pageShowReviews,
      /**
       * Who is responsible for the customer's data. Shown on the business's own privacy
       * notice: the customer gave their email to this shop, not to Volvia, and the
       * notice has to say so in the shop's name.
       */
      legal: {
        name: String(org.settings?.legalName ?? '') || org.name,
        taxId: String(org.settings?.taxId ?? ''),
        address: String(org.settings?.legalAddress ?? ''),
        email: String(org.settings?.privacyEmail ?? '') || org.contactEmail || '',
      },
      googleReviewUrl: googleReviewUrl(org.googlePlaceId),
    },
    locations: orgLocations.map((location) => ({
      name: location.name,
      address: location.address,
      city: location.city,
      phone: location.phone,
      hours: location.hours,
      mapsUrl: googleMapsUrl(location.googlePlaceId),
    })),
    cards: activeCards.map((card) => ({
      name: card.name,
      stampsRequired: card.stampsRequired,
      design: card.design,
      joinUrl: `${env.PASS_URL}/j/${card.joinSlug}`,
      rewards: rewardRows
        .filter((reward) => reward.cardId === card.id)
        .sort((a, b) => a.atStamp - b.atStamp)
        .map((reward) => ({ atStamp: reward.atStamp, title: reward.title })),
    })),
    /** What the business chose to show: the menu, products, services, work, news, events. */
    modules: (Object.entries(sections) as Array<[string, (typeof sections)['menu']]>)
      .filter(([, list]) => list.some((section) => section.items.length > 0))
      .map(([kind, list]) => ({
        kind,
        sections: list
          .filter((section) => section.items.length > 0)
          .map((section) => ({
            id: section.id,
            title: section.title,
            description: section.description,
            items: section.items.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              priceAmount: item.priceAmount,
              imageUrl: item.imageUrl,
              durationMinutes: item.durationMinutes,
              startsAt: item.startsAt,
              endsAt: item.endsAt,
              publishedAt: item.publishedAt,
              buttonLabel: item.buttonLabel,
              buttonUrl: item.buttonUrl,
              askVia: item.askVia,
            })),
          })),
      })),
  }
}

/** Public view of a card's join page, before the customer signs up. */
export async function loadJoinPage(db: Database, joinSlug: string) {
  const [row] = await db
    .select({ card: stampCards, org: organizations })
    .from(stampCards)
    .innerJoin(organizations, eq(organizations.id, stampCards.orgId))
    .where(eq(stampCards.joinSlug, joinSlug))
    .limit(1)

  if (!row) throw new AppError('CARD_NOT_FOUND', { message: 'card not found' })
  // A business that closed stops taking new customers the same second, even though its
  // cards are still marked active underneath.
  if (row.org.deletedAt || row.card.status !== 'active') {
    throw new AppError('CARD_NOT_ACTIVE', { message: 'this card is not accepting new members' })
  }

  const cardRewards = await db
    .select()
    .from(rewards)
    .where(eq(rewards.cardId, row.card.id))
    .orderBy(rewards.atStamp)

  return {
    business: {
      name: row.org.name,
      slug: row.org.slug,
      logoUrl: row.org.logoUrl,
      tagline: row.org.tagline,
      brandColor: row.org.brandColor,
    },
    card: {
      name: row.card.name,
      stampsRequired: row.card.stampsRequired,
      design: row.card.design,
      terms: row.card.terms,
      collectBirthday: row.card.collectBirthday,
      collectPhone: row.card.collectPhone,
      phoneRequired: row.card.phoneRequired,
      collectDocument: row.card.collectDocument,
      documentRequired: row.card.documentRequired,
      signupQuestionIds: row.card.signupQuestionIds,
    },
    rewards: cardRewards.map((reward) => ({
      atStamp: reward.atStamp,
      title: reward.title,
      description: reward.description,
    })),
    locale: row.org.locale,
  }
}
