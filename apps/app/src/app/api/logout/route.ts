import { apiUrl, cookieNames } from '@/lib/session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Logging out has to happen server-side: the session cookies are httpOnly, so the
 * browser cannot clear them, and the API needs to revoke the session in Redis.
 */
export async function POST(request: Request) {
  const jar = await cookies()
  const access = jar.get(cookieNames.access)?.value

  if (access) {
    await fetch(`${apiUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${access}` },
    }).catch(() => {
      // A failed revoke must not trap the user in a session they asked to leave.
    })
  }

  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  for (const name of Object.values(cookieNames)) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  return response
}
