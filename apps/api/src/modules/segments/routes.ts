import { customerSegmentSchema, segmentDefinitionSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { typed } from '../../types'
import {
  countDefinition,
  createSegment,
  deleteSegment,
  getSegment,
  listSegments,
  suggestedWithCounts,
  updateSegment,
} from './service'

const segmentParams = z.object({ segmentId: z.string().uuid() })

/**
 * Segments. Reading — the suggested ones and their live counts — is open to every
 * plan, because they are the hook. Saving one of your own is a paid feature.
 */
export async function segmentRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/',
    { preHandler: [app.requireOrg('staff')], schema: { tags: ['segments'] } },
    async (request) => {
      const org = request.org!
      const [segments, suggested] = await Promise.all([
        listSegments(app.db, org.orgId, org.visitFrequency),
        suggestedWithCounts(app.db, org.orgId, org.visitFrequency),
      ])
      return { segments, suggested, canCreate: org.entitlements.has('custom_segments') }
    },
  )

  app.post(
    '/preview',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { body: segmentDefinitionSchema, tags: ['segments'] },
    },
    async (request) => ({
      count: await countDefinition(
        app.db,
        request.org!.orgId,
        request.body,
        request.org!.visitFrequency,
      ),
    }),
  )

  app.get(
    '/:segmentId',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { params: segmentParams, tags: ['segments'] },
    },
    async (request) =>
      getSegment(app.db, request.org!.orgId, request.params.segmentId, request.org!.visitFrequency),
  )

  app.post(
    '/',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('custom_segments')],
      schema: { body: customerSegmentSchema, tags: ['segments'] },
    },
    async (request, reply) => {
      const created = await createSegment(app.db, request.org!.orgId, request.body)
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.segmentCreated,
        targetType: 'segment',
        targetId: created.id,
        ip: request.ip,
      })
      return reply.status(201).send(created)
    },
  )

  app.put(
    '/:segmentId',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('custom_segments')],
      schema: { params: segmentParams, body: customerSegmentSchema, tags: ['segments'] },
    },
    async (request) =>
      updateSegment(app.db, request.org!.orgId, request.params.segmentId, request.body),
  )

  app.delete(
    '/:segmentId',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('custom_segments')],
      schema: { params: segmentParams, response: { 204: z.null() }, tags: ['segments'] },
    },
    async (request, reply) => {
      await deleteSegment(app.db, request.org!.orgId, request.params.segmentId)
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.segmentDeleted,
        targetType: 'segment',
        targetId: request.params.segmentId,
        ip: request.ip,
      })
      return reply.status(204).send(null)
    },
  )
}
