import { and, customerCards, eq, locations, stampCards } from '@volvia/db'
import {
  adjustStampsSchema,
  kioskSessionSchema,
  kioskStampSchema,
  publicTokenSchema,
  redeemSchema,
  staffEnrollSchema,
  stampSchema,
  voidStampSchema,
} from '@volvia/shared'
import type { StaffEnrollResult } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../env'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { invalidateEntitlements } from '../../lib/entitlements'
import { AppError } from '../../lib/errors'
import { withIdempotency } from '../../lib/idempotency'
import { redisKeys } from '../../lib/redis'
import { startOfOrgDay } from '../../lib/time'
import { stampCounter } from '../../plugins/observability'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import { assertRemoteStamping } from '../remote/service'
import {
  closeKioskSession,
  consumeNonce,
  issueNonce,
  openKioskSession,
  readKioskLastStamp,
  readKioskSession,
  recordKioskStamp,
} from './kiosk'
import { adjustStamps, recentActivity, redeemReward } from './redeem'
import {
  applyStamp,
  enrolOnCard,
  findActiveCardForOrg,
  lookupCard,
  myActivity,
  voidStamp,
} from './service'

/** The cached public card view must drop as soon as the count changes. */
async function tokenFor(app: ReturnType<typeof typed>, orgId: string, customerCardId: string) {
  const [row] = await app.db
    .select({ token: customerCards.token })
    .from(customerCards)
    .where(and(eq(customerCards.id, customerCardId), eq(customerCards.orgId, orgId)))
    .limit(1)
  return row?.token ?? null
}

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
      const source = request.body.channel === 'remote' ? 'remote' : 'staff_scan'

      // Checked before the idempotency reservation so a refusal leaves nothing behind.
      if (source === 'remote') {
        const remote = await assertRemoteStamping(app.db, org.orgId)
        if (remote.requireOrder && !request.body.note) {
          throw new AppError('VALIDATION_FAILED', {
            message: 'order number required',
            details: [{ path: 'note', message: 'order_required' }],
          })
        }
      }

      const outcome = await withIdempotency<Awaited<ReturnType<typeof applyStamp>>>(
        app.redis,
        scope,
        request.body.idempotencyKey,
      )

      if (outcome.status === 'replayed') {
        stampCounter.labels(source, 'replayed').inc()
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
          customerCardId: request.body.customerCardId,
          count: request.body.count,
          locationId,
          actorUserId: request.auth!.userId,
          source,
          idempotencyKey: request.body.idempotencyKey,
          occurredAt: request.body.occurredAt,
          purchaseAmount: request.body.purchaseAmount,
          note: request.body.note,
        })

        await outcome.commit(result)
        // The public card view is cached for speed; the customer must see the new stamp.
        const token =
          request.body.cardToken ?? (await tokenFor(app, org.orgId, result.customerCardId))
        if (token) await app.redis.del(redisKeys.cardState(token))
        stampCounter.labels(source, 'ok').inc()

        await audit(app.db, {
          orgId: org.orgId,
          actorUserId: request.auth!.userId,
          action: AUDIT_ACTIONS.stampAdded,
          targetType: 'customer_card',
          targetId: result.customerCardId,
          meta: { stamps: result.stampsAdded, rewards: result.unlockedRewards.length, source },
          ip: request.ip,
        })

        return reply.status(201).send(result)
      } catch (error) {
        // Never leave a poisoned key behind: the staff member must be able to retry.
        await outcome.release()
        stampCounter.labels(source, 'rejected').inc()
        throw error
      }
    },
  )

  /** Undo a scan moments after making it: wrong customer, wrong count. */
  app.post(
    '/stamp/:eventId/void',
    {
      preHandler: [app.requireOrg('staff')],
      config: { rateLimit: rateLimits.stamp },
      schema: {
        params: z.object({ eventId: z.string().uuid() }),
        body: voidStampSchema,
        tags: ['loyalty'],
      },
    },
    async (request) => {
      const org = request.org!
      const { cardToken, ...result } = await voidStamp(app.db, {
        orgId: org.orgId,
        eventId: request.params.eventId,
        actorUserId: request.auth!.userId,
        isAdmin: org.role === 'admin' || org.role === 'owner',
        reason: request.body.reason,
      })
      await app.redis.del(redisKeys.cardState(cardToken))
      await audit(app.db, {
        orgId: org.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.stampVoided,
        targetType: 'customer_card',
        targetId: result.customerCardId,
        meta: {
          eventId: request.params.eventId,
          stamps: result.stampsRemoved,
          rewards: result.rewardsRevoked,
        },
        ip: request.ip,
      })
      return result
    },
  )

  /** The scanned card before stamping, so staff can pick the count or type the amount. */
  app.get(
    '/lookup',
    {
      preHandler: [app.requireOrg('staff')],
      schema: {
        querystring: z
          .object({
            cardToken: publicTokenSchema.optional(),
            customerCardId: z.string().uuid().optional(),
          })
          .refine((query) => Boolean(query.cardToken || query.customerCardId), {
            message: 'card_reference_required',
          }),
        tags: ['loyalty'],
      },
    },
    async (request) =>
      lookupCard(app.db, {
        orgId: request.org!.orgId,
        cardToken: request.query.cardToken,
        customerCardId: request.query.customerCardId,
      }),
  )

  /**
   * Sign-up at the counter, from the staff app. Unlike the public form there is no
   * captcha: the staff session is the credential, and every enrolment is audited.
   */
  app.post(
    '/enroll',
    {
      preHandler: [app.requireOrg('staff')],
      config: { rateLimit: rateLimits.join },
      schema: { body: staffEnrollSchema, tags: ['loyalty'] },
    },
    async (request, reply) => {
      const org = request.org!
      const outcome = await withIdempotency<StaffEnrollResult>(
        app.redis,
        `enroll:${org.orgId}`,
        request.body.idempotencyKey,
      )
      if (outcome.status === 'replayed') return outcome.result
      if (outcome.status === 'in_flight') {
        throw new AppError('CONFLICT', { message: 'this sign-up is already being processed' })
      }

      try {
        const { cardId, dataConsent, stampNow, locationId, idempotencyKey, ...data } = request.body
        const { card, org: organization } = await findActiveCardForOrg(app.db, org.orgId, cardId)
        const joined = await enrolOnCard(app.db, {
          card,
          org: organization,
          data: { ...data, answers: {} },
        })
        if (joined.isNew) await invalidateEntitlements(app.redis, org.orgId)

        // A rule refusing the first stamp (a cooldown on a returning customer) must not
        // undo the sign-up itself.
        const stamp = stampNow
          ? await applyStamp(app.db, {
              orgId: org.orgId,
              cardToken: joined.token,
              count: 1,
              locationId: org.locationId ?? locationId ?? null,
              actorUserId: request.auth!.userId,
              source: 'staff_scan',
              idempotencyKey: `enroll:${idempotencyKey}`,
            }).catch(() => null)
          : null

        await app.redis.del(redisKeys.cardState(joined.token))
        await audit(app.db, {
          orgId: org.orgId,
          actorUserId: request.auth!.userId,
          action: AUDIT_ACTIONS.customerEnrolled,
          targetType: 'customer',
          targetId: joined.customerId,
          // Habeas Data: who took the customer's consent, when and from where.
          meta: { cardId: card.id, isNew: joined.isNew, dataConsent, stamped: Boolean(stamp) },
          ip: request.ip,
        })

        const result: StaffEnrollResult = {
          customerId: joined.customerId,
          isNew: joined.isNew,
          cardToken: joined.token,
          cardUrl: `${env.PASS_URL}/c/${joined.token}`,
          walletPasses: {
            appleUrl: `${env.API_URL}/wallet/apple/pass/${joined.token}`,
            googleUrl: `${env.API_URL}/wallet/google/save/${joined.token}`,
          },
          stamp,
        }
        await outcome.commit(result)
        return reply.status(joined.isNew ? 201 : 200).send(result)
      } catch (error) {
        await outcome.release()
        throw error
      }
    },
  )

  /** "My scans today" in the staff app, with the ones that can still be undone. */
  app.get(
    '/activity/mine',
    {
      preHandler: [app.requireOrg('staff')],
      schema: {
        querystring: z.object({ since: z.coerce.date().optional() }),
        tags: ['loyalty'],
      },
    },
    async (request) => {
      const org = request.org!
      const now = new Date()
      const items = await myActivity(app.db, {
        orgId: org.orgId,
        userId: request.auth!.userId,
        since: request.query.since ?? startOfOrgDay(now, org.timezone),
        now,
      })
      return { items }
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
   * Polled every few seconds by the kiosk screen. Says when the last stamp went
   * through it, so the screen celebrates and shows a new code without waiting.
   */
  app.post(
    '/kiosk/status',
    {
      schema: {
        body: z.object({ sessionId: z.string().uuid(), secret: z.string().min(16) }),
        tags: ['kiosk'],
      },
    },
    async (request) => {
      await readKioskSession(app.redis, request.body.sessionId, request.body.secret)
      return { lastStamp: await readKioskLastStamp(app.redis, request.body.sessionId) }
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
        await recordKioskStamp(app.redis, payload.sessionId, {
          at: Date.now(),
          rewardUnlocked: result.unlockedRewards.length > 0,
        })
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
