import { createConnection } from 'node:net'
import { type APIRequestContext, expect, test } from '@playwright/test'
import { authHeaders, createAndPublishCard, registerBusiness, urls } from '../helpers'

/**
 * Closing a business is reversible for a week, then final. The window and the purge
 * are both exercised here, against the isolated database.
 */
const secret = process.env.JOBS_SECRET ?? ''
const jobHeaders = { authorization: `Bearer ${secret}` }

async function releaseDailyWindow(): Promise<void> {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port: Number(url.port || 6379) })
    socket.once('error', reject)
    socket.once('connect', () => socket.write('DEL lock:cron:daily-due\r\n'))
    socket.once('data', () => {
      socket.end()
      resolve()
    })
  })
}

async function runDailyJobs(request: APIRequestContext): Promise<void> {
  await releaseDailyWindow()
  const response = await request.post(`${urls.api}/internal/jobs/cron`, { headers: jobHeaders })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test.describe('closing a business', () => {
  test.skip(secret.length === 0, 'JOBS_SECRET is not set in this environment')

  test('can be undone within the window, and the page comes back with it', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    const { slug } = (await org.json()) as { slug: string }

    const closed = await request.post(`${urls.api}/v1/org/close`, {
      headers: authHeaders(session),
      data: { confirmName: session.business.businessName },
    })
    expect(closed.ok(), await closed.text()).toBeTruthy()

    // Gone from every door: the dashboard, the public page, the join page.
    expect((await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })).ok()).toBe(
      false,
    )
    expect((await request.get(`${urls.api}/p/business/${slug}`)).status()).toBe(404)
    expect((await request.get(`${urls.api}/p/join/${card.joinSlug}`)).ok()).toBe(false)

    const list = await request.get(`${urls.api}/v1/org/closed`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    })
    expect(list.ok(), await list.text()).toBeTruthy()
    const { organizations } = (await list.json()) as {
      organizations: Array<{ id: string; purgeAt: string }>
    }
    const mine = organizations.find((item) => item.id === session.orgId)!
    expect(mine, 'the closed business is offered back').toBeTruthy()
    const days = (new Date(mine.purgeAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)

    const restored = await request.post(`${urls.api}/v1/org/restore`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      data: { orgId: session.orgId },
    })
    expect(restored.ok(), await restored.text()).toBeTruthy()

    expect((await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })).ok()).toBe(
      true,
    )
    expect((await request.get(`${urls.api}/p/business/${slug}`)).status()).toBe(200)
    expect((await request.get(`${urls.api}/p/join/${card.joinSlug}`)).ok()).toBe(true)
  })

  test('a stranger cannot restore it, and the owner cannot after the window', async ({
    request,
  }) => {
    const owner = await registerBusiness(request)
    const stranger = await registerBusiness(request)
    await request.post(`${urls.api}/v1/org/close`, {
      headers: authHeaders(owner),
      data: { confirmName: owner.business.businessName },
    })

    const foreign = await request.post(`${urls.api}/v1/org/restore`, {
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      data: { orgId: owner.orgId },
    })
    expect(foreign.ok()).toBe(false)

    const { createDatabase, eq, organizations } = await import('@volvia/db')
    const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })
    try {
      await connection.db
        .update(organizations)
        .set({ purgeAt: new Date(Date.now() - 60_000) })
        .where(eq(organizations.id, owner.orgId))
    } finally {
      await connection.close()
    }

    const late = await request.post(`${urls.api}/v1/org/restore`, {
      headers: { authorization: `Bearer ${owner.accessToken}` },
      data: { orgId: owner.orgId },
    })
    expect(late.status()).toBe(409)
  })

  test('after the window the daily job erases it completely', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await request.post(`${urls.api}/v1/org/close`, {
      headers: authHeaders(session),
      data: { confirmName: session.business.businessName },
    })

    const { createDatabase, eq, organizations, stampCards } = await import('@volvia/db')
    const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })
    try {
      await connection.db
        .update(organizations)
        .set({ purgeAt: new Date(Date.now() - 60_000) })
        .where(eq(organizations.id, session.orgId))

      await runDailyJobs(request)

      const orgRows = await connection.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, session.orgId))
      expect(orgRows, 'the organization row is gone').toHaveLength(0)
      const cardRows = await connection.db
        .select({ id: stampCards.id })
        .from(stampCards)
        .where(eq(stampCards.id, card.id))
      expect(cardRows, 'and everything hanging off it').toHaveLength(0)
    } finally {
      await connection.close()
    }

    expect((await request.get(`${urls.api}/p/join/${card.joinSlug}`)).status()).toBe(404)
  })
})
