import type { Database } from '@volvia/db'
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from 'jose'
import { afterEach, describe, expect, it } from 'vitest'
import { appleClientSecret, parseAppleUserField } from '../src/modules/auth/apple'
import { useKeysForTests, verifyIdToken } from '../src/modules/auth/id-token'
import { resolveSocialProfile } from '../src/modules/auth/social'

/** A provider we control: a key pair plus a signer that mimics its ID tokens. */
async function fakeProvider(alg: 'ES256' | 'RS256', issuer: string) {
  const { publicKey, privateKey } = await generateKeyPair(alg)
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg, use: 'sig' }
  const keys = createLocalJWKSet({ keys: [jwk] })
  const sign = (claims: Record<string, unknown>, options: { aud?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg, kid: 'k1' })
      .setIssuer(issuer)
      .setAudience(options.aud ?? 'co.volvia.biz')
      .setIssuedAt()
      .setExpirationTime(options.exp ?? '10m')
      .sign(privateKey)
  return { keys, sign, privateKey, publicKey }
}

afterEach(() => {
  useKeysForTests('apple', null)
  useKeysForTests('google', null)
})

describe('verifyIdToken', () => {
  it('reads an Apple identity, including the string booleans Apple sends', async () => {
    const apple = await fakeProvider('ES256', 'https://appleid.apple.com')
    useKeysForTests('apple', apple.keys)
    const token = await apple.sign({
      sub: '001234.abcd',
      email: 'Ana@Example.com',
      email_verified: 'true',
      is_private_email: 'false',
    })

    const profile = await verifyIdToken('apple', token, 'co.volvia.biz')
    expect(profile).toMatchObject({
      provider: 'apple',
      sub: '001234.abcd',
      email: 'ana@example.com',
      emailVerified: true,
      isPrivateEmail: false,
      name: null,
    })
  })

  it('flags the Hide My Email relay, by claim or by domain', async () => {
    const apple = await fakeProvider('ES256', 'https://appleid.apple.com')
    useKeysForTests('apple', apple.keys)

    const byClaim = await apple.sign({
      sub: 'x',
      email: 'abc123@privaterelay.appleid.com',
      is_private_email: 'true',
    })
    expect((await verifyIdToken('apple', byClaim, 'co.volvia.biz')).isPrivateEmail).toBe(true)

    const byDomain = await apple.sign({ sub: 'x', email: 'abc123@privaterelay.appleid.com' })
    expect((await verifyIdToken('apple', byDomain, 'co.volvia.biz')).isPrivateEmail).toBe(true)
  })

  it('rejects a token minted for another client, and an expired one', async () => {
    const apple = await fakeProvider('ES256', 'https://appleid.apple.com')
    useKeysForTests('apple', apple.keys)

    const other = await apple.sign({ sub: 'x', email: 'a@b.test' }, { aud: 'com.other.app' })
    await expect(verifyIdToken('apple', other, 'co.volvia.biz')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    const expired = await apple.sign({ sub: 'x', email: 'a@b.test' }, { exp: '-1m' })
    await expect(verifyIdToken('apple', expired, 'co.volvia.biz')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('rejects a token signed by someone else', async () => {
    const real = await fakeProvider('ES256', 'https://appleid.apple.com')
    const forger = await fakeProvider('ES256', 'https://appleid.apple.com')
    useKeysForTests('apple', real.keys)

    const forged = await forger.sign({ sub: 'x', email: 'a@b.test' })
    await expect(verifyIdToken('apple', forged, 'co.volvia.biz')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('accepts either audience when several clients are allowed', async () => {
    const google = await fakeProvider('RS256', 'https://accounts.google.com')
    useKeysForTests('google', google.keys)
    const token = await google.sign(
      { sub: '42', email: 'ana@gmail.com', email_verified: true, name: 'Ana', picture: 'p' },
      { aud: 'ios-client' },
    )

    const profile = await verifyIdToken('google', token, ['', 'web-client', 'ios-client'])
    expect(profile).toMatchObject({ provider: 'google', name: 'Ana', picture: 'p' })
  })

  it('refuses to run with no client configured rather than accept any audience', async () => {
    await expect(verifyIdToken('google', 'x.y.z', ['', ''])).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    })
  })
})

describe('appleClientSecret', () => {
  it('is an ES256 JWT from the team to Apple, on behalf of the client', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256')
    const secret = await appleClientSecret({
      clientId: 'co.volvia.web',
      teamId: 'TEAM123',
      keyId: 'KEY456',
      privateKeyPem: await exportPKCS8(privateKey),
    })

    const { payload, protectedHeader } = await jwtVerify(secret, publicKey, {
      issuer: 'TEAM123',
      audience: 'https://appleid.apple.com',
      subject: 'co.volvia.web',
    })
    expect(protectedHeader).toMatchObject({ alg: 'ES256', kid: 'KEY456' })
    expect(payload.exp! - payload.iat!).toBe(300)
  })

  it('accepts the key with escaped newlines, as a one-line env var carries it', async () => {
    const { privateKey } = await generateKeyPair('ES256')
    const flat = (await exportPKCS8(privateKey)).replace(/\n/g, '\\n')
    await expect(
      appleClientSecret({ clientId: 'c', teamId: 't', keyId: 'k', privateKeyPem: flat }),
    ).resolves.toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
  })
})

describe('parseAppleUserField', () => {
  it('joins the name Apple posts on first authorisation', () => {
    const raw = JSON.stringify({ name: { firstName: 'Ana', lastName: 'Martínez' }, email: 'x' })
    expect(parseAppleUserField(raw)).toEqual({ name: 'Ana Martínez' })
    expect(parseAppleUserField(undefined)).toEqual({ name: null })
    expect(parseAppleUserField('not json')).toEqual({ name: null })
    expect(parseAppleUserField(JSON.stringify({ name: { firstName: ' ' } }))).toEqual({
      name: null,
    })
  })
})

describe('resolveSocialProfile', () => {
  const profile = {
    provider: 'apple' as const,
    sub: 'x',
    email: 'abc@privaterelay.appleid.com',
    emailVerified: true,
    isPrivateEmail: true,
    name: null,
    picture: null,
  }

  it('refuses a relay address before touching the database', async () => {
    await expect(
      resolveSocialProfile({} as Database, profile, { allowSignup: true, ip: '::1' }),
    ).rejects.toMatchObject({ code: 'SOCIAL_EMAIL_HIDDEN' })
  })

  it('refuses an unverified address', async () => {
    await expect(
      resolveSocialProfile(
        {} as Database,
        { ...profile, isPrivateEmail: false, emailVerified: false },
        { allowSignup: true, ip: '::1' },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
