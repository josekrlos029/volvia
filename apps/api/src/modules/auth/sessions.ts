import { randomUUID } from 'node:crypto'
import { REFRESH_TOKEN_TTL_SECONDS } from '@volvia/shared'
import { type RedisClient, redisKeys } from '../../lib/redis'

export interface SessionRecord {
  userId: string
  /** Rotation counter. A refresh token presented with an older generation is theft. */
  gen: number
  createdAt: number
  userAgent: string
  ip: string
}

export async function createSession(
  redis: RedisClient,
  input: { userId: string; userAgent: string; ip: string },
): Promise<{ sessionId: string; record: SessionRecord }> {
  const sessionId = randomUUID()
  const record: SessionRecord = {
    userId: input.userId,
    gen: 0,
    createdAt: Date.now(),
    userAgent: input.userAgent.slice(0, 200),
    ip: input.ip,
  }
  await redis
    .multi()
    .set(redisKeys.session(sessionId), JSON.stringify(record), 'EX', REFRESH_TOKEN_TTL_SECONDS)
    .sadd(redisKeys.userSessions(input.userId), sessionId)
    .expire(redisKeys.userSessions(input.userId), REFRESH_TOKEN_TTL_SECONDS)
    .exec()
  return { sessionId, record }
}

export async function readSession(
  redis: RedisClient,
  sessionId: string,
): Promise<SessionRecord | null> {
  const raw = await redis.get(redisKeys.session(sessionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionRecord
  } catch {
    return null
  }
}

/** Advances the rotation counter; the returned value must go into the new refresh token. */
export async function rotateSession(
  redis: RedisClient,
  sessionId: string,
  record: SessionRecord,
): Promise<number> {
  const next = record.gen + 1
  await redis.set(
    redisKeys.session(sessionId),
    JSON.stringify({ ...record, gen: next }),
    'EX',
    REFRESH_TOKEN_TTL_SECONDS,
  )
  return next
}

export async function revokeSession(
  redis: RedisClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  await redis
    .multi()
    .del(redisKeys.session(sessionId))
    .srem(redisKeys.userSessions(userId), sessionId)
    .exec()
}

/** Used on refresh-token reuse and password change: nothing the attacker holds survives. */
export async function revokeAllSessions(redis: RedisClient, userId: string): Promise<number> {
  const key = redisKeys.userSessions(userId)
  const ids = await redis.smembers(key)
  if (ids.length === 0) return 0
  const pipeline = redis.multi()
  for (const id of ids) pipeline.del(redisKeys.session(id))
  pipeline.del(key)
  await pipeline.exec()
  return ids.length
}
