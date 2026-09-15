'use client'

import { createApiClient } from '@volvia/shared/client'

/**
 * Browser client. Auth rides on the httpOnly cookies the API set, so nothing here
 * stores a token; a 401 triggers one silent refresh before giving up.
 */
export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  credentials: 'include',
  getOrgId: () => readCookie('volvia_org'),
  onUnauthorized: async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/v1/auth/refresh`,
      { method: 'POST', credentials: 'include' },
    )
    // The refreshed access token comes back as a cookie; returning a marker is enough
    // to make the client retry the original request.
    return response.ok ? 'refreshed' : null
  },
})

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}
