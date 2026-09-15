import { and, eq, inArray, profileQuestions, stampCards } from '@volvia/db'
import { joinCardSchema, publicCardStateSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { z } from 'zod'
import { env } from '../../env'
import { invalidateEntitlements } from '../../lib/entitlements'
import { AppError } from '../../lib/errors'
import { redisKeys } from '../../lib/redis'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import { joinCard } from '../loyalty/service'
import { loadBusinessPage, loadJoinPage, loadPublicCardState } from './service'

/** Public reads are cached briefly; every write path deletes the key explicitly. */
const CARD_CACHE_SECONDS = 30
const PAGE_CACHE_SECONDS = 120

export async function publicRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/join/:joinSlug',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: { params: z.object({ joinSlug: z.string().min(4).max(48) }), tags: ['public'] },
    },
    async (request, reply) => {
      const page = await loadJoinPage(app.db, request.params.joinSlug)

      // The card may ask a couple of extra questions at signup.
      const questions =
        page.card.signupQuestionIds.length > 0
          ? await app.db
              .select({
                id: profileQuestions.id,
                prompt: profileQuestions.prompt,
                type: profileQuestions.type,
                options: profileQuestions.options,
                isRequired: profileQuestions.isRequired,
              })
              .from(profileQuestions)
              .where(
                and(
                  inArray(profileQuestions.id, page.card.signupQuestionIds),
                  eq(profileQuestions.isActive, true),
                ),
              )
          : []

      reply.header('cache-control', `public, max-age=${PAGE_CACHE_SECONDS}`)
      return { ...page, questions }
    },
  )

  app.post(
    '/join/:joinSlug',
    {
      // Tight limit: this is the one public endpoint that writes.
      config: { rateLimit: rateLimits.join },
      schema: {
        params: z.object({ joinSlug: z.string().min(4).max(48) }),
        body: joinCardSchema,
        tags: ['public'],
      },
    },
    async (request, reply) => {
      const throttleKey = redisKeys.joinThrottle(request.params.joinSlug, request.ip)
      const attempts = await app.redis.incr(throttleKey)
      if (attempts === 1) await app.redis.expire(throttleKey, 600)
      // One device signing up many people is normal at a counter, but not 15 times.
      if (attempts > 15) {
        throw new AppError('RATE_LIMITED', { message: 'too many signups from this device' })
      }

      const result = await joinCard(app.db, {
        joinSlug: request.params.joinSlug,
        data: request.body,
        ip: request.ip,
      })

      // A new customer moves the premium-trial gate, so cached entitlements must go.
      if (result.isNew) {
        const [card] = await app.db
          .select({ orgId: stampCards.orgId })
          .from(stampCards)
          .where(eq(stampCards.joinSlug, request.params.joinSlug))
          .limit(1)
        if (card) await invalidateEntitlements(app.redis, card.orgId)
      }

      return reply.status(201).send(result)
    },
  )

  app.get(
    '/card/:token',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: {
        params: z.object({ token: z.string().min(16).max(128) }),
        response: { 200: publicCardStateSchema },
        tags: ['public'],
      },
    },
    async (request, reply) => {
      const key = redisKeys.cardState(request.params.token)
      const cached = await app.redis.get(key)
      if (cached) {
        reply.header('x-cache', 'hit')
        return publicCardStateSchema.parse(JSON.parse(cached))
      }

      const state = await loadPublicCardState(app.db, request.params.token)
      await app.redis.set(key, JSON.stringify(state), 'EX', CARD_CACHE_SECONDS)
      reply.header('x-cache', 'miss')
      return state
    },
  )

  /**
   * QR rendering for links the platform itself generates (currently the kiosk's
   * rotating code). Restricted to our own URLs so this cannot be used as an open
   * QR generator pointing anywhere.
   */
  app.get(
    '/qr',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: {
        querystring: z.object({
          data: z.string().min(4).max(400),
          size: z.coerce.number().int().min(128).max(1024).default(512),
        }),
        tags: ['public'],
      },
    },
    async (request, reply) => {
      const allowed = [env.PASS_URL, env.APP_URL, env.WEB_URL]
      if (!allowed.some((prefix) => request.query.data.startsWith(prefix))) {
        throw new AppError('FORBIDDEN', { message: 'only Volvia links can be encoded here' })
      }

      const svg = await QRCode.toString(request.query.data, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        width: request.query.size,
        color: { dark: '#10120F', light: '#FFFFFF' },
      })

      return (
        reply
          .header('content-type', 'image/svg+xml')
          // The kiosk nonce rotates every 30 seconds; nothing here may be cached.
          .header('cache-control', 'no-store')
          .send(svg)
      )
    },
  )

  app.get(
    '/business/:slug',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: { params: z.object({ slug: z.string().min(2).max(64) }), tags: ['public'] },
    },
    async (request, reply) => {
      const key = redisKeys.businessPage(request.params.slug)
      const cached = await app.redis.get(key)
      if (cached) {
        reply.header('cache-control', `public, max-age=${PAGE_CACHE_SECONDS}`)
        return JSON.parse(cached)
      }

      const page = await loadBusinessPage(app.db, request.params.slug)
      await app.redis.set(key, JSON.stringify(page), 'EX', PAGE_CACHE_SECONDS)
      reply.header('cache-control', `public, max-age=${PAGE_CACHE_SECONDS}`)
      return page
    },
  )
}
