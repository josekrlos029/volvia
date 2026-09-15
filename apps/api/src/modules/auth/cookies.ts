import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '@volvia/shared'
import type { FastifyReply } from 'fastify'
import { env, isProduction } from '../../env'

const COOKIE_ACCESS = 'volvia_access'
const COOKIE_REFRESH = 'volvia_refresh'

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
  domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
}

/**
 * Browser clients keep tokens in httpOnly cookies so a XSS bug cannot read them; the
 * same tokens are also returned in the body for the scanner PWA and API clients.
 */
export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string },
): void {
  reply.setCookie(COOKIE_ACCESS, tokens.accessToken, {
    ...baseOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  })
  reply.setCookie(COOKIE_REFRESH, tokens.refreshToken, {
    ...baseOptions,
    // The refresh cookie is only ever sent to the refresh and logout endpoints.
    path: '/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  })
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_ACCESS, { ...baseOptions })
  reply.clearCookie(COOKIE_REFRESH, { ...baseOptions, path: '/v1/auth' })
}

export const cookieNames = { access: COOKIE_ACCESS, refresh: COOKIE_REFRESH } as const
