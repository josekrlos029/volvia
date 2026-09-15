import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { env, isProduction } from '../env'

/**
 * Baseline hardening. Route-specific limits (scan, join, auth) are tighter and declared
 * on the routes themselves; this is the floor everything sits on.
 */
export const securityPlugin = fp(async (app: FastifyInstance) => {
  await app.register(helmet, {
    // The API serves JSON and signed pass files, never HTML with inline scripts.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      // Same-origin, curl and wallet devices send no Origin header.
      if (!origin) return callback(null, true)
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true)
      callback(new Error('origin not allowed'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-org-id', 'x-idempotency-key'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  })

  await app.register(cookie, {
    secret: env.JWT_ACCESS_SECRET,
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
    },
  })

  await app.register(rateLimit, {
    global: env.RATE_LIMIT_ENABLED,
    max: 300,
    timeWindow: '1 minute',
    // Shared across instances, so limits hold when Cloud Run scales out.
    redis: app.redis,
    nameSpace: 'rl:global:',
    keyGenerator: (request) => {
      const auth = request.auth?.userId
      return auth ? `u:${auth}` : `ip:${request.ip}`
    },
  })
})

/** Tight, per-route limits for the endpoints that are worth abusing. */
/**
 * Per-route limits. When rate limiting is switched off the route configs become
 * `false`, which is how the plugin expects a route to opt out entirely.
 */
const limit = <T>(config: T) => (env.RATE_LIMIT_ENABLED ? config : false)

export const rateLimits = {
  auth: limit({ max: 20, timeWindow: '5 minutes' }),
  /**
   * Sign-in. Keyed by IP *and* email so a shared office or café IP cannot lock out
   * everyone, while an attacker grinding one account is still stopped quickly.
   */
  login: limit({
    max: 10,
    timeWindow: '15 minutes',
    keyGenerator: (request: { ip: string; body?: unknown }) => {
      const email = (request.body as { email?: string } | undefined)?.email ?? ''
      return `${request.ip}:${email.toLowerCase()}`
    },
  }),
  /** Endpoints that send email: strict, because abuse costs reputation, not just CPU. */
  authStrict: limit({ max: 5, timeWindow: '15 minutes' }),
  join: limit({ max: 20, timeWindow: '10 minutes' }),
  stamp: limit({ max: 120, timeWindow: '1 minute' }),
  publicRead: limit({ max: 120, timeWindow: '1 minute' }),
  upload: limit({ max: 30, timeWindow: '10 minutes' }),
} as const
