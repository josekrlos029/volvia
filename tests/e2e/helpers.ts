import { randomUUID } from 'node:crypto'
import { type APIRequestContext, type Page, expect } from '@playwright/test'

export const urls = {
  api: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  web: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  app: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
  pass: process.env.NEXT_PUBLIC_PASS_URL ?? 'http://localhost:3002',
}

export const SEED_PASSWORD = 'volvia-local-2026'

/** A fresh business per test run, so specs never collide over shared state. */
export function uniqueBusiness() {
  const id = randomUUID().slice(0, 8)
  return {
    email: `owner-${id}@volvia.test`,
    password: 'volvia-e2e-2026-secret',
    name: `Dueño ${id}`,
    businessName: `Negocio ${id}`,
  }
}

export interface Session {
  accessToken: string
  orgId: string
}

export async function registerBusiness(
  request: APIRequestContext,
  business = uniqueBusiness(),
): Promise<Session & { business: ReturnType<typeof uniqueBusiness> }> {
  const response = await request.post(`${urls.api}/v1/auth/register`, {
    data: {
      email: business.email,
      password: business.password,
      name: business.name,
      businessName: business.businessName,
      country: 'CO',
      timezone: 'America/Bogota',
      locale: 'es',
      marketingOptIn: false,
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()

  const body = await response.json()
  return { accessToken: body.accessToken, orgId: body.user.memberships[0].orgId, business }
}

export function authHeaders(session: Session): Record<string, string> {
  return { authorization: `Bearer ${session.accessToken}`, 'x-org-id': session.orgId }
}

export async function createAndPublishCard(
  request: APIRequestContext,
  session: Session,
  overrides: Record<string, unknown> = {},
) {
  const created = await request.post(`${urls.api}/v1/cards`, {
    headers: authHeaders(session),
    data: {
      name: 'Club de prueba',
      stampsRequired: 4,
      rules: { cooldownMinutes: 0, dailyCap: 20, maxStampsPerScan: 5 },
      rewards: [
        { atStamp: 2, title: 'Postre gratis', description: '' },
        { atStamp: 4, title: 'Plato gratis', description: 'El que quieras' },
      ],
      terms: 'Un sello por visita.',
      ...overrides,
    },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const card = await created.json()

  const published = await request.post(`${urls.api}/v1/cards/${card.id}/publish`, {
    headers: authHeaders(session),
  })
  expect(published.ok(), await published.text()).toBeTruthy()

  return (await published.json()) as { id: string; joinSlug: string; joinUrl: string }
}

export async function joinCard(
  request: APIRequestContext,
  joinSlug: string,
  email = `cliente-${randomUUID().slice(0, 8)}@volvia.test`,
) {
  const response = await request.post(`${urls.api}/p/join/${joinSlug}`, {
    data: { firstName: 'María', email, marketingConsent: true, birthday: { month: 4, day: 15 } },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as { token: string; customerId: string; isNew: boolean }
}

export function idempotencyKey(): string {
  return `e2e-${randomUUID()}`
}

/** Signs into the dashboard through the real form, so the cookie flow is exercised. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${urls.app}/login`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL(`${urls.app}/`)
}
