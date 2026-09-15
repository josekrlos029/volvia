import { Redis } from 'ioredis'
import { env } from '../env'

export type RedisClient = Redis

/**
 * Redis is load-bearing here, not a nice-to-have: it holds refresh sessions, scan
 * idempotency, kiosk nonces, rate limits and the job queues. `/readyz` fails when it is
 * unreachable so an unhealthy instance is pulled out of rotation instead of silently
 * dropping stamps.
 */
export function createRedis(options: { keyPrefix?: string; forQueue?: boolean } = {}): RedisClient {
  return new Redis(env.REDIS_URL, {
    keyPrefix: options.keyPrefix,
    // BullMQ requires blocking commands to wait indefinitely.
    maxRetriesPerRequest: options.forQueue ? null : 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 3_000),
  })
}

export const redisKeys = {
  session: (sessionId: string) => `sess:${sessionId}`,
  userSessions: (userId: string) => `sess:user:${userId}`,
  idempotency: (scope: string, key: string) => `idem:${scope}:${key}`,
  kioskNonce: (nonce: string) => `kiosk:nonce:${nonce}`,
  kioskSession: (sessionId: string) => `kiosk:sess:${sessionId}`,
  cardState: (token: string) => `card:${token}`,
  orgOverview: (orgId: string, range: string) => `analytics:${orgId}:${range}`,
  businessPage: (slug: string) => `bizpage:${slug}`,
  entitlements: (orgId: string) => `ent:${orgId}`,
  cronLock: (job: string) => `lock:cron:${job}`,
  joinThrottle: (cardId: string, ip: string) => `throttle:join:${cardId}:${ip}`,
} as const

/** Acquire a short-lived distributed lock. Returns a release function, or null if taken. */
export async function acquireLock(
  redis: RedisClient,
  key: string,
  ttlSeconds: number,
): Promise<(() => Promise<void>) | null> {
  const value = crypto.randomUUID()
  const acquired = await redis.set(key, value, 'EX', ttlSeconds, 'NX')
  if (acquired !== 'OK') return null

  return async () => {
    // Only release the lock if we still own it.
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`
    await redis.eval(script, 1, key, value)
  }
}
