import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { typed } from '../../types'
import { listAllOrgs } from './service'

/** Volvia staff tools. Every route requires `users.is_superadmin`. */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/orgs',
    {
      preHandler: [app.requireSuperadmin],
      schema: {
        querystring: z.object({ q: z.string().max(100).optional() }),
        tags: ['admin'],
      },
    },
    async (request) => ({ orgs: await listAllOrgs(app.db, request.query.q) }),
  )
}
