import { createDatabase } from '@volvia/db'
import pino from 'pino'
import { env, isProduction } from './env'
import { createMailer } from './lib/email'
import { createRedis } from './lib/redis'
import { createJobRunner } from './workers/jobs'

/**
 * Local background worker.
 *
 * Production has no always-on process: Cloud Scheduler calls `/internal/jobs/cron` every
 * few minutes and the API kicks its own outbox after each write. On a laptop there is no
 * scheduler, so this loop calls the same two ticks on a timer. Same code, two clocks.
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
const runner = createJobRunner({ db: database.db, redis, logger, mailer })

const OUTBOX_INTERVAL_MS = 2_000
const CRON_INTERVAL_MS = 60_000

let running = true
const timers: NodeJS.Timeout[] = []

/** Wraps a loop body so one failure never kills the interval, and slow runs never overlap. */
function safeInterval(name: string, intervalMs: number, job: () => Promise<void>): void {
  let busy = false
  const timer = setInterval(() => {
    if (!running || busy) return
    busy = true
    job()
      .catch((error) => logger.error({ err: error, job: name }, 'scheduled job failed'))
      .finally(() => {
        busy = false
      })
  }, intervalMs)
  timers.push(timer)
}

safeInterval('outbox', OUTBOX_INTERVAL_MS, async () => {
  await runner.outbox({ deadlineMs: 10_000 })
})

safeInterval('cron', CRON_INTERVAL_MS, async () => {
  await runner.cron()
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
