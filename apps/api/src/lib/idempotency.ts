import { IDEMPOTENCY_TTL_SECONDS } from '@volvia/shared'
import { type RedisClient, redisKeys } from './redis'

export type IdempotencyOutcome<T> =
  | { status: 'fresh'; commit: (result: T) => Promise<void>; release: () => Promise<void> }
  | { status: 'replayed'; result: T }
  | { status: 'in_flight' }

/**
 * Two-phase idempotency: reserve the key, run the work, then store the result so a
 * retry returns the same response instead of stamping twice.
 *
 * The database's unique index on (customer_card_id, idempotency_key) is still the
 * authority — this only keeps the common case off the database and lets a replay
 * return the original payload rather than a conflict.
 */
export async function withIdempotency<T>(
  redis: RedisClient,
  scope: string,
  key: string,
): Promise<IdempotencyOutcome<T>> {
  const redisKey = redisKeys.idempotency(scope, key)
  const reserved = await redis.set(redisKey, '__pending__', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX')

  if (reserved === 'OK') {
    return {
      status: 'fresh',
      commit: async (result: T) => {
        await redis.set(redisKey, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL_SECONDS)
      },
      release: async () => {
        // Failed attempts must not poison the key — the client should be able to retry.
        await redis.del(redisKey)
      },
    }
  }

  const existing = await redis.get(redisKey)
  if (!existing || existing === '__pending__') return { status: 'in_flight' }

  try {
    return { status: 'replayed', result: JSON.parse(existing) as T }
  } catch {
    return { status: 'in_flight' }
  }
}
