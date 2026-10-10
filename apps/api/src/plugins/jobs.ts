import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { env } from '../env'
import { AppError } from '../lib/errors'
import { createJobRunner } from '../workers/jobs'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Background work without a background process.
 *
 * `POST /internal/jobs/cron` is what Cloud Scheduler calls once a minute, and
 * `POST /internal/jobs/outbox` is what this API calls on itself right after any request
 * that may have enqueued something, so a stamp still reaches the phone in seconds. Both
 * are guarded by a shared secret and switched off entirely when it is unset.
 *
 * The self-call is deliberately a real HTTP request rather than a `setImmediate`: on
 * Cloud Run the CPU is only guaranteed while a request is in flight, so work started
 * after the response may crawl. A new request gets its own CPU and its own timeout.
 */
export const jobsPlugin = fp(async (app: FastifyInstance) => {
  const runner = createJobRunner({
    db: app.db,
    redis: app.redis,
    logger: app.log,
    mailer: app.mailer,
  })
  const enabled = env.JOBS_SECRET.length > 0

  function authorized(request: FastifyRequest): boolean {
    const header = request.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
    const given = Buffer.from(token)
    const expected = Buffer.from(env.JOBS_SECRET)
    return given.length === expected.length && timingSafeEqual(given, expected)
  }

  async function guard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!enabled) throw new AppError('NOT_FOUND', { message: 'route not found' })
    if (!authorized(request)) throw new AppError('UNAUTHENTICATED')
  }

  const routeOptions = {
    schema: { hide: true },
    config: { rateLimit: false },
    logLevel: 'warn',
    preHandler: guard,
  } as const

  app.post('/internal/jobs/outbox', routeOptions, async () => runner.outbox())
  app.post('/internal/jobs/cron', routeOptions, async () => runner.cron())

  // ── Self-kick ────────────────────────────────────────────────────────────────

  let inflight = false
  let pending = false

  async function callOutbox(): Promise<void> {
    const response = await fetch(`${env.API_URL}/internal/jobs/outbox`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.JOBS_SECRET}` },
      signal: AbortSignal.timeout(60_000),
    })
    // Drain the body so the socket is released; the result itself is in the logs.
    await response.arrayBuffer()
    if (!response.ok) app.log.warn({ status: response.status }, 'outbox kick rejected')
  }

  /**
   * At most one self-call in flight per instance, plus one queued behind it: a row
   * committed just as a drain finds the queue empty is picked up by the follow-up
   * instead of waiting for the scheduler.
   */
  function kick(): void {
    if (inflight) {
      pending = true
      return
    }
    inflight = true
    callOutbox()
      .catch((error) => app.log.warn({ err: error }, 'outbox kick failed'))
      .finally(() => {
        inflight = false
        if (pending) {
          pending = false
          kick()
        }
      })
  }

  app.decorate('kickJobs', enabled ? kick : () => {})

  // `onSend` runs before the reply is written, while this request still owns the CPU.
  app.addHook('onSend', async (request, reply, payload) => {
    if (
      enabled &&
      MUTATING.has(request.method) &&
      reply.statusCode < 400 &&
      !request.url.startsWith('/internal/')
    ) {
      kick()
    }
    return payload
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    /** Asks this API to drain its own outbox now. No-op when jobs are disabled. */
    kickJobs: () => void
  }
}
