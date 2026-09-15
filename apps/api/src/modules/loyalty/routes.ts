import { and, eq, locations, stampCards } from '@volvia/db'
import {
  adjustStampsSchema,
  kioskSessionSchema,
  kioskStampSchema,
  redeemSchema,
  stampSchema,
} from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { AppError } from '../../lib/errors'
import { withIdempotency } from '../../lib/idempotency'
import { redisKeys } from '../../lib/redis'
import { stampCounter } from '../../plugins/observability'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import {
  closeKioskSession,
  consumeNonce,
  issueNonce,
  openKioskSession,
  readKioskSession,
} from './kiosk'
import { adjustStamps, recentActivity, redeemReward } from './redeem'
import { applyStamp } from './service'

export async function loyaltyRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  /**
   * The endpoint the whole product turns on. Guarded by Redis idempotency so a retry
   * from the scanner's offline queue returns the original result instead of stamping
   * a second time.
   */
  app.post(
    '/stamp',
    {
      preHandler: [app.requireOrg('staff')],
      config: { rateLimit: rateLimits.stamp },
      schema: { body: stampSchema, tags: ['loyalty'] },
    },
    async (request, reply) => {
      const org = request.org!
      const scope = `stamp:${org.orgId}`

      const outcome = await withIdempotency<Awaited<ReturnType<typeof applyStamp>>>(
        app.redis,
        scope,
        request.body.idempotencyKey,
      )

      if (outcome.status === 'replayed') {
        stampCounter.labels('staff_scan', 'replayed').inc()
        return { ...outcome.result, replayed: true }
      }
      if (outcome.status === 'in_flight') {
        throw new AppError('CONFLICT', { message: 'this scan is already being processed' })
      }

      try {
        // A member pinned to one location may only stamp for that location.
        const locationId = org.locationId ?? request.body.locationId ?? null

        const result = await applyStamp(app.db, {
          orgId: org.orgId,
          cardToken: request.body.cardToken,
          count: request.body.count,
          locationId,
          actorUserId: request.auth!.userId,
          source: 'staff_scan',
          idempotencyKey: request.body.idempotencyKey,
          occurredAt: request.body.occurredAt,
          purchaseAmount: request.body.purchaseAmount,
          note: request.body.note,
        })

        await outcome.commit(result)
        // The public card view is cached for speed; the customer must see the new stamp.
        await app.redis.del(redisKeys.cardState(request.body.cardToken))
        stampCounter.labels('staff_scan', 'ok').inc()

        await audit(app.db, {
          orgId: org.orgId,
          actorUserId: request.auth!.userId,
          action: AUDIT_ACTIONS.stampAdded,
          targetType: 'customer_card',
          targetId: result.customerCardId,
          meta: { stamps: result.stampsAdded, rewards: result.unlockedRewards.length },
          ip: request.ip,
        })

        return reply.status(201).send(result)
      } catch (error) {
        // Never leave a poisoned key behind: the staff member must be able to retry.
        await outcome.release()
        stampCounter.labels('staff_scan', 'rejected').inc()
        throw error
      }
    },
  )

  app.post(
    '/redeem',
    {
      preHandler: [app.requireOrg('staff')],
      config: { rateLimit: rateLimits.stamp },
      schema: { body: redeemSchema, tags: ['loyalty'] },
    },
    async (request) => {
      const org = request.org!
      const outcome = await withIdempotency<Awaited<ReturnType<typeof redeemReward>>>(
        app.redis,
        `redeem:${org.orgId}`,
        request.body.idempotencyKey,
      )

      if (outcome.status === 'replayed') return outcome.result
      if (outcome.status === 'in_flight') {
        throw new AppError('CONFLICT', { message: 'this redemption is already being processed' })
      }

      try {
        const result = await redeemReward(app.db, {
          orgId: org.orgId,
          grantId: request.body.grantId,
          code: request.body.code,
          cardToken: request.body.cardToken,
          locationId: org.locationId ?? request.body.locationId ?? null,
          actorUserId: request.auth!.userId,
          idempotencyKey: request.body.idempotencyKey,
        })

        await outcome.commit(result)
        if (request.body.cardToken) {
          await app.redis.del(redisKeys.cardState(request.body.cardToken))
        }
        await audit(app.db, {
          orgId: org.orgId,
          actorUserId: request.auth!.userId,
          action: AUDIT_ACTIONS.rewardRedeemed,
          targetType: 'reward_grant',
          targetId: result.grantId,
          ip: request.ip,
        })
        return result
      } catch (error) {
        await outcome.release()
        throw error
      }
    },
  )

  app.post(
    '/adjust',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { body: adjustStampsSchema, tags: ['loyalty'] },
    },
    async (request) => {
      const org = request.org!
      const result = await adjustStamps(app.db, {
        orgId: org.orgId,
        customerCardId: request.body.customerCardId,
        delta: request.body.delta,
        reason: request.body.reason,
        actorUserId: request.auth!.userId,
        idempotencyKey: request.body.idempotencyKey,
      })
      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.stampAdjusted,
        targetType: 'customer_card',
        targetId: result.customerCardId,
        meta: { delta: request.body.delta, reason: request.body.reason },
        ip: request.ip,
      })
      return result
    },
  )

  app.get(
    '/activity/:customerCardId',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { params: z.object({ customerCardId: z.string().uuid() }), tags: ['loyalty'] },
    },
    async (request) => recentActivity(app.db, request.org!.orgId, request.params.customerCardId),
  )

  // ── Kiosk ──────────────────────────────────────────────────────────────────
  app.post(
    '/kiosk/session',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('kiosk_mode')],
      schema: { body: kioskSessionSchema, tags: ['kiosk'] },
    },
    async (request, reply) => {
      const org = request.org!

      const [card] = await app.db
        .select({ id: stampCards.id, rules: stampCards.rules })
        .from(stampCards)
        .where(and(eq(stampCards.id, request.body.cardId), eq(stampCards.orgId, org.orgId)))
        .limit(1)
      if (!card) throw new AppError('CARD_NOT_FOUND', { message: 'card not found' })
      if (!card.rules.kioskEnabled) {
        throw new AppError('CONFLICT', { message: 'kiosk mode is turned off for this card' })
      }

      const [location] = await app.db
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.id, request.body.locationId), eq(locations.orgId, org.orgId)))
        .limit(1)
      if (!location) throw new AppError('NOT_FOUND', { message: 'location not found' })

      const session = await openKioskSession(app.redis, {
        orgId: org.orgId,
        cardId: card.id,
        locationId: location.id,
      })

      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.kioskOpened,
        targetType: 'stamp_card',
        targetId: card.id,
        ip: request.ip,
      })

      return reply.status(201).send(session)
    },
  )

  /** Polled by the kiosk screen; each call replaces the QR it is displaying. */
  app.post(
    '/kiosk/nonce',
    {
      schema: {
        body: z.object({ sessionId: z.string().uuid(), secret: z.string().min(16) }),
        tags: ['kiosk'],
      },
    },
    async (request) => {
      const session = await readKioskSession(app.redis, request.body.sessionId, request.body.secret)
      return issueNonce(app.redis, { sessionId: request.body.sessionId, ...session })
    },
  )

  /**
   * The customer's phone posts this after scanning the kiosk QR. No staff account is
   * involved, so the nonce is the only credential — and it dies on first use.
   */
  app.post(
    '/kiosk/stamp',
    {
      config: { rateLimit: rateLimits.stamp },
      schema: { body: kioskStampSchema, tags: ['kiosk'] },
    },
    async (request, reply) => {
      const payload = await consumeNonce(app.redis, request.body.nonce)

      const outcome = await withIdempotency<Awaited<ReturnType<typeof applyStamp>>>(
        app.redis,
        `stamp:${payload.orgId}`,
        request.body.idempotencyKey,
      )
      if (outcome.status === 'replayed') return { ...outcome.result, replayed: true }
      if (outcome.status === 'in_flight') {
        throw new AppError('CONFLICT', { message: 'this scan is already being processed' })
      }

      try {
        const result = await applyStamp(app.db, {
          // The nonce carries the organisation, so a kiosk can only stamp its own cards.
          orgId: payload.orgId,
          cardToken: request.body.cardToken,
          count: 1,
          locationId: payload.locationId,
          actorUserId: null,
          source: 'kiosk',
          idempotencyKey: request.body.idempotencyKey,
        })
        await outcome.commit(result)
        await app.redis.del(redisKeys.cardState(request.body.cardToken))
        stampCounter.labels('kiosk', 'ok').inc()
        return reply.status(201).send(result)
      } catch (error) {
        await outcome.release()
        stampCounter.labels('kiosk', 'rejected').inc()
        throw error
      }
    },
  )

  app.delete(
    '/kiosk/session/:sessionId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { params: z.object({ sessionId: z.string().uuid() }), tags: ['kiosk'] },
    },
    async (request, reply) => {
      await closeKioskSession(app.redis, request.params.sessionId)
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.kioskRevoked,
        targetId: request.params.sessionId,
        ip: request.ip,
      })
      return reply.status(204).send(null)
    },
  )
}
