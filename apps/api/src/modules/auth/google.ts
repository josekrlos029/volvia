import { randomUUID } from 'node:crypto'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import type { RedisClient } from '../../lib/redis'
import { type SocialProfile, verifyIdToken } from './id-token'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'
const STATE_TTL_SECONDS = 600

export function googleConfigured(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET)
}

function redirectUri(): string {
  return `${env.API_URL}/v1/auth/google/callback`
}

/** Creates the consent URL and stores a single-use state to defend against CSRF. */
export async function buildAuthorizeUrl(
  redis: RedisClient,
  input: { redirectTo?: string },
): Promise<string> {
  if (!googleConfigured()) {
    throw new AppError('SERVICE_UNAVAILABLE', { message: 'Google sign-in is not configured' })
  }
  const state = randomUUID()
  await redis.set(
    `oauth:state:${state}`,
    JSON.stringify({ provider: 'google', redirectTo: input.redirectTo ?? '' }),
    'EX',
    STATE_TTL_SECONDS,
  )

  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * Burns the state nonce and returns what was stored with it. The provider is checked
 * so a state minted for Google cannot complete an Apple callback or vice versa.
 */
export async function consumeState(
  redis: RedisClient,
  state: string,
  provider: 'google' | 'apple',
): Promise<{ redirectTo: string }> {
  const key = `oauth:state:${state}`
  const raw = await redis.get(key)
  await redis.del(key)
  if (!raw) throw new AppError('FORBIDDEN', { message: 'invalid or expired oauth state' })
  let stored: { provider?: string; redirectTo?: string }
  try {
    stored = JSON.parse(raw) as { provider?: string; redirectTo?: string }
  } catch {
    stored = {}
  }
  if ((stored.provider ?? 'google') !== provider) {
    throw new AppError('FORBIDDEN', { message: 'oauth state belongs to another provider' })
  }
  return { redirectTo: stored.redirectTo ?? '' }
}

export async function exchangeCodeForProfile(code: string): Promise<SocialProfile> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    throw new AppError('FORBIDDEN', { message: 'google token exchange failed' })
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string }
  if (!tokens.access_token) throw new AppError('FORBIDDEN', { message: 'google token missing' })

  const userinfo = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userinfo.ok) throw new AppError('FORBIDDEN', { message: 'google userinfo failed' })

  const profile = (await userinfo.json()) as {
    sub: string
    email: string
    email_verified: boolean
    name?: string
    picture?: string
  }

  return {
    provider: 'google',
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    emailVerified: Boolean(profile.email_verified),
    isPrivateEmail: false,
    name: profile.name?.trim() || null,
    picture: profile.picture ?? null,
  }
}

/**
 * The ID token the Google Sign-In SDK hands the iOS app. Its audience is the iOS OAuth
 * client; the web client is accepted too so an Android build using the web client id
 * (as Credential Manager requires) works against the same endpoint.
 */
export async function verifyNativeGoogleToken(idToken: string): Promise<SocialProfile> {
  return verifyIdToken('google', idToken, [
    env.GOOGLE_OAUTH_IOS_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_ID,
  ])
}
