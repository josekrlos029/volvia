import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '@volvia/shared'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env'

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET)
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET)

const ISSUER = 'volvia'
const AUDIENCE = 'volvia-api'

export interface AccessClaims {
  sub: string
  email: string
  tv: number
  sid: string
}

export interface RefreshClaims {
  sub: string
  sid: string
  /** Rotation counter: a refresh token presented twice is treated as theft. */
  gen: number
  tv: number
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ email: claims.email, tv: claims.tv, sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessKey)
}

export async function signRefreshToken(claims: RefreshClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, gen: claims.gen, tv: claims.tv })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(refreshKey)
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessKey, { issuer: ISSUER, audience: AUDIENCE })
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? ''),
    tv: Number(payload.tv ?? 1),
    sid: String(payload.sid ?? ''),
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, refreshKey, { issuer: ISSUER, audience: AUDIENCE })
  return {
    sub: String(payload.sub),
    sid: String(payload.sid ?? ''),
    gen: Number(payload.gen ?? 0),
    tv: Number(payload.tv ?? 1),
  }
}
