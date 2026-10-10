import {
  and,
  automations,
  campaigns,
  customerCards,
  customers,
  eq,
  messageDeliveries,
  messages,
  organizations,
  reviewRequests,
  rewardGrants,
  rewards,
  stampCards,
  walletPasses,
} from '@volvia/db'
import { type Audience, audienceSchema, renderCampaignText } from '@volvia/shared'
import { env } from '../env'
import {
  type Mailer,
  birthdayTemplate,
  rewardReadyTemplate,
  welcomeCustomerTemplate,
} from '../lib/email'
import { deferToNotificationHours } from '../lib/notification-hours'
import { OUTBOX_KINDS, enqueue, fanOutWalletUpdates } from '../lib/outbox'
import { visitFrequencyOf } from '../lib/segments'
import { audienceConditions, resolveAudienceDefinition } from '../modules/engagement/audience'
import { settleDelivery } from '../modules/messages/service'
import { walletPushCounter } from '../plugins/observability'
import type { OutboxHandler, OutboxHandlerContext } from './outbox'
import { patchGooglePass, pushAppleUpdate, pushGoogleMessage } from './wallet-push'

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
      const reason = typeof payload.reason === 'string' ? payload.reason : null
      const messageId = reason === 'message' ? String(payload.messageId) : null

      const passes = await context.db
        .select()
        .from(walletPasses)
        .where(eq(walletPasses.customerCardId, customerCardId))

      if (passes.length === 0) {
        // A message to someone without the pass has nowhere to land; say so rather than
        // leaving the delivery queued forever.
        if (messageId) {
          await settleDelivery(context.db, { messageId, customerCardId, status: 'skipped_no_pass' })
        }
        return
      }

      // What Google Wallet shows as a notification: the message, or a campaign that asked
      // for a push. Apple needs nothing here — the rebuilt pass carries the text.
      const notice = await loadNotice(context, payload)

      // Bump `updatedAt` before pushing: the device reacts to the push by asking which
      // serials changed since its last tag, and a pass not yet bumped answers "nothing".
      // It is also what lets a device that missed the push pick the update up on its own.
      await context.db
        .update(walletPasses)
        .set({ updatedAt: new Date() })
        .where(eq(walletPasses.customerCardId, customerCardId))

      let delivered = 0
      let lastError: string | null = null
      for (const pass of passes) {
        try {
          if (pass.platform === 'apple') {
            await pushAppleUpdate(context.db, pass.id, context.logger)
          } else if (notice) {
            await pushGoogleMessage(context.db, pass.serial, notice, context.logger)
          } else {
            await patchGooglePass(context.db, pass.serial, context.logger, {
              refreshClass: reason === 'design',
            })
          }
          walletPushCounter.labels(pass.platform, 'ok').inc()
          delivered += 1
        } catch (error) {
          walletPushCounter.labels(pass.platform, 'failed').inc()
          lastError = error instanceof Error ? error.message : String(error)
          context.logger.warn({ err: error, platform: pass.platform }, 'wallet push failed')
        }
      }

      await context.db
        .update(walletPasses)
        .set({ lastPushedAt: new Date() })
        .where(eq(walletPasses.customerCardId, customerCardId))

      if (messageId) {
        await settleDelivery(context.db, {
          messageId,
          customerCardId,
          status: delivered > 0 ? 'delivered' : 'failed',
          error: delivered > 0 ? null : lastError,
        })
      }
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
        const [finalReward, welcome] = await Promise.all([
          context.db
            .select({ title: rewards.title })
            .from(rewards)
            .where(
              and(eq(rewards.cardId, row.card.id), eq(rewards.atStamp, row.card.stampsRequired)),
            )
            .limit(1)
            .then(([reward]) => reward),
          context.db
            .select({ config: automations.config, isActive: automations.isActive })
            .from(automations)
            .where(and(eq(automations.orgId, row.org.id), eq(automations.type, 'welcome')))
            .limit(1)
            .then(([automation]) => automation),
        ])

        // A business that switched the welcome off means it: send nothing.
        if (welcome && !welcome.isActive) return

        const context_ = {
          name: row.customer.firstName,
          business: row.org.name,
          stamps: 0,
          remaining: row.card.stampsRequired,
          hour: null,
        }

        await deps.mailer.send({
          to: row.customer.email,
          template: welcomeCustomerTemplate(row.customer.locale, {
            orgName: row.org.name,
            cardUrl,
            rewardTitle: finalReward?.title ?? '',
            headline: renderCampaignText(String(welcome?.config?.headline ?? ''), context_),
            body: renderCampaignText(String(welcome?.config?.body ?? ''), context_),
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

      // The offer lands on the phone as a notification, so it waits for the business's
      // notification hours like a message does. The campaign stays scheduled meanwhile.
      const now = new Date()
      const allowedAt = await deferToNotificationHours(context.db, campaign.orgId, now)
      if (allowedAt > now) {
        await enqueue(
          context.db,
          OUTBOX_KINDS.campaignStart,
          { campaignId },
          {
            orgId: campaign.orgId,
            runAt: allowedAt,
          },
        )
        return
      }

      // The audience was written as jsonb, possibly by an older version of the app, so
      // it is validated on the way back out rather than trusted.
      const audience = audienceSchema.parse(campaign.audience)
      const targets = await resolveAudience(context, campaign.orgId, audience)

      // Only a scheduled campaign starts: the scheduler and a deferred start can both
      // leave a row for the same campaign, and the second must not fan out again.
      const started = await context.db
        .update(campaigns)
        .set({
          status: 'running',
          startedAt: new Date(),
          stats: { ...campaign.stats, targeted: targets.length },
        })
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, 'scheduled')))
        .returning({ id: campaigns.id })
      if (started.length === 0) return

      // One wallet update per affected card, so the offer appears on the pass itself.
      await fanOutWalletUpdates(context.db, campaign.orgId, targets, {
        reason: 'campaign',
        campaignId,
      })
    },

    'message.send': async (payload, context) => {
      const messageId = String(payload.messageId)
      const [message] = await context.db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1)
      // Cancelled (back to draft), already sent, or gone: nothing to do.
      if (!message || (message.status !== 'scheduled' && message.status !== 'sending')) return

      // Due outside the business's notification hours (the hours changed, or a retry
      // slipped past closing): push it to the next opening and leave it scheduled.
      if (message.status === 'scheduled') {
        const now = new Date()
        const allowedAt = await deferToNotificationHours(context.db, message.orgId, now)
        if (allowedAt > now) {
          await context.db.transaction(async (tx) => {
            await tx
              .update(messages)
              .set({ scheduledAt: allowedAt, updatedAt: now })
              .where(eq(messages.id, messageId))
            await enqueue(
              tx,
              OUTBOX_KINDS.messageSend,
              { messageId },
              {
                orgId: message.orgId,
                runAt: allowedAt,
              },
            )
          })
          return
        }
      }

      const audience = { ...audienceSchema.parse(message.audience), consentOnly: true }
      let targets: string[]
      try {
        targets = await resolveAudience(context, message.orgId, audience, { allowDeleted: true })
      } catch (error) {
        // The segment it was aimed at no longer exists at all.
        await context.db
          .update(messages)
          .set({
            status: 'failed',
            error: error instanceof Error ? error.message.slice(0, 500) : 'audience_unresolved',
            updatedAt: new Date(),
          })
          .where(eq(messages.id, messageId))
        return
      }

      await context.db
        .update(messages)
        .set({ status: 'sending', targetedCount: targets.length, updatedAt: new Date() })
        .where(eq(messages.id, messageId))

      if (targets.length === 0) {
        await context.db
          .update(messages)
          .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
          .where(eq(messages.id, messageId))
        return
      }

      // Each chunk inserts its deliveries and fans out their pushes in one transaction.
      // The unique index makes a retry insert nothing new, so a card already fanned out
      // by an earlier, committed chunk is never pushed twice.
      const CHUNK = 500
      for (let index = 0; index < targets.length; index += CHUNK) {
        const chunk = targets.slice(index, index + CHUNK)
        await context.db.transaction(async (tx) => {
          const inserted = await tx
            .insert(messageDeliveries)
            .values(
              chunk.map((customerCardId) => ({
                orgId: message.orgId,
                messageId,
                customerCardId,
              })),
            )
            .onConflictDoNothing({
              target: [messageDeliveries.messageId, messageDeliveries.customerCardId],
            })
            .returning({ customerCardId: messageDeliveries.customerCardId })

          await fanOutWalletUpdates(
            tx,
            message.orgId,
            inserted.map((row) => row.customerCardId),
            { reason: 'message', messageId },
          )
        })
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

/**
 * Resolves a campaign or message audience to the customer cards it touches.
 *
 * Built from the same conditions as the preview the business approved. Until this was
 * shared, the preview counted a segment and the send ignored it, so a campaign aimed at
 * twenty customers at risk went to the entire list.
 */
async function resolveAudience(
  context: OutboxHandlerContext,
  orgId: string,
  audience: Audience,
  options: { allowDeleted?: boolean } = {},
): Promise<string[]> {
  const [org] = await context.db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const definition = await resolveAudienceDefinition(context.db, orgId, audience, options)

  const rows = await context.db
    .select({ id: customerCards.id })
    .from(customerCards)
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .where(audienceConditions(orgId, audience, definition, visitFrequencyOf(org?.settings)))

  return rows.map((row) => row.id)
}

/**
 * The text a Google Wallet pass should announce for this update, if any. Apple reads
 * it off the rebuilt pass instead, so this is only for Google.
 */
async function loadNotice(
  context: OutboxHandlerContext,
  payload: Record<string, unknown>,
): Promise<{ id: string; headline: string; body: string } | null> {
  if (payload.reason === 'message' && payload.messageId) {
    const [message] = await context.db
      .select({ id: messages.id, headline: messages.headline, body: messages.body })
      .from(messages)
      .where(eq(messages.id, String(payload.messageId)))
      .limit(1)
    return message ?? null
  }
  if (payload.reason === 'campaign' && payload.campaignId) {
    const [campaign] = await context.db
      .select({
        id: campaigns.id,
        headline: campaigns.headline,
        body: campaigns.body,
        sendPush: campaigns.sendPush,
      })
      .from(campaigns)
      .where(eq(campaigns.id, String(payload.campaignId)))
      .limit(1)
    return campaign?.sendPush ? campaign : null
  }
  return null
}

export { resolveAudience }
