import { type Database, and, eq, isNull, memberships, organizations, users } from '@volvia/db'
import {
  type Entitlements,
  type FeatureKey,
  type LimitKey,
  type Role,
  roleAtLeast,
} from '@volvia/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { loadEntitlements } from '../lib/entitlements'
import { AppError } from '../lib/errors'
import { verifyAccessToken } from '../lib/jwt'
import { redisKeys } from '../lib/redis'

export interface AuthContext {
  userId: string
  email: string
  sessionId: string
}

export interface OrgContext {
  orgId: string
  role: Role
  /** Non-null when the member is pinned to a single location. */
  locationId: string | null
  timezone: string
  entitlements: Entitlements
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
    org?: OrgContext
  }

  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    /** Resolves the organisation from the `x-org-id` header (or the user's only org). */
    requireOrg: (
      minimumRole?: Role,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireFeature: (
      feature: FeatureKey,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

function bearerFrom(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  // Browser clients use an httpOnly cookie; native/API clients use the header.
  const cookie = request.cookies?.volvia_access
  return cookie ?? null
}

async function resolveMembership(
  db: Database,
  userId: string,
  requestedOrgId: string | null,
): Promise<{ orgId: string; role: Role; locationId: string | null; timezone: string }> {
  const rows = await db
    .select({
      orgId: memberships.orgId,
      role: memberships.role,
      locationId: memberships.locationId,
      timezone: organizations.timezone,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(
      requestedOrgId
        ? and(
            eq(memberships.userId, userId),
            eq(memberships.orgId, requestedOrgId),
            isNull(organizations.deletedAt),
          )
        : and(eq(memberships.userId, userId), isNull(organizations.deletedAt)),
    )

  if (rows.length === 0) {
    throw new AppError('NOT_A_MEMBER', { message: 'no access to this organization' })
  }
  // Without an explicit header, only an unambiguous single membership is accepted.
  if (!requestedOrgId && rows.length > 1) {
    throw new AppError('VALIDATION_FAILED', {
      message: 'x-org-id header required: user belongs to multiple organizations',
    })
  }
  return rows[0]!
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('requireAuth', async (request: FastifyRequest) => {
    const token = bearerFrom(request)
    if (!token) throw new AppError('UNAUTHENTICATED', { message: 'missing access token' })

    let claims: Awaited<ReturnType<typeof verifyAccessToken>>
    try {
      claims = await verifyAccessToken(token)
    } catch {
      throw new AppError('TOKEN_EXPIRED', { message: 'invalid or expired access token' })
    }

    // A revoked session must stop working immediately, not at token expiry.
    const alive = await app.redis.exists(redisKeys.session(claims.sid))
    if (!alive) throw new AppError('UNAUTHENTICATED', { message: 'session revoked' })

    const [user] = await app.db
      .select({ id: users.id, tokenVersion: users.tokenVersion, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, claims.sub))
      .limit(1)

    if (!user || user.deletedAt)
      throw new AppError('UNAUTHENTICATED', { message: 'account unavailable' })
    if (user.tokenVersion !== claims.tv) {
      throw new AppError('TOKEN_EXPIRED', { message: 'credentials changed, sign in again' })
    }

    request.auth = { userId: claims.sub, email: claims.email, sessionId: claims.sid }
  })

  app.decorate('requireOrg', (minimumRole: Role = 'staff') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) await app.requireAuth(request, reply)
      const userId = request.auth!.userId

      const header = request.headers['x-org-id']
      const requestedOrgId = typeof header === 'string' && header.length > 0 ? header : null

      const membership = await resolveMembership(app.db, userId, requestedOrgId)
      if (!roleAtLeast(membership.role, minimumRole)) {
        throw new AppError('FORBIDDEN', { message: `requires role ${minimumRole} or higher` })
      }

      const entitlements = await loadEntitlements(app.db, app.redis, membership.orgId)
      request.org = { ...membership, entitlements }
    }
  })

  app.decorate('requireFeature', (feature: FeatureKey) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.org) await app.requireOrg('staff')(request, reply)
      const org = request.org!
      if (!org.entitlements.has(feature)) {
        throw new AppError('FEATURE_NOT_IN_PLAN', {
          message: `feature ${feature} is not included in your plan`,
          upgradeTo: org.entitlements.upgradeForFeature(feature) ?? undefined,
        })
      }
    }
  })
})

/** Throws the standard 402 when a plan limit would be exceeded. */
export function assertWithinLimit(
  entitlements: Entitlements,
  key: LimitKey,
  current: number,
  adding = 1,
): void {
  if (entitlements.allows(key, current, adding)) return
  throw new AppError('PLAN_LIMIT_REACHED', {
    message: `plan limit reached for ${key}`,
    upgradeTo: entitlements.upgradeForLimit(key, current + adding) ?? undefined,
  })
}
