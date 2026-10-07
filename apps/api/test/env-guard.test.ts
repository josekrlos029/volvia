import { describe, expect, it } from 'vitest'
import { type Env, unsafeForProduction } from '../src/env'

/**
 * The production guard.
 *
 * Every value it checks is one that would be invisible in testing and catastrophic in
 * production: the signing secrets are published in `.env.example`, so a deployment that
 * kept them could be handed a forged session by anyone who read the repository.
 */
const safe = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'xQ3n7Pk2vR8sTg5wYz1aBc4dEf6hJm9L',
  JWT_REFRESH_SECRET: 'Lm9Jh6fE4dC1cB4aZ1yW5gT8sR2kP7n3',
  TOKEN_PEPPER: 'pP1aS2dF3gH4jK5lZ6xC7vB8nM9qW0eR',
  RATE_LIMIT_ENABLED: true,
  CORS_ORIGINS: ['https://panel.volvia.co', 'https://volvia.co'],
  COOKIE_DOMAIN: 'volvia.co',
  API_URL: 'https://api.volvia.co',
  WEB_URL: 'https://volvia.co',
  APP_URL: 'https://panel.volvia.co',
  PASS_URL: 'https://tarjeta.volvia.co',
} as unknown as Env

const broken = (patch: Partial<Record<keyof Env, unknown>>) =>
  unsafeForProduction({ ...safe, ...patch } as Env)

describe('production configuration guard', () => {
  it('accepts a configuration that is genuinely production-ready', () => {
    expect(unsafeForProduction(safe)).toEqual([])
  })

  it.each([
    ['JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me-0000000000000000'],
    ['JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me-000000000000000'],
    ['TOKEN_PEPPER', 'dev-only-token-pepper-change-me-00000000000000000'],
  ] as const)('refuses the %s shipped in .env.example', (key, value) => {
    expect(broken({ [key]: value })).toContain(`${key} still holds the development placeholder`)
  })

  it('refuses one secret reused for both token types', () => {
    const problems = broken({ JWT_REFRESH_SECRET: safe.JWT_ACCESS_SECRET })
    expect(problems).toContain('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different')
  })

  it('refuses rate limiting left off after an end-to-end run', () => {
    expect(broken({ RATE_LIMIT_ENABLED: false })).toHaveLength(1)
  })

  it('refuses plaintext and empty CORS origins', () => {
    expect(broken({ CORS_ORIGINS: [] })).toContain(
      'CORS_ORIGINS is empty; set the real dashboard and card domains',
    )
    expect(broken({ CORS_ORIGINS: ['http://panel.volvia.co'] })).toContain(
      'CORS_ORIGINS contains a plaintext http:// origin',
    )
  })

  it('refuses cookies still scoped to localhost', () => {
    expect(broken({ COOKIE_DOMAIN: 'localhost' })).toContain('COOKIE_DOMAIN is still localhost')
  })

  it('refuses public URLs that point at a laptop', () => {
    expect(broken({ PASS_URL: 'http://localhost:3002' })).toHaveLength(1)
    expect(broken({ API_URL: 'http://api.volvia.co' })).toHaveLength(1)
  })

  it('reports every problem at once rather than one per restart', () => {
    const problems = broken({
      JWT_ACCESS_SECRET: 'dev-only-access-secret-change-me-0000000000000000',
      COOKIE_DOMAIN: 'localhost',
      RATE_LIMIT_ENABLED: false,
    })
    expect(problems.length).toBeGreaterThanOrEqual(3)
  })
})
