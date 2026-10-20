import { deviceApproveSchema, devicePollSchema, deviceStartResultSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { AppError } from '../../lib/errors'
import { redisKeys } from '../../lib/redis'
import { generateCode, hashToken, randomToken } from '../../lib/tokens'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import { issueSession } from './issue'

const DEVICE_CODE_TTL_SECONDS = 600
const POLL_INTERVAL_SECONDS = 3

interface DeviceGrant {
  pollHash: string
  userAgent: string
  approvedBy: { userId: string; email: string } | null
}

/** "KQ7RM2XW" reads better as "KQ7R-M2XW" when someone has to compare it by eye. */
const display = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`

/**
 * Signing a device in without typing a password on it — the browser extension, for
 * people who use Google or Apple. The extension asks for a code, the person approves
 * it in the dashboard where they are already signed in, and the extension collects a
 * session of its own exactly once. Nothing is stored in Postgres: an unapproved code
 * simply expires out of Redis.
 */
export async function deviceAuthRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.post(
    '/start',
    {
      config: { rateLimit: rateLimits.auth },
      schema: { response: { 200: deviceStartResultSchema }, tags: ['auth'] },
    },
    async (request) => {
      const userCode = generateCode(8)
      const pollToken = randomToken(32)
      const grant: DeviceGrant = {
        pollHash: hashToken(pollToken),
        userAgent: String(request.headers['user-agent'] ?? '').slice(0, 200),
        approvedBy: null,
      }
      await app.redis.set(
        redisKeys.deviceCode(userCode),
        JSON.stringify(grant),
        'EX',
        DEVICE_CODE_TTL_SECONDS,
      )
      await app.redis.set(
        redisKeys.devicePoll(grant.pollHash),
        userCode,
        'EX',
        DEVICE_CODE_TTL_SECONDS,
      )
      return {
        userCode: display(userCode),
        pollToken,
        expiresIn: DEVICE_CODE_TTL_SECONDS,
        interval: POLL_INTERVAL_SECONDS,
      }
    },
  )

  app.post(
    '/approve',
    {
      preHandler: [app.requireAuth],
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: deviceApproveSchema,
        response: { 200: z.object({ approved: z.literal(true) }) },
        tags: ['auth'],
      },
    },
    async (request) => {
      const key = redisKeys.deviceCode(request.body.userCode)
      const raw = await app.redis.get(key)
      if (!raw) throw new AppError('NOT_FOUND', { message: 'code expired or unknown' })

      const grant = JSON.parse(raw) as DeviceGrant
      if (grant.approvedBy) throw AppError.conflict('code already approved')

      grant.approvedBy = { userId: request.auth!.userId, email: request.auth!.email }
      // KEEPTTL: approving must not give the code a fresh ten minutes.
      await app.redis.set(key, JSON.stringify(grant), 'KEEPTTL')
      return { approved: true as const }
    },
  )

  app.post(
    '/poll',
    {
      // The extension polls every few seconds for up to ten minutes.
      config: { rateLimit: rateLimits.stamp },
      schema: { body: devicePollSchema, tags: ['auth'] },
    },
    async (request, reply) => {
      const pollHash = hashToken(request.body.pollToken)
      const userCode = await app.redis.get(redisKeys.devicePoll(pollHash))
      const raw = userCode ? await app.redis.get(redisKeys.deviceCode(userCode)) : null
      if (!userCode || !raw) {
        throw new AppError('TOKEN_EXPIRED', { message: 'code expired, start again' })
      }

      const grant = JSON.parse(raw) as DeviceGrant
      if (grant.pollHash !== pollHash) {
        throw new AppError('TOKEN_EXPIRED', { message: 'code expired, start again' })
      }
      if (!grant.approvedBy) return reply.status(202).send({ status: 'pending' })

      // Whoever deletes the code is the one poll that gets the session; a racing
      // second poll finds nothing and is told to start again.
      const claimed = await app.redis.del(redisKeys.deviceCode(userCode))
      await app.redis.del(redisKeys.devicePoll(pollHash))
      if (claimed !== 1) {
        throw new AppError('TOKEN_EXPIRED', { message: 'code already used' })
      }

      const meta = { ip: request.ip, userAgent: grant.userAgent }
      const session = await issueSession(
        { db: app.db, redis: app.redis },
        grant.approvedBy.userId,
        grant.approvedBy.email,
        meta,
      )
      await audit(app.db, {
        actorUserId: grant.approvedBy.userId,
        action: AUDIT_ACTIONS.authLogin,
        ip: request.ip,
        userAgent: meta.userAgent,
        meta: { provider: 'device_code' },
      })
      return session
    },
  )
}
