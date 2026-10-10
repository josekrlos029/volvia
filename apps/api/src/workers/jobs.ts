import type { Database } from '@volvia/db'
import type { FastifyBaseLogger } from 'fastify'
import type { Mailer } from '../lib/email'
import { type RedisClient, redisKeys } from '../lib/redis'
import {
  expireInactiveCards,
  expireRewards,
  finishStaleMessages,
  runBirthdayAutomations,
  runCampaignScheduler,
  runLocked,
} from './cron'
import { buildHandlers } from './handlers'
import { drainOutbox, requeueStale } from './outbox'

export interface JobsDeps {
  db: Database
  redis: RedisClient
  logger: FastifyBaseLogger
  mailer: Mailer
}

export interface OutboxTick {
  processed: number
  failed: number
  batches: number
  /** True when the queue was empty on exit; false when the deadline cut the run short. */
  exhausted: boolean
}

export interface CronTick {
  /** The jobs this tick actually ran; the ones another instance held the lock for are absent. */
  ran: string[]
  outbox: OutboxTick
}

/** How long a single outbox call may keep draining before it hands back control. */
const OUTBOX_DEADLINE_MS = 20_000
/** The once-a-day jobs are cheap to check but pointless to run every minute. */
const DAILY_EVERY_SECONDS = 15 * 60

/**
 * Everything the background worker used to do, as two callable ticks.
 *
 * There is no always-on process in production: the API scales to zero and a scheduler
 * calls `cron` every few minutes, while a request that enqueues work calls `outbox` on its
 * own instance right after answering. Both are idempotent and safe to overlap, because
 * the outbox is claimed with `for update skip locked` and the cron jobs run behind
 * Redis locks. The local worker (`worker.ts`) calls the same two functions on a timer.
 */
export function createJobRunner(deps: JobsDeps) {
  const handlers = buildHandlers({ mailer: deps.mailer })
  const context = { db: deps.db, redis: deps.redis, logger: deps.logger }

  async function outbox(options: { deadlineMs?: number } = {}): Promise<OutboxTick> {
    const deadline = Date.now() + (options.deadlineMs ?? OUTBOX_DEADLINE_MS)
    const tick: OutboxTick = { processed: 0, failed: 0, batches: 0, exhausted: false }

    while (Date.now() < deadline) {
      const result = await drainOutbox(deps.db, handlers, deps.logger)
      tick.batches += 1
      tick.processed += result.processed
      tick.failed += result.failed
      if (result.processed + result.failed === 0) {
        tick.exhausted = true
        break
      }
    }

    if (tick.processed > 0 || tick.failed > 0) deps.logger.debug(tick, 'outbox drained')
    return tick
  }

  async function cron(): Promise<CronTick> {
    const ran: string[] = []

    if (
      await runLocked(context, 'requeue-stale', 55, async () => {
        await requeueStale(deps.db, deps.logger)
      })
    ) {
      ran.push('requeue-stale')
    }

    if (
      await runLocked(context, 'campaigns', 55, async () => {
        const result = await runCampaignScheduler(context)
        if (result.started || result.finished) deps.logger.info(result, 'campaign scheduler')
        await finishStaleMessages(context)
      })
    ) {
      ran.push('campaigns')
    }

    // A key that is set and never released: whoever sets it owns the next quarter hour.
    // Frequent checks still matter because organisations span timezones.
    const dailyDue = await deps.redis.set(
      redisKeys.cronLock('daily-due'),
      '1',
      'EX',
      DAILY_EVERY_SECONDS,
      'NX',
    )
    if (dailyDue === 'OK') {
      await runLocked(context, 'birthdays', 3_600, async () => {
        const sent = await runBirthdayAutomations(context)
        if (sent > 0) deps.logger.info({ sent }, 'birthday automations queued')
      })
      await runLocked(context, 'expiry', 3_600, async () => {
        const rewards = await expireRewards(context)
        const cards = await expireInactiveCards(context)
        if (rewards || cards) deps.logger.info({ rewards, cards }, 'expiry sweep')
      })
      ran.push('daily')
    }

    // Whatever the schedulers just enqueued (campaign starts, birthday emails) goes out
    // in the same tick instead of waiting for the next one.
    return { ran, outbox: await outbox() }
  }

  return { outbox, cron }
}

export type JobRunner = ReturnType<typeof createJobRunner>
