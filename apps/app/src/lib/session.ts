import type { SessionUser } from '@volvia/shared'
import { cookies } from 'next/headers'

const ACCESS_COOKIE = 'volvia_access'
const REFRESH_COOKIE = 'volvia_refresh'
const ORG_COOKIE = 'volvia_org'

export const apiUrl =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

/**
 * Server-side session read.
 *
 * Tokens live in httpOnly cookies set by the API, so nothing readable by JavaScript
 * ever holds a credential. This forwards the cookie to `/v1/auth/me` and lets the API
 * be the single authority on whether the session is still valid.
 */
export async function getSession(): Promise<{ user: SessionUser; orgId: string } | null> {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  if (!access) return null

  try {
    const response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: { authorization: `Bearer ${access}` },
      cache: 'no-store',
    })
    if (!response.ok) return null

    const user = (await response.json()) as SessionUser
    if (user.memberships.length === 0) return null

    // The selected organisation persists across page loads for multi-business owners.
    const stored = jar.get(ORG_COOKIE)?.value
    const orgId =
      user.memberships.find((membership) => membership.orgId === stored)?.orgId ??
      user.memberships[0]!.orgId

    return { user, orgId }
  } catch {
    return null
  }
}

/** Server-side fetch against the API, carrying the session and selected organisation. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { orgId?: string } = {},
): Promise<T> {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  const orgId = init.orgId ?? jar.get(ORG_COOKIE)?.value

  const headers = new Headers(init.headers)
  if (access) headers.set('authorization', `Bearer ${access}`)
  if (orgId) headers.set('x-org-id', orgId)

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers, cache: 'no-store' })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? `request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

export const cookieNames = { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE, org: ORG_COOKIE }
