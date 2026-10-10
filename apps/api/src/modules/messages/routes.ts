import { audienceSchema, messageSchema, sendMessageSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { typed } from '../../types'
import {
  cancelMessage,
  createMessage,
  getMessage,
  listMessages,
  messagesThisMonth,
  previewMessageAudience,
  sendMessage,
} from './service'

const messageParams = z.object({ messageId: z.string().uuid() })

/** One-off pushes to the wallet pass. Every route is admin-only and plan-gated. */
export async function messageRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)
  const guards = [app.requireOrg('admin'), app.requireFeature('customer_messages')]

  app.get('/', { preHandler: guards, schema: { tags: ['messages'] } }, async (request) => ({
    messages: await listMessages(app.db, request.org!.orgId),
    // Shown as "2 de 4 este mes" rather than only refusing the fifth.
    thisMonth: {
      used: await messagesThisMonth(app.db, request.org!.orgId),
      limit: request.org!.entitlements.limit('messagesPerMonth'),
    },
  }))

  app.post(
    '/preview',
    { preHandler: guards, schema: { body: audienceSchema, tags: ['messages'] } },
    async (request) =>
      previewMessageAudience(app.db, request.org!.orgId, request.body, request.org!.visitFrequency),
  )

  app.post(
    '/',
    { preHandler: guards, schema: { body: messageSchema, tags: ['messages'] } },
    async (request, reply) => {
      const created = await createMessage(app.db, {
        orgId: request.org!.orgId,
        data: request.body,
      })
      return reply.status(201).send(created)
    },
  )

  app.get(
    '/:messageId',
    { preHandler: guards, schema: { params: messageParams, tags: ['messages'] } },
    async (request) => getMessage(app.db, request.org!.orgId, request.params.messageId),
  )

  app.post(
    '/:messageId/send',
    {
      preHandler: guards,
      schema: { params: messageParams, body: sendMessageSchema, tags: ['messages'] },
    },
    async (request) => {
      const message = await sendMessage(app.db, {
        orgId: request.org!.orgId,
        entitlements: request.org!.entitlements,
        messageId: request.params.messageId,
        scheduledAt: request.body.scheduledAt,
      })
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.messageSent,
        targetType: 'message',
        targetId: message.id,
        meta: { scheduled: request.body.scheduledAt !== null },
        ip: request.ip,
      })
      return message
    },
  )

  app.post(
    '/:messageId/cancel',
    { preHandler: guards, schema: { params: messageParams, tags: ['messages'] } },
    async (request) => cancelMessage(app.db, request.org!.orgId, request.params.messageId),
  )
}
