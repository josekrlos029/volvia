import { DEFAULT_LOCALE, LOCALES, isLocale } from '@/lib/i18n'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Every page lives under a locale prefix, which is what lets the root layout set
 * `<html lang>` correctly. This sends a visitor without one to their best match.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
  if (hasLocale) return NextResponse.next()

  // Honour the browser's preference before falling back to Spanish.
  const preferred = request.headers
    .get('accept-language')
    ?.split(',')
    .map((part) => part.split(';')[0]?.trim().split('-')[0] ?? '')
    .find((tag) => isLocale(tag))

  const url = request.nextUrl.clone()
  url.pathname = `/${preferred ?? DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  // Static assets and the SEO routes are served as they are.
  matcher: ['/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
}
