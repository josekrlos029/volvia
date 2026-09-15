import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import client from 'prom-client'

/**
 * Metrics kept deliberately small and high-signal: request latency by route, the stamp
 * pipeline (the only endpoint with a real SLO), outbox depth and queue failures.
 */
export const registry = new client.Registry()
client.collectDefaultMetrics({ register: registry, prefix: 'volvia_' })

export const httpDuration = new client.Histogram({
  name: 'volvia_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3, 6],
  registers: [registry],
})

export const stampCounter = new client.Counter({
  name: 'volvia_stamps_total',
  help: 'Stamps applied, by source and outcome',
  labelNames: ['source', 'outcome'] as const,
  registers: [registry],
})

export const outboxDepth = new client.Gauge({
  name: 'volvia_outbox_pending',
  help: 'Outbox rows waiting to be processed',
  registers: [registry],
})

export const jobCounter = new client.Counter({
  name: 'volvia_jobs_total',
  help: 'Background jobs processed, by kind and outcome',
  labelNames: ['kind', 'outcome'] as const,
  registers: [registry],
})

export const walletPushCounter = new client.Counter({
  name: 'volvia_wallet_pushes_total',
  help: 'Wallet pass update pushes, by platform and outcome',
  labelNames: ['platform', 'outcome'] as const,
  registers: [registry],
})

export const observabilityPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onResponse', async (request, reply) => {
    // Use the route pattern, never the raw URL — ids would explode cardinality.
    const route = request.routeOptions?.url ?? 'unknown'
    httpDuration
      .labels(request.method, route, String(reply.statusCode))
      .observe(reply.elapsedTime / 1000)
  })

  app.get('/metrics', { logLevel: 'warn', schema: { hide: true } }, async (_request, reply) => {
    reply.header('content-type', registry.contentType)
    return registry.metrics()
  })
})
