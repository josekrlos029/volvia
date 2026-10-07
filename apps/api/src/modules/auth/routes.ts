import {
  changePasswordSchema,
  loginSchema,
  magicLinkRequestSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
  sessionUserSchema,
  tokenConsumeSchema,
} from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../env'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { magicLinkTemplate, passwordResetTemplate, verifyEmailTemplate } from '../../lib/email'
import { AppError } from '../../lib/errors'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import { clearAuthCookies, cookieNames, setAuthCookies } from './cookies'
import { buildAuthorizeUrl, consumeState, exchangeCodeForProfile, googleConfigured } from './google'
import { issueSession as issueUserSession } from './issue'
import {
  buildSessionUser,
  consumeAuthToken,
  findUserByEmail,
  findUserByGoogleId,
  issueAuthToken,
  linkGoogleIdentity,
  markEmailVerified,
  registerOwner,
  setPassword,
  verifyCredentials,
} from './service'
import { readSession, revokeAllSessions, revokeSession, rotateSession } from './sessions'

const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: sessionUserSchema,
})

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  /** Every entry point issues sessions through the one shared helper. */
  const issueSession = (userId: string, email: string, meta: { ip: string; userAgent: string }) =>
    issueUserSession(app, userId, email, meta)

  app.post(
    '/register',
    {
      config: { rateLimit: rateLimits.auth },
      schema: { body: registerSchema, response: { 201: tokenPairSchema }, tags: ['auth'] },
    },
    async (request, reply) => {
      const meta = { ip: request.ip, userAgent: request.headers['user-agent'] ?? '' }
      const { user } = await registerOwner(app.db, request.body, meta)

      const { token } = await issueAuthToken(app.db, {
        purpose: 'email_verification',
        userId: user.id,
        email: user.email,
        ip: request.ip,
      })
      await app.mailer.send({
        to: user.email,
        template: verifyEmailTemplate(user.locale, `${env.APP_URL}/verify-email?token=${token}`),
      })

      const session = await issueSession(user.id, user.email, meta)
      setAuthCookies(reply, session)
      return reply.status(201).send(session)
    },
  )

  app.post(
    '/login',
    {
      config: { rateLimit: rateLimits.login },
      schema: { body: loginSchema, response: { 200: tokenPairSchema }, tags: ['auth'] },
    },
    async (request, reply) => {
      const meta = { ip: request.ip, userAgent: request.headers['user-agent'] ?? '' }
      let user: Awaited<ReturnType<typeof verifyCredentials>>
      try {
        user = await verifyCredentials(app.db, request.body.email, request.body.password)
      } catch (error) {
        await audit(app.db, {
          action: AUDIT_ACTIONS.authLoginFailed,
          actorType: 'user',
          ip: request.ip,
          userAgent: meta.userAgent,
        })
        throw error
      }

      const session = await issueSession(user.id, user.email, meta)
      await audit(app.db, {
        actorUserId: user.id,
        action: AUDIT_ACTIONS.authLogin,
        ip: request.ip,
        userAgent: meta.userAgent,
      })
      setAuthCookies(reply, session)
      return session
    },
  )

  app.post(
    '/refresh',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: z.object({ refreshToken: z.string().optional() }).optional(),
        response: { 200: tokenPairSchema },
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const provided = request.body?.refreshToken ?? request.cookies?.[cookieNames.refresh]
      if (!provided) throw new AppError('UNAUTHENTICATED', { message: 'missing refresh token' })

      let claims: Awaited<ReturnType<typeof verifyRefreshToken>>
      try {
        claims = await verifyRefreshToken(provided)
      } catch {
        throw new AppError('TOKEN_EXPIRED', { message: 'refresh token invalid or expired' })
      }

      const record = await readSession(app.redis, claims.sid)
      if (!record) throw new AppError('UNAUTHENTICATED', { message: 'session no longer exists' })

      // An older generation means the token was replayed — assume theft and burn
      // every session this user holds rather than quietly issuing a new pair.
      if (claims.gen !== record.gen) {
        await revokeAllSessions(app.redis, record.userId)
        await audit(app.db, {
          actorUserId: record.userId,
          action: AUDIT_ACTIONS.authRefreshReuse,
          ip: request.ip,
          meta: { sessionId: claims.sid },
        })
        clearAuthCookies(reply)
        throw new AppError('TOKEN_REUSED', {
          message: 'refresh token reuse detected, sign in again',
        })
      }

      const nextGen = await rotateSession(app.redis, claims.sid, record)
      const user = await buildSessionUser(app.db, record.userId)
      const accessToken = await signAccessToken({
        sub: record.userId,
        email: user.email,
        tv: claims.tv,
        sid: claims.sid,
      })
      const refreshToken = await signRefreshToken({
        sub: record.userId,
        sid: claims.sid,
        gen: nextGen,
        tv: claims.tv,
      })

      const payload = { accessToken, refreshToken, expiresIn: 900, user }
      setAuthCookies(reply, payload)
      return payload
    },
  )

  app.post(
    '/logout',
    { schema: { response: { 204: z.null() }, tags: ['auth'] }, preHandler: [app.requireAuth] },
    async (request, reply) => {
      await revokeSession(app.redis, request.auth!.userId, request.auth!.sessionId)
      clearAuthCookies(reply)
      return reply.status(204).send(null)
    },
  )

  app.post(
    '/logout-all',
    {
      schema: { response: { 200: z.object({ revoked: z.number() }) }, tags: ['auth'] },
      preHandler: [app.requireAuth],
    },
    async (request, reply) => {
      const revoked = await revokeAllSessions(app.redis, request.auth!.userId)
      clearAuthCookies(reply)
      return { revoked }
    },
  )

  app.get(
    '/me',
    {
      schema: { response: { 200: sessionUserSchema }, tags: ['auth'] },
      preHandler: [app.requireAuth],
    },
    async (request) => buildSessionUser(app.db, request.auth!.userId),
  )

  // ── Magic link ─────────────────────────────────────────────────────────────
  app.post(
    '/magic-link',
    {
      config: { rateLimit: rateLimits.authStrict },
      schema: {
        body: magicLinkRequestSchema,
        response: { 202: z.object({ sent: z.boolean() }) },
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const user = await findUserByEmail(app.db, request.body.email)
      // Always answer the same way: this endpoint must not reveal who has an account.
      if (user) {
        const { token } = await issueAuthToken(app.db, {
          purpose: 'magic_link',
          userId: user.id,
          email: user.email,
          payload: { redirectTo: request.body.redirectTo ?? '' },
          ip: request.ip,
        })
        await app.mailer.send({
          to: user.email,
          template: magicLinkTemplate(
            request.body.locale ?? user.locale,
            `${env.APP_URL}/magic?token=${token}`,
          ),
        })
      }
      return reply.status(202).send({ sent: true })
    },
  )

  app.post(
    '/magic-link/consume',
    {
      config: { rateLimit: rateLimits.auth },
      schema: { body: tokenConsumeSchema, response: { 200: tokenPairSchema }, tags: ['auth'] },
    },
    async (request, reply) => {
      const row = await consumeAuthToken(app.db, request.body.token, 'magic_link')
      if (!row.userId) throw new AppError('TOKEN_EXPIRED', { message: 'link is invalid' })

      // Following a link from their inbox proves the address works.
      await markEmailVerified(app.db, row.userId)

      const user = await buildSessionUser(app.db, row.userId)
      const session = await issueSession(row.userId, user.email, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
      })
      setAuthCookies(reply, session)
      return session
    },
  )

  // ── Email verification ─────────────────────────────────────────────────────
  app.post(
    '/verify-email/send',
    {
      config: { rateLimit: rateLimits.authStrict },
      schema: { response: { 202: z.object({ sent: z.boolean() }) }, tags: ['auth'] },
      preHandler: [app.requireAuth],
    },
    async (request, reply) => {
      const user = await buildSessionUser(app.db, request.auth!.userId)
      if (user.emailVerified) return reply.status(202).send({ sent: false })

      const { token } = await issueAuthToken(app.db, {
        purpose: 'email_verification',
        userId: user.id,
        email: user.email,
        ip: request.ip,
      })
      await app.mailer.send({
        to: user.email,
        template: verifyEmailTemplate(user.locale, `${env.APP_URL}/verify-email?token=${token}`),
      })
      return reply.status(202).send({ sent: true })
    },
  )

  app.post(
    '/verify-email/consume',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: tokenConsumeSchema,
        response: { 200: z.object({ verified: z.boolean() }) },
        tags: ['auth'],
      },
    },
    async (request) => {
      const row = await consumeAuthToken(app.db, request.body.token, 'email_verification')
      if (!row.userId) throw new AppError('TOKEN_EXPIRED', { message: 'link is invalid' })
      await markEmailVerified(app.db, row.userId)
      return { verified: true }
    },
  )

  // ── Password reset ─────────────────────────────────────────────────────────
  app.post(
    '/password-reset/request',
    {
      config: { rateLimit: rateLimits.authStrict },
      schema: {
        body: passwordResetRequestSchema,
        response: { 202: z.object({ sent: z.boolean() }) },
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const user = await findUserByEmail(app.db, request.body.email)
      if (user) {
        const { token } = await issueAuthToken(app.db, {
          purpose: 'password_reset',
          userId: user.id,
          email: user.email,
          ip: request.ip,
        })
        await app.mailer.send({
          to: user.email,
          template: passwordResetTemplate(
            request.body.locale ?? user.locale,
            `${env.APP_URL}/reset-password?token=${token}`,
          ),
        })
      }
      return reply.status(202).send({ sent: true })
    },
  )

  app.post(
    '/password-reset/confirm',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: passwordResetSchema,
        response: { 200: z.object({ reset: z.boolean() }) },
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const row = await consumeAuthToken(app.db, request.body.token, 'password_reset')
      if (!row.userId) throw new AppError('TOKEN_EXPIRED', { message: 'link is invalid' })

      await setPassword(app.db, row.userId, request.body.password)
      // A reset is also the remedy for a compromised account: drop every session.
      await revokeAllSessions(app.redis, row.userId)
      await audit(app.db, {
        actorUserId: row.userId,
        action: AUDIT_ACTIONS.authPasswordReset,
        ip: request.ip,
      })
      clearAuthCookies(reply)
      return { reset: true }
    },
  )

  app.post(
    '/password/change',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: changePasswordSchema,
        response: { 200: z.object({ changed: z.boolean() }) },
        tags: ['auth'],
      },
      preHandler: [app.requireAuth],
    },
    async (request, reply) => {
      const user = await buildSessionUser(app.db, request.auth!.userId)
      await verifyCredentials(app.db, user.email, request.body.currentPassword)
      await setPassword(app.db, user.id, request.body.newPassword)
      await revokeAllSessions(app.redis, user.id)
      clearAuthCookies(reply)
      return { changed: true }
    },
  )

  // ── Google OAuth ───────────────────────────────────────────────────────────
  app.get(
    '/google/start',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        querystring: z.object({ redirectTo: z.string().max(300).optional() }),
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const url = await buildAuthorizeUrl(app.redis, { redirectTo: request.query.redirectTo })
      return reply.redirect(url, 302)
    },
  )

  app.get(
    '/google/callback',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        querystring: z.object({ code: z.string().min(1), state: z.string().min(1) }),
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      if (!googleConfigured()) {
        throw new AppError('SERVICE_UNAVAILABLE', { message: 'Google sign-in is not configured' })
      }
      const { redirectTo } = await consumeState(app.redis, request.query.state)
      const profile = await exchangeCodeForProfile(request.query.code)
      if (!profile.emailVerified) {
        throw new AppError('FORBIDDEN', { message: 'google account email is not verified' })
      }

      let user = await findUserByGoogleId(app.db, profile.sub)
      if (!user) {
        // Link to an existing local account with the same address rather than
        // creating a duplicate business.
        const existing = await findUserByEmail(app.db, profile.email)
        if (!existing) {
          // Google gives us an identity but not a business name, so there is nothing to
          // create a tenant from. Send them to signup with the address filled in; the
          // Google identity links itself the next time they use this button.
          const signup = new URL('/signup', env.APP_URL)
          signup.searchParams.set('email', profile.email)
          signup.searchParams.set('from', 'google')
          if (profile.name) signup.searchParams.set('name', profile.name)
          return reply.redirect(signup.toString(), 302)
        }
        await linkGoogleIdentity(app.db, {
          userId: existing.id,
          providerUserId: profile.sub,
          profile: { name: profile.name, picture: profile.picture },
        })
        user = existing
      }

      await markEmailVerified(app.db, user.id)
      const session = await issueSession(user.id, user.email, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
      })
      setAuthCookies(reply, session)

      const target = new URL(redirectTo || '/', env.APP_URL)
      return reply.redirect(target.toString(), 302)
    },
  )
}
