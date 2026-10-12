import type { SocialProvider } from '@volvia/shared'
import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose'
import { AppError } from '../../lib/errors'

/**
 * What every social provider boils down to once its token has been checked.
 *
 * Google and Apple both speak OpenID Connect, so after signature and audience checks
 * the only thing left is to read the same four claims. Everything downstream (linking,
 * signup, sessions) works on this shape and never sees a provider-specific token.
 */
export interface SocialProfile {
  provider: SocialProvider
  /** The provider's stable user id (`sub`). Never the email: addresses change. */
  sub: string
  email: string
  emailVerified: boolean
  /** Apple's "Hide My Email" relay. Volvia asks for the real address. */
  isPrivateEmail: boolean
  name: string | null
  picture: string | null
}

const PROVIDERS = {
  google: {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  apple: {
    issuer: ['https://appleid.apple.com'],
    jwks: 'https://appleid.apple.com/auth/keys',
  },
} as const

const remoteKeys = new Map<SocialProvider, JWTVerifyGetKey>()
const keyOverrides = new Map<SocialProvider, JWTVerifyGetKey>()

function keysFor(provider: SocialProvider): JWTVerifyGetKey {
  const override = keyOverrides.get(provider)
  if (override) return override
  let keys = remoteKeys.get(provider)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(PROVIDERS[provider].jwks))
    remoteKeys.set(provider, keys)
  }
  return keys
}

/** Tests sign tokens with their own key pair and register it here. */
export function useKeysForTests(provider: SocialProvider, keys: JWTVerifyGetKey | null): void {
  if (keys) keyOverrides.set(provider, keys)
  else keyOverrides.delete(provider)
}

/** Apple sends booleans as the strings "true"/"false" in some claims. */
function flag(value: unknown): boolean {
  return value === true || value === 'true'
}

/**
 * Verifies a provider ID token (signature, issuer, audience, expiry) and reads the
 * identity out of it. `audience` is whichever client ID the token was minted for:
 * the web OAuth client, the iOS client, the Services ID or the app bundle ID.
 */
export async function verifyIdToken(
  provider: SocialProvider,
  token: string,
  audience: string | string[],
): Promise<SocialProfile> {
  const audiences = (Array.isArray(audience) ? audience : [audience]).filter(Boolean)
  if (audiences.length === 0) {
    throw new AppError('SERVICE_UNAVAILABLE', { message: `${provider} sign-in is not configured` })
  }

  let payload: Record<string, unknown>
  try {
    const verified = await jwtVerify(token, keysFor(provider), {
      issuer: [...PROVIDERS[provider].issuer],
      audience: audiences,
    })
    payload = verified.payload
  } catch (cause) {
    throw new AppError('FORBIDDEN', { message: `${provider} token is invalid`, cause })
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!sub || !email) {
    throw new AppError('FORBIDDEN', { message: `${provider} token carries no identity` })
  }

  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null
  const picture = typeof payload.picture === 'string' ? payload.picture : null

  return {
    provider,
    sub,
    email,
    // Apple omits email_verified for some legacy accounts; it still vouches for the
    // address, which is why it is treated as verified unless explicitly false.
    emailVerified:
      provider === 'apple'
        ? payload.email_verified !== false && payload.email_verified !== 'false'
        : flag(payload.email_verified),
    isPrivateEmail: flag(payload.is_private_email) || email.endsWith('@privaterelay.appleid.com'),
    name,
    picture,
  }
}
