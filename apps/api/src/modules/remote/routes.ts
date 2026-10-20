import {
  remoteLookupQuerySchema,
  remoteLookupResultSchema,
  remoteStatusSchema,
  saveDocumentSchema,
} from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { typed } from '../../types'
import {
  assertRemoteStamping,
  lookupCards,
  primaryJoinUrl,
  remoteStatus,
  saveDocumentNumber,
} from './service'

/**
 * What the browser extension needs besides `POST /v1/stamp`: whether the business
 * allows remote stamps at all, finding a card without its QR, and saving a cédula.
 * Stamping itself goes through the one stamp endpoint with `channel: 'remote'`.
 */
export async function remoteRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/status',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { response: { 200: remoteStatusSchema }, tags: ['remote'] },
    },
    async (request) => remoteStatus(app.db, request.org!.orgId),
  )

  app.get(
    '/lookup',
    {
      preHandler: [app.requireOrg('staff')],
      // Search-as-you-type, debounced client-side; generous but bounded.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: remoteLookupQuerySchema,
        response: { 200: remoteLookupResultSchema },
        tags: ['remote'],
      },
    },
    async (request) => {
      const orgId = request.org!.orgId
      await assertRemoteStamping(app.db, orgId)
      const items = await lookupCards(app.db, orgId, request.query.q)
      return { items, joinUrl: items.length === 0 ? await primaryJoinUrl(app.db, orgId) : null }
    },
  )

  app.put(
    '/customers/:customerId/document',
    {
      preHandler: [app.requireOrg('staff')],
      schema: {
        params: z.object({ customerId: z.string().uuid() }),
        body: saveDocumentSchema,
        response: { 200: z.object({ documentTail: z.string() }) },
        tags: ['remote'],
      },
    },
    async (request) => {
      const orgId = request.org!.orgId
      await assertRemoteStamping(app.db, orgId)
      const result = await saveDocumentNumber(
        app.db,
        orgId,
        request.params.customerId,
        request.body.documentNumber,
      )
      await audit(app.db, {
        orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.customerDocumentSaved,
        targetType: 'customer',
        targetId: request.params.customerId,
        ip: request.ip,
      })
      return result
    },
  )
}
