import { pageKindParamsSchema, replacePageModuleSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { env } from '../../env'
import { redisKeys } from '../../lib/redis'
import { typed } from '../../types'
import { getOrg } from '../orgs/service'
import { loadPageSections, pageViewsLast30Days, replacePageModule } from './service'

/**
 * The business's public page, from the inside: what is on it and how often it is
 * opened. The page itself is served by the `public` module and cached by slug, so
 * every write here drops that cache.
 */
export async function pageRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/',
    { preHandler: [app.requireOrg('admin')], schema: { tags: ['page'] } },
    async (request) => {
      const orgId = request.org!.orgId
      const [org, sections, views30d] = await Promise.all([
        getOrg(app.db, orgId),
        loadPageSections(app.db, orgId),
        pageViewsLast30Days(app.db, orgId),
      ])
      return { publicUrl: `${env.PASS_URL}/b/${org.slug}`, sections, views30d }
    },
  )

  app.put(
    '/modules/:kind',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('page_catalogue')],
      schema: { params: pageKindParamsSchema, body: replacePageModuleSchema, tags: ['page'] },
    },
    async (request) => {
      const orgId = request.org!.orgId
      const sections = await replacePageModule(app.db, orgId, request.params.kind, request.body)
      const org = await getOrg(app.db, orgId)
      await app.redis.del(redisKeys.businessPage(org.slug))
      return { kind: request.params.kind, sections }
    },
  )
}
