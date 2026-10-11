import { type Role, type SessionUser, roleAtLeast } from '@volvia/shared'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

const ACCESS_COOKIE = 'volvia_access'
const REFRESH_COOKIE = 'volvia_refresh'
const ORG_COOKIE = 'volvia_org'

export const apiUrl =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

/**
 * Server-side read of the signed-in user.
 *
 * Tokens live in httpOnly cookies set by the API, so nothing readable by JavaScript
 * ever holds a credential. This forwards the cookie to `/v1/auth/me` and lets the API
 * be the single authority on whether the session is still valid.
 *
 * Wrapped in `cache` so a layout, a nested layout and the page share one call per request.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  if (!access) return null

  try {
    const response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: { authorization: `Bearer ${access}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as SessionUser
  } catch {
    return null
  }
})

export interface Session {
  user: SessionUser
  orgId: string
  /** The user's role in `orgId`, mirroring how the API resolves it. */
  role: Role
}

/** The signed-in user plus the organisation the dashboard is acting in. */
export async function getSession(): Promise<Session | null> {
  const user = await getUser()
  if (!user) return null

  // The selected organisation persists across page loads for multi-business owners.
  const stored = (await cookies()).get(ORG_COOKIE)?.value
  const membership = user.memberships.find((item) => item.orgId === stored)
  if (membership) return { user, orgId: membership.orgId, role: membership.role }

  // Volvia staff may have entered any business from /admin; the API re-checks the flag
  // and treats them as the owner there.
  if (user.isSuperadmin && stored) return { user, orgId: stored, role: 'owner' }

  const first = user.memberships[0]
  if (!first) return null
  return { user, orgId: first.orgId, role: first.role }
}

/**
 * Sends the visitor away unless they hold at least `minimum` in the current business.
 *
 * The API enforces the same rule on every endpoint, so this is about landing the person
 * somewhere sensible instead of on an error page. `redirect` works by throwing, so never
 * wrap this in a try/catch.
 */
export async function requireRole(minimum: Role): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!roleAtLeast(session.role, minimum)) redirect('/')
  return session
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
