import {
  and,
  campaigns,
  customerCards,
  customers,
  eq,
  inArray,
  organizations,
  outbox,
  reviewRequests,
  rewardGrants,
  rewards,
  stampCards,
  walletPasses,
} from '@volvia/db'
import { env } from '../env'
import {
  type Mailer,
  birthdayTemplate,
  rewardReadyTemplate,
  welcomeCustomerTemplate,
} from '../lib/email'
import { OUTBOX_KINDS } from '../lib/outbox'
import { walletPushCounter } from '../plugins/observability'
import type { OutboxHandler, OutboxHandlerContext } from './outbox'
import { patchGooglePass, pushAppleUpdate } from './wallet-push'

/**
 * Outbox handlers.
 *
 * Every one of these must be safe to run twice: the outbox guarantees at-least-once
 * delivery, not exactly-once, and a retry after a partial failure is normal.
 */
export function buildHandlers(deps: { mailer: Mailer }): Record<string, OutboxHandler> {
  return {
    'wallet.update': async (payload, context) => {
      const customerCardId = String(payload.customerCardId)

      const passes = await context.db
        .select()
        .from(walletPasses)
        .where(eq(walletPasses.customerCardId, customerCardId))

      if (passes.length === 0) return

      for (const pass of passes) {
        try {
          if (pass.platform === 'apple') {
            await pushAppleUpdate(context.db, pass.id, context.logger)
          } else {
            await patchGooglePass(context.db, pass.serial, context.logger)
          }
          walletPushCounter.labels(pass.platform, 'ok').inc()
        } catch (error) {
          walletPushCounter.labels(pass.platform, 'failed').inc()
          context.logger.warn({ err: error, platform: pass.platform }, 'wallet push failed')
        }
      }

      // Bumping `updatedAt` is what makes the pass appear in Apple's "changed since"
      // list, so a device that missed the push still picks the update up on its own.
      await context.db
        .update(walletPasses)
        .set({ updatedAt: new Date(), lastPushedAt: new Date() })
        .where(eq(walletPasses.customerCardId, customerCardId))
    },

    'email.send': async (payload, context) => {
      const type = String(payload.type)
      const token = payload.customerCardToken ? String(payload.customerCardToken) : null
      if (!token) return

      const [row] = await context.db
        .select({
          customer: customers,
          card: stampCards,
          org: organizations,
          customerCard: customerCards,
        })
        .from(customerCards)
        .innerJoin(customers, eq(customers.id, customerCards.customerId))
        .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
        .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
        .where(eq(customerCards.token, token))
        .limit(1)

      if (!row) return

      const cardUrl = `${env.PASS_URL}/c/${token}`
      const unsubscribeUrl = `${env.PASS_URL}/c/${token}/preferences`

      if (type === 'customer_welcome') {
        const [finalReward] = await context.db
          .select({ title: rewards.title })
          .from(rewards)
          .where(and(eq(rewards.cardId, row.card.id), eq(rewards.atStamp, row.card.stampsRequired)))
          .limit(1)

        await deps.mailer.send({
          to: row.customer.email,
          template: welcomeCustomerTemplate(row.customer.locale, {
            orgName: row.org.name,
            cardUrl,
            rewardTitle: finalReward?.title ?? '',
          }),
          listUnsubscribeUrl: unsubscribeUrl,
        })
        return
      }

      if (type === 'reward_ready') {
        const [grant] = await context.db
          .select({ title: rewardGrants.title, status: rewardGrants.status })
          .from(rewardGrants)
          .where(eq(rewardGrants.id, String(payload.grantId)))
          .limit(1)

        // The customer may already have claimed it by the time this drains.
        if (!grant || grant.status !== 'pending') return

        await deps.mailer.send({
          to: row.customer.email,
          template: rewardReadyTemplate(row.customer.locale, {
            orgName: row.org.name,
            cardUrl,
            rewardTitle: grant.title,
          }),
          listUnsubscribeUrl: unsubscribeUrl,
        })
        return
      }

      if (type === 'birthday') {
        // Birthday mail is marketing, so consent is required.
        if (!row.customer.marketingConsent) return
        await deps.mailer.send({
          to: row.customer.email,
          template: birthdayTemplate(row.customer.locale, {
            orgName: row.org.name,
            cardUrl,
            offer: String(payload.offer ?? ''),
          }),
          listUnsubscribeUrl: unsubscribeUrl,
        })
      }
    },

    'campaign.start': async (payload, context) => {
      const campaignId = String(payload.campaignId)
      const [campaign] = await context.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1)
      if (!campaign || campaign.status === 'cancelled') return

      const targets = await resolveAudience(context, campaign.orgId, campaign.audience)

      await context.db
        .update(campaigns)
        .set({
          status: 'running',
          startedAt: new Date(),
          stats: { ...campaign.stats, targeted: targets.length },
        })
        .where(eq(campaigns.id, campaignId))

      // One wallet update per affected card, so the offer appears on the pass itself.
      // Chunked: a busy café can have thousands of cardholders, and a single insert
      // of that size would hold a lock far longer than the drain loop expects.
      const CHUNK = 500
      for (let index = 0; index < targets.length; index += CHUNK) {
        const chunk = targets.slice(index, index + CHUNK)
        await context.db.insert(outbox).values(
          chunk.map((customerCardId) => ({
            orgId: campaign.orgId,
            kind: OUTBOX_KINDS.walletUpdate,
            payload: { customerCardId, reason: 'campaign', campaignId },
          })),
        )
      }
    },

    'campaign.end': async (payload, context) => {
      const campaignId = String(payload.campaignId)
      await context.db
        .update(campaigns)
        .set({ status: 'finished', finishedAt: new Date() })
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, 'running')))
    },

    'review.request': async (payload, context) => {
      const customerCardId = String(payload.customerCardId)

      const [row] = await context.db
        .select({ orgId: customerCards.orgId, googlePlaceId: organizations.googlePlaceId })
        .from(customerCards)
        .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
        .where(eq(customerCards.id, customerCardId))
        .limit(1)

      // Only worth recording when the business actually has a Google listing.
      if (!row?.googlePlaceId) return

      await context.db.insert(reviewRequests).values({
        orgId: row.orgId,
        customerCardId,
        trigger: 'after_reward',
      })
    },
  }
}

/** Resolves a campaign or message audience to the customer cards it touches. */
async function resolveAudience(
  context: OutboxHandlerContext,
  orgId: string,
  audience: { segment: string; cardIds: string[]; customerIds: string[]; consentOnly: boolean },
): Promise<string[]> {
  const conditions = [eq(customerCards.orgId, orgId), eq(customerCards.status, 'active')]
  if (audience.cardIds.length > 0) conditions.push(inArray(customerCards.cardId, audience.cardIds))
  if (audience.customerIds.length > 0) {
    conditions.push(inArray(customerCards.customerId, audience.customerIds))
  }

  const rows = await context.db
    .select({ id: customerCards.id, consent: customers.marketingConsent })
    .from(customerCards)
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .where(and(...conditions))

  return rows.filter((row) => !audience.consentOnly || row.consent).map((row) => row.id)
}

export { resolveAudience }
