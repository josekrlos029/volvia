import {
  type Database,
  and,
  campaigns,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  passOffers,
  rewardGrants,
  sql,
} from '@volvia/db'
import type {
  AutomationConfig,
  CampaignOffer,
  CampaignPassOverride,
  PassOfferEndedReason,
  PassOfferSource,
} from '@volvia/db'
import { type CampaignPassOverrideInput, campaignPassOverrideSchema } from '@volvia/shared'
import type { FastifyBaseLogger } from 'fastify'
import { isWithinActiveHours } from '../../lib/time'
import { generateCode } from '../../lib/tokens'
import { applyStamp } from '../loyalty/service'

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

/** What a campaign or a birthday promised one customer, as the pass needs it. */
export interface LiveOffer {
  id: string
  source: PassOfferSource
  campaignId: string | null
  automationId: string | null
  offer: CampaignOffer | AutomationConfig['offer']
  passOverride: CampaignPassOverrideInput
  headline: string
  body: string
  /** The offer's own end, or the campaign's; null only for a campaign with no end. */
  endsAt: Date | null
}

export interface EnrollInput {
  orgId: string
  source: PassOfferSource
  campaignId?: string | null
  automationId?: string | null
  offer: CampaignOffer | AutomationConfig['offer']
  passOverride: CampaignPassOverride | CampaignPassOverrideInput
  customerCardIds: readonly string[]
  expiresAt: Date | null
  startsAt?: Date
}

/**
 * Writes one offer per customer card, in chunks. A card already holding this
 * campaign's offer is left alone, so a retried start never doubles the bonus.
 * Returns the rows actually inserted.
 */
