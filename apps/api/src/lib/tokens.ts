import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { JOIN_SLUG_LENGTH, PUBLIC_TOKEN_BYTES, REDEEM_CODE_LENGTH } from '@volvia/shared'
import { env } from '../env'

/** URL-safe random string with `bytes` of entropy. */
export function randomToken(bytes = PUBLIC_TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * Hash used for anything we store but must be able to look up: magic links, invites,
 * pass auth tokens. Peppered so a database dump alone cannot be brute-forced, and fast
 * on purpose — these are high-entropy tokens, not passwords.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(`${token}${env.TOKEN_PEPPER}`).digest('hex')
}

export function tokensMatch(candidate: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(candidate), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The PassKit authentication token a device presents on every web-service call.
 *
 * Derived rather than stored: Apple requires the plaintext to live inside the pass
 * file, and a device holding an older copy must keep working after the customer
 * re-downloads. Deriving it from the serial makes it stable and unguessable without
 * the pepper, and means there is no secret in the database to leak.
 */
export function derivePassAuthToken(serial: string): string {
  return createHmac('sha256', env.TOKEN_PEPPER).update(`pass:${serial}`).digest('base64url')
}

export function passAuthTokenMatches(serial: string, candidate: string): boolean {
  const expected = Buffer.from(derivePassAuthToken(serial))
  const provided = Buffer.from(candidate)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

/** Human-typeable alphabet: no 0/O/1/I/L to avoid dictation mistakes at the counter. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateCode(length = REDEEM_CODE_LENGTH): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return out
}

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function generateJoinSlug(length = JOIN_SLUG_LENGTH): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]
  }
  return out
}

/** Turns a business name into a URL handle; collisions are resolved by the caller. */
export function slugify(input: string): string {
  return (
    input
      // Decompose, then drop the combining marks, so "Café Raíces" yields "cafe-raices".
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: matching combining marks is the intent, not an accident: NFD has just split accented letters apart and this removes the marks left behind.
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  )
}
