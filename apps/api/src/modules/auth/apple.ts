import { randomUUID } from 'node:crypto'
import { SignJWT, importPKCS8 } from 'jose'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import type { RedisClient } from '../../lib/redis'
import { type SocialProfile, verifyIdToken } from './id-token'

const AUTH_ENDPOINT = 'https://appleid.apple.com/auth/authorize'
const TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token'
const APPLE_AUDIENCE = 'https://appleid.apple.com'
const STATE_TTL_SECONDS = 600

/** The web flow needs the Services ID and the key; the native flow only the key. */
export function appleConfigured(): boolean {
  return Boolean(
    env.APPLE_TEAM_ID &&
      env.APPLE_SIGNIN_KEY_ID &&
      env.APPLE_SIGNIN_KEY_P8 &&
      env.APPLE_SIGNIN_SERVICES_ID,
  )
}

export function appleNativeConfigured(): boolean {
  return Boolean(env.APPLE_SIGNIN_APP_BUNDLE_ID)
}

function redirectUri(): string {
  return `${env.API_URL}/v1/auth/apple/callback`
}

/**
 * Apple has no static client secret: it is a short-lived JWT signed with the team's
 * .p8 key. Minted per token exchange so nothing long-lived sits in memory.
 */
export async function appleClientSecret(
  input: { clientId: string; teamId: string; keyId: string; privateKeyPem: string },
  now = new Date(),
): Promise<string> {
  const key = await importPKCS8(input.privateKeyPem.replace(/\\n/g, '\n'), 'ES256')
  const issuedAt = Math.floor(now.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: input.keyId })
    .setIssuer(input.teamId)
    .setSubject(input.clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 5 * 60)
    .sign(key)
}

/** The consent URL plus a single-use state in Redis, exactly like the Google flow. */
export async function buildAppleAuthorizeUrl(
  redis: RedisClient,
  input: { redirectTo?: string },
): Promise<string> {
  if (!appleConfigured()) {
    throw new AppError('SERVICE_UNAVAILABLE', { message: 'Apple sign-in is not configured' })
  }
  const state = randomUUID()
  await redis.set(
    `oauth:state:${state}`,
    JSON.stringify({ provider: 'apple', redirectTo: input.redirectTo ?? '' }),
    'EX',
    STATE_TTL_SECONDS,
  )

  const params = new URLSearchParams({
    client_id: env.APPLE_SIGNIN_SERVICES_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    // Apple only delivers name and email through a form POST, never a GET redirect.
    response_mode: 'form_post',
    scope: 'name email',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * The `user` field Apple posts back on the very first authorisation: the only time it
 * ever tells us the person's name, and only if the scope asked for it.
 */
export function parseAppleUserField(raw: string | undefined): { name: string | null } {
  if (!raw) return { name: null }
  try {
    const parsed = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } }
    const name = [parsed.name?.firstName, parsed.name?.lastName]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ')
    return { name: name || null }
  } catch {
    return { name: null }
  }
}

/** Trades the authorisation code for an ID token and verifies it. */
export async function exchangeAppleCode(code: string): Promise<SocialProfile> {
  const clientSecret = await appleClientSecret({
    clientId: env.APPLE_SIGNIN_SERVICES_ID,
    teamId: env.APPLE_TEAM_ID,
    keyId: env.APPLE_SIGNIN_KEY_ID,
    privateKeyPem: env.APPLE_SIGNIN_KEY_P8,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.APPLE_SIGNIN_SERVICES_ID,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
    }),
  })
  if (!response.ok) {
    throw new AppError('FORBIDDEN', { message: 'apple token exchange failed' })
  }

  const tokens = (await response.json()) as { id_token?: string }
  if (!tokens.id_token) throw new AppError('FORBIDDEN', { message: 'apple id token missing' })

  return verifyIdToken('apple', tokens.id_token, env.APPLE_SIGNIN_SERVICES_ID)
}

/** The token the iOS app gets from `ASAuthorizationAppleIDCredential`. */
export async function verifyNativeAppleToken(identityToken: string): Promise<SocialProfile> {
  return verifyIdToken('apple', identityToken, env.APPLE_SIGNIN_APP_BUNDLE_ID)
}
