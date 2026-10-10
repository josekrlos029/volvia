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

export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:58025'

/**
 * Pulls a token out of the newest email sent to an address.
 *
 * The screens behind our emails can only be tested by reading the real message, which
 * is the whole point: four of these links shipped broken precisely because every test
 * went straight to the API instead of following what the customer receives.
 */
export async function tokenFromEmail(
  request: APIRequestContext,
  email: string,
  path: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = await request.get(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
    if (list.ok()) {
      const { messages = [] } = (await list.json()) as { messages?: Array<{ ID: string }> }
      for (const message of messages) {
        const detail = await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)
        if (!detail.ok()) continue
        const body = (await detail.json()) as { Text?: string; HTML?: string }
        const found = `${body.Text ?? ''}${body.HTML ?? ''}`.match(
          new RegExp(`/${path}\\?token=([A-Za-z0-9_.~-]+)`),
        )
        if (found?.[1]) return found[1]
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`no ${path} email arrived for ${email}`)
}

/** A business that signs itself up through the form, the way a real one would. */
export async function signUpThroughTheForm(page: Page, business = uniqueBusiness()) {
  await page.goto(`${urls.app}/signup`)
  await page.fill('#businessName', business.businessName)
  await page.fill('#name', business.name)
  await page.fill('#email', business.email)
  await page.fill('#password', business.password)
  await page.click('button[type=submit]')
  await page.waitForURL(`${urls.app}/onboarding`)
  return business
}

/** Connects the business to a Google place, which is what unlocks review prompts. */
export async function connectGooglePlace(
  request: APIRequestContext,
  session: Session,
  placeId = 'ChIJe2etest00000',
): Promise<void> {
  const response = await request.patch(`${urls.api}/v1/org`, {
    headers: authHeaders(session),
    data: { googlePlaceId: placeId },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

export async function createSurvey(
  request: APIRequestContext,
  session: Session,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const response = await request.post(`${urls.api}/v1/surveys`, {
    headers: authHeaders(session),
    data: {
      name: 'Cómo nos fue',
      trigger: 'after_join',
      triggerStamp: null,
      cardIds: [],
      questions: [
        { type: 'rating', prompt: '¿Cómo estuvo tu visita?', scale: 5 },
        { type: 'text', prompt: '¿Algo que podamos mejorar?', maxLength: 280 },
      ],
      isAnonymous: false,
      routeToReviewFromRating: 4,
      isActive: true,
      ...overrides,
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as { id: string }
}

/**
 * Rewrites a customer's history so a segment can be tested without waiting months.
 *
 * Goes straight to the database on purpose: the point is to check that the SQL the API
 * runs agrees with `classifyCustomer`, and the only honest way to do that is to put a
 * real aged row in front of it.
 */
export async function ageCustomer(
  session: Session,
  email: string,
  history: { joinedDaysAgo: number; lastStampDaysAgo: number | null; totalStamps: number },
): Promise<void> {
  const { and, createDatabase, customers, eq, sql } = await import('@volvia/db')
  const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })

  try {
    await connection.db
      .update(customers)
      .set({
        joinedAt: sql`now() - make_interval(days => ${history.joinedDaysAgo})`,
        lastStampAt:
          history.lastStampDaysAgo === null
            ? null
            : sql`now() - make_interval(days => ${history.lastStampDaysAgo})`,
        totalStamps: history.totalStamps,
      })
      .where(and(eq(customers.orgId, session.orgId), eq(customers.email, email.toLowerCase())))
  } finally {
    await connection.close()
  }
}

/**
 * One aged customer per community bucket, so a segment can be tested against people
 * who really are regulars, returning, new, missing and lost.
 */
export const COMMUNITY_HISTORIES = [
  { key: 'regulars', joinedDaysAgo: 200, lastStampDaysAgo: 3, totalStamps: 8 },
  { key: 'returning', joinedDaysAgo: 200, lastStampDaysAgo: 40, totalStamps: 2 },
  { key: 'new', joinedDaysAgo: 2, lastStampDaysAgo: null, totalStamps: 0 },
  { key: 'missing', joinedDaysAgo: 200, lastStampDaysAgo: 80, totalStamps: 6 },
  { key: 'lost', joinedDaysAgo: 400, lastStampDaysAgo: 200, totalStamps: 5 },
] as const

export async function businessWithACommunity(request: APIRequestContext) {
  const business = uniqueBusiness()
  const session = await registerBusiness(request, business)
  const card = await createAndPublishCard(request, session)

  const emails: Record<string, string> = {}
  const tokens: Record<string, string> = {}
  for (const history of COMMUNITY_HISTORIES) {
    const email = `${history.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@volvia.test`
    const joined = await joinCard(request, card.joinSlug, email)
    await ageCustomer(session, email, history)
    emails[history.key] = email
    tokens[history.key] = joined.token
  }

  return { business, session, card, emails, tokens }
}

/**
 * Puts a wallet pass on a customer's card without building one.
 *
 * Written straight to the database, like `ageCustomer`: what these tests check is
 * who a message reaches, and signing a real `.pkpass` is a different concern with its
 * own tests and its own certificates.
 */
export async function installWalletPass(
  token: string,
  platform: 'apple' | 'google' = 'apple',
): Promise<void> {
  const { createDatabase, customerCards, eq, walletPasses } = await import('@volvia/db')
  const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })

  try {
    const [card] = await connection.db
      .select({ id: customerCards.id, orgId: customerCards.orgId })
      .from(customerCards)
      .where(eq(customerCards.token, token))
      .limit(1)
    if (!card) throw new Error(`no customer card for token ${token}`)

    await connection.db
      .insert(walletPasses)
      .values({
        orgId: card.orgId,
        customerCardId: card.id,
        platform,
        serial: token,
        installedAt: new Date(),
      })
      .onConflictDoNothing()
  } finally {
    await connection.close()
  }
}

/**
 * Lets a test business notify at any hour. The default window (08:00 to midnight in the
 * business's timezone) would otherwise park a "send now" until the morning whenever
 * the suite runs at night.
 */
export async function allowNotificationsAnytime(
  request: APIRequestContext,
  session: Session,
): Promise<void> {
  const response = await request.patch(`${urls.api}/v1/org`, {
    headers: authHeaders(session),
    data: { settings: { notificationHours: null } },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}
