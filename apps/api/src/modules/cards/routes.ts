import { createCardSchema, updateCardSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { z } from 'zod'
import { env } from '../../env'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { typed } from '../../types'
import { archiveCard, createCard, getCard, listCards, publishCard, updateCard } from './service'

const cardIdParams = z.object({ cardId: z.string().uuid() })

/** Where a customer lands when they scan the card's QR. */
function joinUrl(joinSlug: string): string {
  return `${env.PASS_URL}/j/${joinSlug}`
}

export async function cardRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/',
    { preHandler: [app.requireOrg('staff')], schema: { tags: ['cards'] } },
    async (request) => {
      const cards = await listCards(app.db, request.org!.orgId)
      return cards.map((card) => ({ ...card, joinUrl: joinUrl(card.joinSlug) }))
    },
  )

  app.get(
    '/:cardId',
    { preHandler: [app.requireOrg('staff')], schema: { params: cardIdParams, tags: ['cards'] } },
    async (request) => {
      const card = await getCard(app.db, request.org!.orgId, request.params.cardId)
      return { ...card, joinUrl: joinUrl(card.joinSlug) }
    },
  )

  app.post(
    '/',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { body: createCardSchema, tags: ['cards'] },
    },
    async (request, reply) => {
      const org = request.org!
      const card = await createCard(app.db, {
        orgId: org.orgId,
        entitlements: org.entitlements,
        data: request.body,
      })
      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.cardCreated,
        targetType: 'stamp_card',
        targetId: card.id,
        ip: request.ip,
      })
      return reply.status(201).send({ ...card, joinUrl: joinUrl(card.joinSlug) })
    },
  )

  app.patch(
    '/:cardId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { params: cardIdParams, body: updateCardSchema, tags: ['cards'] },
    },
    async (request) => {
      const org = request.org!
      const card = await updateCard(app.db, {
        orgId: org.orgId,
        cardId: request.params.cardId,
        entitlements: org.entitlements,
        data: request.body,
      })
      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.cardUpdated,
        targetType: 'stamp_card',
        targetId: card.id,
        ip: request.ip,
      })
      // The public card view is cached; a design change must show up immediately.
      await app.redis.del(`card:by-card:${card.id}`)
      return { ...card, joinUrl: joinUrl(card.joinSlug) }
    },
  )

  app.post(
    '/:cardId/publish',
    { preHandler: [app.requireOrg('admin')], schema: { params: cardIdParams, tags: ['cards'] } },
    async (request) => {
      const org = request.org!
      const card = await publishCard(app.db, {
        orgId: org.orgId,
        cardId: request.params.cardId,
        entitlements: org.entitlements,
      })
      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.cardPublished,
        targetType: 'stamp_card',
        targetId: card.id,
        ip: request.ip,
      })
      return { ...card, joinUrl: joinUrl(card.joinSlug) }
    },
  )

  app.post(
    '/:cardId/archive',
    { preHandler: [app.requireOrg('admin')], schema: { params: cardIdParams, tags: ['cards'] } },
    async (request) => {
      const org = request.org!
      const card = await archiveCard(app.db, org.orgId, request.params.cardId)
      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.cardArchived,
        targetType: 'stamp_card',
        targetId: card.id,
        ip: request.ip,
      })
      return card
    },
  )

  /**
   * The QR a business prints and puts on the counter. SVG by default so it stays crisp
   * at poster size; PNG is available for platforms that cannot place vectors.
   */
  app.get(
    '/:cardId/qr',
    {
      preHandler: [app.requireOrg('staff')],
      schema: {
        params: cardIdParams,
        querystring: z.object({
          format: z.enum(['svg', 'png']).default('svg'),
          size: z.coerce.number().int().min(128).max(2048).default(512),
        }),
        tags: ['cards'],
      },
    },
    async (request, reply) => {
      const card = await getCard(app.db, request.org!.orgId, request.params.cardId)
      const target = joinUrl(card.joinSlug)
      const options = {
        errorCorrectionLevel: 'M' as const,
        margin: 2,
        width: request.query.size,
        color: { dark: '#0E0F12', light: '#FFFFFF' },
      }

      if (request.query.format === 'png') {
        const buffer = await QRCode.toBuffer(target, { ...options, type: 'png' })
        return reply
          .header('content-type', 'image/png')
          .header('cache-control', 'private, max-age=300')
          .send(buffer)
      }

      const svg = await QRCode.toString(target, { ...options, type: 'svg' })
      return reply
        .header('content-type', 'image/svg+xml')
        .header('cache-control', 'private, max-age=300')
        .send(svg)
    },
  )
}
