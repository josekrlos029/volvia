import {
  and,
  automationRuns,
  automations,
  campaigns,
  customerCards,
  customers,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  organizations,
  outbox,
  rewardGrants,
  sql,
} from '@volvia/db'
import type { Database } from '@volvia/db'
import type { FastifyBaseLogger } from 'fastify'
import { DateTime } from 'luxon'
import { OUTBOX_KINDS } from '../lib/outbox'
import { type RedisClient, acquireLock, redisKeys } from '../lib/redis'

export interface CronContext {
  db: Database
  redis: RedisClient
  logger: FastifyBaseLogger
}

/**
 * Runs a job behind a distributed lock, so several Cloud Run instances can each hold a
 * scheduler without the birthday email going out three times.
 */
export async function runLocked(
  context: CronContext,
  name: string,
  ttlSeconds: number,
  job: () => Promise<void>,
): Promise<boolean> {
  const release = await acquireLock(context.redis, redisKeys.cronLock(name), ttlSeconds)
  if (!release) return false
  try {
    await job()
    return true
  } finally {
    await release()
  }
}

/**
 * Birthday automation.
 *
 * "Today" is evaluated per organisation timezone, so a business in Bogotá and one in
 * Madrid each fire on their own morning. `automation_runs` makes it once-per-year:
 * a retry, a restart or a second instance cannot send twice.
 */
export async function runBirthdayAutomations(context: CronContext): Promise<number> {
  const active = await context.db
    .select({ automation: automations, org: organizations })
    .from(automations)
    .innerJoin(organizations, eq(organizations.id, automations.orgId))
    .where(and(eq(automations.type, 'birthday'), eq(automations.isActive, true)))

  let sent = 0

  for (const { automation, org } of active) {
    const today = DateTime.now().setZone(org.timezone).plus({ days: automation.config.offsetDays })
    const occurrenceKey = String(today.year)

    const candidates = await context.db
      .select({
        customerId: customers.id,
        customerCardId: customerCards.id,
        cardToken: customerCards.token,
      })
      .from(customers)
      .innerJoin(customerCards, eq(customerCards.customerId, customers.id))
      .where(
        and(
          eq(customers.orgId, org.id),
          eq(customers.birthdayMonth, today.month),
          eq(customers.birthdayDay, today.day),
          eq(customerCards.status, 'active'),
        ),
      )

    if (candidates.length === 0) continue

    // Skip anyone this automation already greeted this year.
    const alreadyRun = await context.db
      .select({ customerId: automationRuns.customerId })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, automation.id),
          eq(automationRuns.occurrenceKey, occurrenceKey),
          inArray(
            automationRuns.customerId,
            candidates.map((row) => row.customerId),
          ),
        ),
      )
    const skip = new Set(alreadyRun.map((row) => row.customerId))
    const pending = candidates.filter((row) => !skip.has(row.customerId))
    if (pending.length === 0) continue

    await context.db.transaction(async (tx) => {
      await tx.insert(automationRuns).values(
        pending.map((row) => ({
          orgId: org.id,
          automationId: automation.id,
          customerId: row.customerId,
          occurrenceKey,
        })),
      )

      const jobs = pending.flatMap((row) => {
        const entries: Array<typeof outbox.$inferInsert> = [
          {
            orgId: org.id,
            kind: OUTBOX_KINDS.walletUpdate,
            // The wallet handler addresses cards by id; the token is the public
            // identifier the email links to.
            payload: { customerCardId: row.customerCardId, reason: 'birthday' },
          },
        ]
        if (automation.config.sendEmail) {
          entries.push({
            orgId: org.id,
            kind: OUTBOX_KINDS.emailSend,
            payload: {
              type: 'birthday',
              customerCardToken: row.cardToken,
              offer: automation.config.offer.title ?? automation.config.headline,
            },
          })
        }
        return entries
      })

      await tx.insert(outbox).values(jobs)
      await tx
        .update(automations)
        .set({ lastRunAt: new Date() })
        .where(eq(automations.id, automation.id))
    })

    sent += pending.length
  }

  return sent
}

/** Moves campaigns into and out of `running` as their windows open and close. */
export async function runCampaignScheduler(
  context: CronContext,
): Promise<{ started: number; finished: number }> {
  const now = new Date()

  const toStart = await context.db
    .select({ id: campaigns.id, orgId: campaigns.orgId })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'scheduled'),
        lte(campaigns.startsAt, now),
        gte(campaigns.endsAt, now),
      ),
    )

  for (const campaign of toStart) {
    await context.db.insert(outbox).values({
      orgId: campaign.orgId,
      kind: OUTBOX_KINDS.campaignStart,
      payload: { campaignId: campaign.id },
    })
  }

  const toFinish = await context.db
    .select({ id: campaigns.id, orgId: campaigns.orgId })
    .from(campaigns)
    .where(and(eq(campaigns.status, 'running'), lte(campaigns.endsAt, now)))

  for (const campaign of toFinish) {
    await context.db.insert(outbox).values({
      orgId: campaign.orgId,
      kind: OUTBOX_KINDS.campaignEnd,
      payload: { campaignId: campaign.id },
    })
  }

  return { started: toStart.length, finished: toFinish.length }
}

/** Expires reward grants nobody claimed, so the card stops promising them. */
export async function expireRewards(context: CronContext): Promise<number> {
  const expired = await context.db
    .update(rewardGrants)
    .set({ status: 'expired' })
    .where(
      and(
        eq(rewardGrants.status, 'pending'),
        isNotNull(rewardGrants.expiresAt),
        lte(rewardGrants.expiresAt, new Date()),
      ),
    )
    .returning({ id: rewardGrants.id, customerCardId: rewardGrants.customerCardId })

  if (expired.length > 0) {
    // The pass still shows the reward until it is refreshed.
    await context.db.insert(outbox).values(
      expired.map((grant) => ({
        kind: OUTBOX_KINDS.walletUpdate,
        payload: { customerCardId: grant.customerCardId, reason: 'reward_expired' },
      })),
    )
  }
  return expired.length
}

/**
 * Clears stamp progress on cards the business configured to expire after inactivity.
 * The customer's card stays, so they can start again without signing up twice.
 */
export async function expireInactiveCards(context: CronContext): Promise<number> {
  const rows = await context.db
    .update(customerCards)
    .set({ stampsCount: 0, expiresAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(customerCards.status, 'active'),
        isNotNull(customerCards.expiresAt),
        lte(customerCards.expiresAt, new Date()),
        sql`${customerCards.stampsCount} > 0`,
      ),
    )
    .returning({ id: customerCards.id })

  if (rows.length > 0) {
    await context.db.insert(outbox).values(
      rows.map((row) => ({
        kind: OUTBOX_KINDS.walletUpdate,
        payload: { customerCardId: row.id, reason: 'inactivity_expiry' },
      })),
    )
  }
  return rows.length
}
