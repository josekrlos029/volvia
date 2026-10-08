import { cookieNames } from '@/lib/session'
import { NextResponse } from 'next/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Switches the dashboard into another business. Only the cookie changes here: the API
 * decides on every request whether this user may act in that organisation.
 */
export async function POST(request: Request) {
  const form = await request.formData()
  const orgId = String(form.get('orgId') ?? '')
  if (!UUID.test(orgId)) {
    return NextResponse.redirect(new URL('/admin', request.url), { status: 303 })
  }

  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 })
  response.cookies.set(cookieNames.org, orgId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
