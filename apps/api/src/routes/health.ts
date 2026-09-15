import type { FastifyInstance } from 'fastify'

/**
 * `/healthz` answers "is the process alive" (liveness) and must never touch a
 * dependency. `/readyz` answers "can this instance serve traffic" and deliberately
 * fails when Postgres or Redis are unreachable, so Cloud Run stops routing to it.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', { logLevel: 'warn', schema: { hide: true } }, async () => ({
    status: 'ok',
    uptime: Math.round(process.uptime()),
  }))

  app.get('/readyz', { logLevel: 'warn', schema: { hide: true } }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {}

    try {
      await app.pingDb()
      checks.database = 'ok'
    } catch {
      checks.database = 'fail'
    }

    try {
      const pong = await app.redis.ping()
      checks.redis = pong === 'PONG' ? 'ok' : 'fail'
    } catch {
      checks.redis = 'fail'
    }

    const healthy = Object.values(checks).every((value) => value === 'ok')
    return reply
      .status(healthy ? 200 : 503)
      .send({ status: healthy ? 'ready' : 'degraded', checks })
  })
}