export async function enrollOffers(
  tx: Tx,
  input: EnrollInput,
  chunkSize = 500,
): Promise<Array<{ id: string; customerCardId: string }>> {
  const inserted: Array<{ id: string; customerCardId: string }> = []
  const passOverride = campaignPassOverrideSchema.parse(input.passOverride ?? {})

  for (let index = 0; index < input.customerCardIds.length; index += chunkSize) {
    const chunk = input.customerCardIds.slice(index, index + chunkSize)
    if (chunk.length === 0) continue
    const rows = await tx
      .insert(passOffers)
      .values(
        chunk.map((customerCardId) => ({
          orgId: input.orgId,
          customerCardId,
          source: input.source,
          campaignId: input.campaignId ?? null,
          automationId: input.automationId ?? null,
          offer: input.offer,
          passOverride,
          startsAt: input.startsAt ?? new Date(),
          expiresAt: input.expiresAt,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: passOffers.id, customerCardId: passOffers.customerCardId })
    inserted.push(...rows)
  }
  return inserted
}

/**
 * Hands over what the offer promised: bonus stamps go through `applyStamp` (so the
 * ledger, the analytics and the pass update all happen the normal way), an instant
 * reward becomes a pending grant. `bonus_applied_at` makes a retry a no-op.
 *
 * Runs outside the enrolment transaction: `applyStamp` opens its own and locks the
 * customer card, and holding both at once would only invite deadlocks.
 */
export async function applyOfferBonuses(
  db: Database,
  input: { orgId: string; offerIds: readonly string[]; note: string; logger: FastifyBaseLogger },
): Promise<{ stamps: number; rewards: number }> {
  if (input.offerIds.length === 0) return { stamps: 0, rewards: 0 }

  const rows = await db
    .select({
      id: passOffers.id,
      customerCardId: passOffers.customerCardId,
      offer: passOffers.offer,
      expiresAt: passOffers.expiresAt,
      cardToken: sql<string>`(select token from customer_cards where id = ${passOffers.customerCardId})`,
    })
    .from(passOffers)
    .where(
      and(
        inArray(passOffers.id, [...input.offerIds]),
        isNull(passOffers.bonusAppliedAt),
        isNull(passOffers.endedAt),
      ),
    )

  let stamps = 0
  let rewards = 0

  for (const row of rows) {
    const offer = row.offer
    try {
      if (offer.kind === 'bonus_stamps' && offer.amount && offer.amount > 0) {
        await applyStamp(db, {
          orgId: input.orgId,
          cardToken: row.cardToken,
          count: offer.amount,
          source: 'campaign',
          note: input.note,
          idempotencyKey: `offer:${row.id}`,
        })
        stamps += offer.amount
      } else if (offer.kind === 'instant_reward' && offer.title) {
        await db.insert(rewardGrants).values({
          orgId: input.orgId,
          customerCardId: row.customerCardId,
          rewardId: null,
          title: offer.title,
          description: input.note,
          code: generateCode(),
          cycleIndex: 0,
          expiresAt: row.expiresAt,
        })
        rewards += 1
      }
      await db
        .update(passOffers)
        .set({ bonusAppliedAt: new Date() })
        .where(eq(passOffers.id, row.id))
    } catch (error) {
      // One customer's failure (a blocked card, say) must not stop the rest; the
      // marker stays empty so the next run tries this one again.
      input.logger.warn({ err: error, offerId: row.id }, 'could not apply offer bonus')
    }
  }

  return { stamps, rewards }
}

/**
 * The offer this card should show right now, if any. A campaign offer only counts
 * inside the campaign's weekday/hour window: a happy-hour banner at 9am would be
 * worse than none. The newest offer wins when several overlap.
 */
export async function loadLiveOffer(
  db: Tx,
  input: { customerCardId: string; timezone: string; now?: Date },
): Promise<LiveOffer | null> {
  const now = input.now ?? new Date()
  const rows = await db
    .select({
      id: passOffers.id,
      source: passOffers.source,
      campaignId: passOffers.campaignId,
      automationId: passOffers.automationId,
      offer: passOffers.offer,
      passOverride: passOffers.passOverride,
      expiresAt: passOffers.expiresAt,
      campaign: {
        status: campaigns.status,
        headline: campaigns.headline,
        body: campaigns.body,
        endsAt: campaigns.endsAt,
        activeWeekdays: campaigns.activeWeekdays,
        activeHours: campaigns.activeHours,
      },
    })
    .from(passOffers)
    .leftJoin(campaigns, eq(campaigns.id, passOffers.campaignId))
    .where(
      and(
        eq(passOffers.customerCardId, input.customerCardId),
        isNull(passOffers.endedAt),
        lte(passOffers.startsAt, now),
        or(isNull(passOffers.expiresAt), gt(passOffers.expiresAt, now)),
      ),
    )
    .orderBy(sql`${passOffers.startsAt} desc`)
    .limit(10)

  for (const row of rows) {
    if (row.source === 'campaign') {
      const campaign = row.campaign
      if (!campaign || campaign.status !== 'running') continue
      if (
        !isWithinActiveHours(now, input.timezone, campaign.activeWeekdays, campaign.activeHours)
      ) {
        continue
      }
      return {
        id: row.id,
        source: row.source,
        campaignId: row.campaignId,
        automationId: row.automationId,
        offer: row.offer,
        passOverride: campaignPassOverrideSchema.parse(row.passOverride ?? {}),
        headline: campaign.headline,
        body: campaign.body,
        endsAt: row.expiresAt ?? campaign.endsAt,
      }
    }
    // A birthday offer carries its own words; they are filled in by the caller from
    // the automation config, because the config may be edited after the enrolment.
    return {
      id: row.id,
      source: row.source,
      campaignId: row.campaignId,
      automationId: row.automationId,
      offer: row.offer,
      passOverride: campaignPassOverrideSchema.parse(row.passOverride ?? {}),
      headline: '',
      body: '',
      endsAt: row.expiresAt,
    }
  }
  return null
}

/** The stamp multiplier a live offer grants, or 1 when it grants none. */
export function multiplierFor(offer: LiveOffer | null): number {
  if (!offer) return 1
  if (offer.offer.kind === 'multiplier') return Math.max(1, offer.offer.factor)
  return 1
}

/**
 * The first stamp or redemption closes every offer on this card that asked to end
 * that way. Returns the ids closed, so the caller can count them against the campaign.
 */
export async function endOffersForCard(
  tx: Tx,
  customerCardId: string,
  reason: Extract<PassOfferEndedReason, 'stamp' | 'redeem'>,
): Promise<Array<{ id: string; campaignId: string | null }>> {
  return tx
    .update(passOffers)
    .set({ endedAt: new Date(), endedReason: reason })
    .where(
      and(
        eq(passOffers.customerCardId, customerCardId),
        isNull(passOffers.endedAt),
        sql`coalesce((${passOffers.passOverride} ->> 'endsOnFirstStamp')::boolean, false)`,
      ),
    )
    .returning({ id: passOffers.id, campaignId: passOffers.campaignId })
}

/** Closes every open offer of a campaign; the caller pushes the reverted passes. */
export async function endOffersForCampaign(
  tx: Tx,
  campaignId: string,
  reason: Extract<PassOfferEndedReason, 'campaign_ended' | 'cancelled'>,
): Promise<string[]> {
  const rows = await tx
    .update(passOffers)
    .set({ endedAt: new Date(), endedReason: reason })
    .where(and(eq(passOffers.campaignId, campaignId), isNull(passOffers.endedAt)))
    .returning({ customerCardId: passOffers.customerCardId })
  return rows.map((row) => row.customerCardId)
}

/** Closes offers past their own expiry; returns the cards whose pass must refresh. */
export async function expireOffers(tx: Tx, now = new Date()): Promise<string[]> {
  const rows = await tx
    .update(passOffers)
    .set({ endedAt: now, endedReason: 'expired' })
    .where(and(isNull(passOffers.endedAt), lte(passOffers.expiresAt, now)))
    .returning({ customerCardId: passOffers.customerCardId })
  return [...new Set(rows.map((row) => row.customerCardId))]
}

/** Adds to a campaign's running counters without rewriting the whole jsonb. */
export async function bumpCampaignStats(
  tx: Tx,
  campaignId: string,
  delta: { stamps?: number; redeemed?: number },
): Promise<void> {
  await tx
    .update(campaigns)
    .set({
      stats: sql`jsonb_build_object(
        'targeted', coalesce((${campaigns.stats} ->> 'targeted')::int, 0),
        'delivered', coalesce((${campaigns.stats} ->> 'delivered')::int, 0),
        'redeemed', coalesce((${campaigns.stats} ->> 'redeemed')::int, 0) + ${delta.redeemed ?? 0},
        'stamps', coalesce((${campaigns.stats} ->> 'stamps')::int, 0) + ${delta.stamps ?? 0}
      )`,
    })
    .where(eq(campaigns.id, campaignId))
}
