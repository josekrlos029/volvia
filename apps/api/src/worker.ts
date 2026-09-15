import { createDatabase } from '@volvia/db'
import pino from 'pino'
import { env, isProduction } from './env'
import { createMailer } from './lib/email'
import { createRedis } from './lib/redis'
import {
  expireInactiveCards,
  expireRewards,
  runBirthdayAutomations,
  runCampaignScheduler,
  runLocked,
} from './workers/cron'
import { buildHandlers } from './workers/handlers'
import { drainOutbox, requeueStale } from './workers/outbox'

/**
 * Background worker.
 *
 * Deployed as its own Cloud Run service so a burst of stamps never competes with the
 * API for CPU, and so the queue keeps draining while the API scales to zero.
 */
const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
})

const database = createDatabase({ url: env.DATABASE_URL, max: 5 })
const redis = createRedis({ forQueue: true })
const mailer = createMailer(logger)
const handlers = buildHandlers({ mailer })

const context = { db: database.db, redis, logger }

const OUTBOX_INTERVAL_MS = 2_000
const SCHEDULER_INTERVAL_MS = 60_000
const DAILY_INTERVAL_MS = 15 * 60_000

let running = true
const timers: NodeJS.Timeout[] = []

/** Wraps a loop body so one failure never kills the interval. */
function safeInterval(name: string, intervalMs: number, job: () => Promise<void>): void {
  const timer = setInterval(() => {
    if (!running) return
    job().catch((error) => logger.error({ err: error, job: name }, 'scheduled job failed'))
  }, intervalMs)
  timers.push(timer)
}

safeInterval('outbox', OUTBOX_INTERVAL_MS, async () => {
  const result = await drainOutbox(database.db, handlers, logger)
  if (result.processed > 0 || result.failed > 0) {
    logger.debug(result, 'outbox drained')
  }
})

safeInterval('requeue-stale', SCHEDULER_INTERVAL_MS, async () => {
  await runLocked(context, 'requeue-stale', 55, async () => {
    await requeueStale(database.db, logger)
  })
})

safeInterval('campaigns', SCHEDULER_INTERVAL_MS, async () => {
  await runLocked(context, 'campaigns', 55, async () => {
    const result = await runCampaignScheduler(context)
    if (result.started || result.finished) logger.info(result, 'campaign scheduler')
  })
})

safeInterval('daily', DAILY_INTERVAL_MS, async () => {
  // A 20-hour lock makes these effectively once-a-day even though the loop is frequent —
  // frequent checks matter because organisations span timezones.
  await runLocked(context, 'birthdays', 20 * 3_600, async () => {
    const sent = await runBirthdayAutomations(context)
    if (sent > 0) logger.info({ sent }, 'birthday automations queued')
  })
  await runLocked(context, 'expiry', 3_600, async () => {
    const rewards = await expireRewards(context)
    const cards = await expireInactiveCards(context)
    if (rewards || cards) logger.info({ rewards, cards }, 'expiry sweep')
  })
})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down')
  running = false
  for (const timer of timers) clearInterval(timer)
  // Let an in-flight drain finish before the pool closes underneath it.
  await new Promise((resolve) => setTimeout(resolve, 500))
  await database.close()
  redis.disconnect()
  process.exit(0)
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => void shutdown(signal))
}

logger.info({ outboxIntervalMs: OUTBOX_INTERVAL_MS }, 'volvia worker started')
