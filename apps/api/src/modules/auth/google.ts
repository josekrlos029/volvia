import { randomUUID } from 'node:crypto'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import type { RedisClient } from '../../lib/redis'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'
const STATE_TTL_SECONDS = 600

export interface GoogleProfile {
  sub: string
  email: string
  emailVerified: boolean
  name: string
  picture: string | null
}

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
    JSON.stringify({ redirectTo: input.redirectTo ?? '' }),
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

export async function consumeState(
  redis: RedisClient,
  state: string,
): Promise<{ redirectTo: string }> {
  const key = `oauth:state:${state}`
  const raw = await redis.get(key)
  await redis.del(key)
  if (!raw) throw new AppError('FORBIDDEN', { message: 'invalid or expired oauth state' })
  try {
    return JSON.parse(raw) as { redirectTo: string }
  } catch {
    return { redirectTo: '' }
  }
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
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
    sub: profile.sub,
    email: profile.email,
    emailVerified: Boolean(profile.email_verified),
    name: profile.name ?? profile.email.split('@')[0] ?? 'Usuario',
    picture: profile.picture ?? null,
  }
}
