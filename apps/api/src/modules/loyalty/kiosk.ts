import { randomUUID } from 'node:crypto'
import { KIOSK_NONCE_GRACE_SECONDS, KIOSK_NONCE_TTL_SECONDS } from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { type RedisClient, redisKeys } from '../../lib/redis'
import { randomToken } from '../../lib/tokens'

export interface KioskNonce {
  nonce: string
  expiresInSeconds: number
}

interface NoncePayload {
  sessionId: string
  cardId: string
  locationId: string
  orgId: string
}

/**
 * Kiosk anti-fraud.
 *
 * The screen shows a QR that changes every 30 seconds, and each nonce may be consumed
 * exactly once. Photographing the screen is therefore useless: by the time the picture
 * is shared the code is dead, and a code that was already used cannot be replayed.
 */
export async function issueNonce(redis: RedisClient, payload: NoncePayload): Promise<KioskNonce> {
  const nonce = randomToken(18)
  // A short grace period past the display interval covers a slow camera or network.
  const ttl = KIOSK_NONCE_TTL_SECONDS + KIOSK_NONCE_GRACE_SECONDS
  await redis.set(redisKeys.kioskNonce(nonce), JSON.stringify(payload), 'EX', ttl)
  return { nonce, expiresInSeconds: KIOSK_NONCE_TTL_SECONDS }
}

/** Consumes a nonce atomically, so two devices cannot use the same code. */
export async function consumeNonce(redis: RedisClient, nonce: string): Promise<NoncePayload> {
  const key = redisKeys.kioskNonce(nonce)
  // GETDEL is atomic: whoever gets the value has exclusively claimed it.
  const raw = await redis.getdel(key)
  if (!raw) {
    throw new AppError('KIOSK_NONCE_INVALID', {
      message: 'this code has expired, please try again',
    })
  }
  try {
    return JSON.parse(raw) as NoncePayload
  } catch {
    throw new AppError('KIOSK_NONCE_INVALID', { message: 'invalid kiosk code' })
  }
}

export interface KioskSessionToken {
  sessionId: string
  secret: string
}

export async function openKioskSession(
  redis: RedisClient,
  input: { orgId: string; cardId: string; locationId: string },
): Promise<KioskSessionToken> {
  const sessionId = randomUUID()
  const secret = randomToken(24)
  // Kiosk screens run unattended all day, so the session outlives a normal login.
  await redis.set(
    redisKeys.kioskSession(sessionId),
    JSON.stringify({ ...input, secret }),
    'EX',
    24 * 60 * 60,
  )
  return { sessionId, secret }
}

export async function readKioskSession(
  redis: RedisClient,
  sessionId: string,
  secret: string,
): Promise<{ orgId: string; cardId: string; locationId: string }> {
  const raw = await redis.get(redisKeys.kioskSession(sessionId))
  if (!raw) throw new AppError('UNAUTHENTICATED', { message: 'kiosk session expired' })

  const parsed = JSON.parse(raw) as {
    orgId: string
    cardId: string
    locationId: string
    secret: string
  }
  if (parsed.secret !== secret) {
    throw new AppError('UNAUTHENTICATED', { message: 'invalid kiosk session' })
  }
  // Refresh the window so an active screen is never logged out mid-shift.
  await redis.expire(redisKeys.kioskSession(sessionId), 24 * 60 * 60)
  return { orgId: parsed.orgId, cardId: parsed.cardId, locationId: parsed.locationId }
}

export async function closeKioskSession(redis: RedisClient, sessionId: string): Promise<void> {
  await redis.del(redisKeys.kioskSession(sessionId))
}
