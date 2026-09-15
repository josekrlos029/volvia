import { type Database, eq, organizations, subscriptions } from '@volvia/db'
import { type Entitlements, resolveEntitlements } from '@volvia/shared'
import { type RedisClient, redisKeys } from './redis'

const CACHE_TTL_SECONDS = 60

interface CachedShape {
  plan: Parameters<typeof resolveEntitlements>[0]['plan']
  subscriptionActive: boolean
  totalCustomers: number
  extraLocations: number
}

/**
 * Loads what an organisation may do. Cached briefly because it is read on nearly every
 * authenticated request; billing webhooks and customer joins invalidate it explicitly,
 * so the TTL is only a backstop.
 */
export async function loadEntitlements(
  db: Database,
  redis: RedisClient,
  orgId: string,
): Promise<Entitlements> {
  const key = redisKeys.entitlements(orgId)
  const cached = await redis.get(key)
  if (cached) {
    try {
      return resolveEntitlements(JSON.parse(cached) as CachedShape)
    } catch {
      // fall through and reload
    }
  }

  const [org] = await db
    .select({
      plan: organizations.plan,
      subscriptionStatus: organizations.subscriptionStatus,
      customerCount: organizations.customerCount,
      extraLocations: organizations.extraLocations,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) throw new Error(`organization_not_found:${orgId}`)

  const shape: CachedShape = {
    plan: org.plan,
    subscriptionActive:
      org.subscriptionStatus === 'active' || org.subscriptionStatus === 'trialing',
    totalCustomers: org.customerCount,
    extraLocations: org.extraLocations,
  }

  await redis.set(key, JSON.stringify(shape), 'EX', CACHE_TTL_SECONDS)
  return resolveEntitlements(shape)
}

export async function invalidateEntitlements(redis: RedisClient, orgId: string): Promise<void> {
  await redis.del(redisKeys.entitlements(orgId))
}

/** Kept for callers that need the raw subscription row rather than the derived view. */
export async function loadSubscription(db: Database, orgId: string) {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1)
  return row ?? null
}
