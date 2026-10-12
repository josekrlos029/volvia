import {
  changePasswordSchema,
  loginSchema,
  magicLinkRequestSchema,
  nativeAppleSignInSchema,
  nativeGoogleSignInSchema,
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
import {
  appleConfigured,
  buildAppleAuthorizeUrl,
  exchangeAppleCode,
  parseAppleUserField,
  verifyNativeAppleToken,
} from './apple'
import { clearAuthCookies, cookieNames, setAuthCookies } from './cookies'
import {
  buildAuthorizeUrl,
  consumeState,
  exchangeCodeForProfile,
  googleConfigured,
  verifyNativeGoogleToken,
} from './google'
import { issueSession as issueUserSession } from './issue'
import {
  type IdentityLink,
  buildSessionUser,
  consumeAuthToken,
  findUserByEmail,
  issueAuthToken,
  markEmailVerified,
  registerOwner,
  setPassword,
  verifyCredentials,
} from './service'
import { readSession, revokeAllSessions, revokeSession, rotateSession } from './sessions'
import { type SocialOutcome, type SocialSignupPayload, resolveSocialProfile } from './social'

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

      // Arriving from Google or Apple: the token carries the identity and the address
      // the provider vouched for. The form cannot pick a different email than that one,
      // or the social sign-in would be a way to skip verification for any address.
      let input = request.body
      let social: IdentityLink | undefined
      if (input.socialToken) {
        const row = await consumeAuthToken(app.db, input.socialToken, 'social_signup')
        const payload = row.payload as Partial<SocialSignupPayload>
        if (!row.email || !payload.provider || !payload.sub) {
          throw new AppError('TOKEN_EXPIRED', { message: 'link is invalid' })
        }
        input = { ...input, email: row.email }
        social = {
          provider: payload.provider,
          providerUserId: payload.sub,
          profile: { name: payload.name ?? null, picture: payload.picture ?? null },
        }
      }

      const { user } = await registerOwner(app.db, input, meta, social)

      if (!social) {
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
      }

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

  // ── Google / Apple ─────────────────────────────────────────────────────────
  //
  // Web: the API owns the client secrets and the state nonce, so the dashboard just
  // navigates to /start and lands back on the dashboard with cookies set. Native: the
  // app shows the platform sheet and hands us the ID token to verify.

  /** Where the dashboard lands when a social sign-in cannot finish. */
  const loginWithError = (reply: Parameters<typeof setAuthCookies>[0], code: string) => {
    const url = new URL('/login', env.APP_URL)
    url.searchParams.set('error', code)
    return reply.redirect(url.toString(), 302)
  }

  const finishWebSignIn = async (
    request: { ip: string; headers: Record<string, unknown> },
    reply: Parameters<typeof setAuthCookies>[0],
    outcome: SocialOutcome,
    provider: 'google' | 'apple',
    redirectTo: string,
  ) => {
    if (outcome.kind === 'signup') {
      // An identity but no business yet, and nothing to create a tenant from. The signup
      // form takes the business name; the token links the identity when it submits.
      const signup = new URL('/signup', env.APP_URL)
      signup.searchParams.set('social', outcome.token)
      signup.searchParams.set('email', outcome.email)
      signup.searchParams.set('from', provider)
      if (outcome.name) signup.searchParams.set('name', outcome.name)
      return reply.redirect(signup.toString(), 302)
    }

    const meta = { ip: request.ip, userAgent: String(request.headers['user-agent'] ?? '') }
    await markEmailVerified(app.db, outcome.user.id)
    const session = await issueSession(outcome.user.id, outcome.user.email, meta)
    await audit(app.db, {
      actorUserId: outcome.user.id,
      action: AUDIT_ACTIONS.authLogin,
      ip: request.ip,
      userAgent: meta.userAgent,
      meta: { provider },
    })
    setAuthCookies(reply, session)

    const target = new URL(redirectTo || '/', env.APP_URL)
    return reply.redirect(target.toString(), 302)
  }

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
        querystring: z.object({
          code: z.string().min(1).optional(),
          state: z.string().min(1),
          error: z.string().optional(),
        }),
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      if (!googleConfigured()) return loginWithError(reply, 'SERVICE_UNAVAILABLE')
      const { redirectTo } = await consumeState(app.redis, request.query.state, 'google')
      if (!request.query.code) return reply.redirect(new URL('/login', env.APP_URL).toString(), 302)

      try {
        const profile = await exchangeCodeForProfile(request.query.code)
        const outcome = await resolveSocialProfile(app.db, profile, {
          allowSignup: true,
          ip: request.ip,
        })
        return await finishWebSignIn(request, reply, outcome, 'google', redirectTo)
      } catch (error) {
        if (error instanceof AppError) return loginWithError(reply, error.code)
        throw error
      }
    },
  )

  app.get(
    '/apple/start',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        querystring: z.object({ redirectTo: z.string().max(300).optional() }),
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const url = await buildAppleAuthorizeUrl(app.redis, { redirectTo: request.query.redirectTo })
      return reply.redirect(url, 302)
    },
  )

  // Apple answers with a cross-site form POST. The state nonce in Redis is the CSRF
  // check; cookies set on this response still reach the dashboard afterwards.
  app.post(
    '/apple/callback',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: z.object({
          code: z.string().min(1).optional(),
          state: z.string().min(1),
          user: z.string().max(2000).optional(),
          error: z.string().optional(),
        }),
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      if (!appleConfigured()) return loginWithError(reply, 'SERVICE_UNAVAILABLE')
      const { redirectTo } = await consumeState(app.redis, request.body.state, 'apple')
      // `user_cancelled_authorize`: they closed the sheet. Not an error worth showing.
      if (!request.body.code) return reply.redirect(new URL('/login', env.APP_URL).toString(), 302)

      try {
        const profile = await exchangeAppleCode(request.body.code)
        const outcome = await resolveSocialProfile(app.db, profile, {
          allowSignup: true,
          ip: request.ip,
          nameHint: parseAppleUserField(request.body.user).name,
        })
        return await finishWebSignIn(request, reply, outcome, 'apple', redirectTo)
      } catch (error) {
        if (error instanceof AppError) return loginWithError(reply, error.code)
        throw error
      }
    },
  )

  const nativeSignIn = async (
    request: { ip: string; headers: Record<string, unknown> },
    reply: Parameters<typeof setAuthCookies>[0],
    outcome: SocialOutcome,
    provider: 'google' | 'apple',
  ) => {
    if (outcome.kind !== 'user') throw new AppError('ACCOUNT_NOT_FOUND')
    const meta = { ip: request.ip, userAgent: String(request.headers['user-agent'] ?? '') }
    await markEmailVerified(app.db, outcome.user.id)
    const session = await issueSession(outcome.user.id, outcome.user.email, meta)
    await audit(app.db, {
      actorUserId: outcome.user.id,
      action: AUDIT_ACTIONS.authLogin,
      ip: request.ip,
      userAgent: meta.userAgent,
      meta: { provider, native: true },
    })
    setAuthCookies(reply, session)
    return session
  }

  app.post(
    '/apple/native',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: nativeAppleSignInSchema,
        response: { 200: tokenPairSchema },
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const profile = await verifyNativeAppleToken(request.body.identityToken)
      const outcome = await resolveSocialProfile(app.db, profile, {
        allowSignup: false,
        ip: request.ip,
        nameHint: request.body.name,
      })
      return nativeSignIn(request, reply, outcome, 'apple')
    },
  )

  app.post(
    '/google/native',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: nativeGoogleSignInSchema,
        response: { 200: tokenPairSchema },
        tags: ['auth'],
      },
    },
    async (request, reply) => {
      const profile = await verifyNativeGoogleToken(request.body.idToken)
      const outcome = await resolveSocialProfile(app.db, profile, {
        allowSignup: false,
        ip: request.ip,
      })
      return nativeSignIn(request, reply, outcome, 'google')
    },
  )
}
