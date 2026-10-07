import { analyticsRangeSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { redisKeys } from '../../lib/redis'
import { typed } from '../../types'
import { loadBusiest, loadOverview, loadPulse, loadRetention, loadTimeseries } from './service'

/** Dashboard reads are cached briefly — the numbers move by the minute, not the second. */
const CACHE_SECONDS = 60

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/overview',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { querystring: analyticsRangeSchema, tags: ['analytics'] },
    },
    async (request) => {
      const org = request.org!
      const key = redisKeys.orgOverview(org.orgId, JSON.stringify(request.query))
      const cached = await app.redis.get(key)
      if (cached) return JSON.parse(cached)

      const overview = await loadOverview(app.db, org.orgId, request.query)

      // The free plan sees the headline numbers; the deeper cuts are a paid feature.
      const payload = org.entitlements.has('full_analytics')
        ? { ...overview, limited: false }
        : {
            ...overview,
            rewards: { ...overview.rewards, redemptionRate: 0 },
            repeatRate: 0,
            medianDaysBetweenVisits: null,
            limited: true,
            upgradeTo: org.entitlements.upgradeForFeature('full_analytics'),
          }

      await app.redis.set(key, JSON.stringify(payload), 'EX', CACHE_SECONDS)
      return payload
    },
  )

  app.get(
    '/timeseries',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { querystring: analyticsRangeSchema, tags: ['analytics'] },
    },
    async (request) => loadTimeseries(app.db, request.org!.orgId, request.query),
  )

  app.get(
    '/pulse',
    { preHandler: [app.requireOrg('staff')], schema: { tags: ['analytics'] } },
    async (request) => loadPulse(app.db, request.org!.orgId, request.org!.timezone),
  )

  app.get(
    '/busiest',
    {
      preHandler: [app.requireOrg('staff'), app.requireFeature('full_analytics')],
      schema: { querystring: analyticsRangeSchema, tags: ['analytics'] },
    },
    async (request) => loadBusiest(app.db, request.org!.orgId, request.query),
  )

  app.get(
    '/retention',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('full_analytics')],
      schema: {
        querystring: z.object({ months: z.coerce.number().int().min(3).max(12).default(6) }),
        tags: ['analytics'],
      },
    },
    async (request) => loadRetention(app.db, request.org!.orgId, request.query.months),
  )
}
