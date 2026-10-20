import type { SessionUser } from '@volvia/shared'
import { createApiClient } from '@volvia/shared/client'
import { API_URL } from './config'
import { type StoredSession, saveSession } from './session'

interface TokenPair {
  accessToken: string
  refreshToken: string
  user: SessionUser
}

let current: StoredSession | null = null
let onSignedOut: () => void = () => {}

/** Hands the popup's session to the client, and how to tell the popup it ended. */
export function bindSession(session: StoredSession | null, signedOut: () => void) {
  current = session
  onSignedOut = signedOut
}

/** Rotates the token pair; the API burns every session if an old refresh token is reused. */
async function refresh(): Promise<string | null> {
  if (!current) return null
  const response = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
    credentials: 'omit',
  })
  if (!response.ok) {
    current = null
    await saveSession(null)
    onSignedOut()
    return null
  }
  const pair = (await response.json()) as TokenPair
  current = { ...current, ...pair }
  await saveSession(current)
  return current.accessToken
}

/**
 * The shared Volvia client, with a bearer token instead of the dashboard's cookies:
 * an extension has no business holding the dashboard's session.
 */
export const api = createApiClient({
  baseUrl: API_URL,
  credentials: 'omit',
  getToken: () => current?.accessToken,
  getOrgId: () => current?.orgId,
  onUnauthorized: refresh,
})

/** Sign-in endpoints that answer with a fresh token pair. */
export async function signInWithPassword(email: string, password: string): Promise<TokenPair> {
  return api.post<TokenPair>('/v1/auth/login', { email, password }, { noRetry: true })
}
