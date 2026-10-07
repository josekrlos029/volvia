import { expect, test } from '@playwright/test'
import { COMMUNITY_SEGMENTS, classifyCustomer } from '@volvia/shared'
import {
  ageCustomer,
  authHeaders,
  createAndPublishCard,
  joinCard,
  registerBusiness,
  signIn,
  uniqueBusiness,
  urls,
} from '../helpers'

/**
 * Community segmentation.
 *
 * `classifyCustomer` is the definition; the API runs the same rules in SQL so it can
 * count without loading rows. These tests put real aged customers in front of the real
 * query and check the two agree — the only way to catch the two definitions drifting.
 */
const HISTORIES = [
  { key: 'regulars', joinedDaysAgo: 200, lastStampDaysAgo: 3, totalStamps: 8 },
  { key: 'returning', joinedDaysAgo: 200, lastStampDaysAgo: 40, totalStamps: 2 },
  { key: 'new', joinedDaysAgo: 2, lastStampDaysAgo: null, totalStamps: 0 },
  { key: 'missing', joinedDaysAgo: 200, lastStampDaysAgo: 80, totalStamps: 6 },
  { key: 'lost', joinedDaysAgo: 400, lastStampDaysAgo: 200, totalStamps: 5 },
] as const

async function businessWithACommunity(request: Parameters<typeof registerBusiness>[0]) {
  const business = uniqueBusiness()
  const session = await registerBusiness(request, business)
  const card = await createAndPublishCard(request, session)

  const emails: Record<string, string> = {}
  for (const history of HISTORIES) {
    const email = `${history.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@volvia.test`
    await joinCard(request, card.joinSlug, email)
    await ageCustomer(session, email, history)
    emails[history.key] = email
  }

  return { business, session, card, emails }
}

test.describe('community segments', () => {
  test('each customer lands in the bucket the shared rules predict', async ({ request }) => {
    const { session } = await businessWithACommunity(request)

    for (const history of HISTORIES) {
      const expected = classifyCustomer(
        {
          joinedAt: new Date(Date.now() - history.joinedDaysAgo * 86_400_000),
          lastStampAt:
            history.lastStampDaysAgo === null
              ? null
              : new Date(Date.now() - history.lastStampDaysAgo * 86_400_000),
          totalStamps: history.totalStamps,
        },
        'monthly',
      )
      expect(expected, `fixture ${history.key}`).toBe(history.key)

      const response = await request.get(
        `${urls.api}/v1/customers?segment=${history.key}&pageSize=50`,
        { headers: authHeaders(session) },
      )
      const body = await response.json()
      const names = body.items.map((item: { firstName: string }) => item.firstName)

      expect(body.total, `segment ${history.key}`).toBe(1)
      expect(names).toHaveLength(1)
    }
  })

  test('the five buckets add up to every customer, with nobody counted twice', async ({
    request,
  }) => {
    const { session } = await businessWithACommunity(request)

    const counts = await request.get(`${urls.api}/v1/customers/segments`, {
      headers: authHeaders(session),
    })
    const body = await counts.json()

    const sum = COMMUNITY_SEGMENTS.reduce((total, segment) => total + body.segments[segment], 0)
    expect(sum).toBe(body.total)
    expect(body.total).toBe(HISTORIES.length)
  })

  test('the same customers are read differently by a different kind of business', async ({
    request,
  }) => {
    const { session } = await businessWithACommunity(request)

    const read = async () => {
      const response = await request.get(`${urls.api}/v1/customers/segments`, {
        headers: authHeaders(session),
      })
      return (await response.json()) as { frequency: string; segments: Record<string, number> }
    }

    const monthly = await read()
    expect(monthly.frequency).toBe('monthly')
    expect(monthly.segments.lost).toBe(1)

    await request.patch(`${urls.api}/v1/org`, {
      headers: authHeaders(session),
      data: { settings: { visitFrequency: 'weekly' } },
    })

    const weekly = await read()
    expect(weekly.frequency).toBe('weekly')
    // A café expecting weekly visits has lost more of the same people.
    expect(weekly.segments.lost ?? 0).toBeGreaterThan(monthly.segments.lost ?? 0)
  })

  test('a campaign reaches the segment it targets, not the whole list', async ({ request }) => {
    const { session } = await businessWithACommunity(request)

    const preview = async (segment: string) => {
      const response = await request.post(`${urls.api}/v1/campaigns/preview`, {
        headers: authHeaders(session),
        data: { segment, cardIds: [], customerIds: [], consentOnly: true },
      })
      expect(response.ok(), await response.text()).toBeTruthy()
      return (await response.json()).size as number
    }

    // The preview used to ignore the segment entirely and answer with everyone.
    expect(await preview('all')).toBe(HISTORIES.length)
    expect(await preview('lost')).toBe(1)
    expect(await preview('regulars')).toBe(1)
  })
})

test.describe('customer filters', () => {
  test('narrow the list without changing what a segment means', async ({ request }) => {
    const { session } = await businessWithACommunity(request)
    const list = async (query: string) => {
      const response = await request.get(`${urls.api}/v1/customers?${query}&pageSize=50`, {
        headers: authHeaders(session),
      })
      return (await response.json()).total as number
    }

    expect(await list('segment=all')).toBe(5)
    expect(await list('segment=all&minStamps=6')).toBe(2)
    expect(await list('segment=all&maxStamps=0')).toBe(1)
    expect(await list('segment=regulars&minStamps=6')).toBe(1)
    // The same filter against a segment nobody in it matches.
    expect(await list('segment=new&minStamps=6')).toBe(0)
    expect(await list('segment=all&hasConsent=true')).toBe(5)
    expect(await list('segment=never_visited')).toBe(1)
  })

  test('an explicit selection can be exported on its own', async ({ request }) => {
    const { session } = await businessWithACommunity(request)

    const all = await request.get(`${urls.api}/v1/customers?pageSize=50`, {
      headers: authHeaders(session),
    })
    const items = (await all.json()).items as Array<{ id: string; firstName: string }>
    const picked = items.slice(0, 2)

    const csv = await request.get(
      `${urls.api}/v1/customers/export.csv?ids=${picked.map((item) => item.id).join(',')}`,
      { headers: authHeaders(session) },
    )
    expect(csv.ok(), await csv.text()).toBeTruthy()

    const text = await csv.text()
    const rows = text.trim().split('\n')
    expect(rows).toHaveLength(picked.length + 1)
    for (const customer of picked) expect(text).toContain(customer.firstName)
  })
})

test.describe('the customers screen', () => {
  test('shows the community and filters down to one person', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)

    const email = `filtrada-${Date.now()}@volvia.test`
    await joinCard(request, card.joinSlug, email)
    await ageCustomer(session, email, {
      joinedDaysAgo: 300,
      lastStampDaysAgo: 250,
      totalStamps: 4,
    })

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/customers`)

    await expect(page.getByRole('heading', { name: 'Tu comunidad' })).toBeVisible()
    await expect(page.getByText('cada mes')).toBeVisible()

    await page.getByRole('link', { name: 'Perdidos' }).first().click()
    await expect(page).toHaveURL(/segment=lost/)
    await expect(page.getByRole('table').getByText(email)).toBeVisible()
  })
})

test.describe('campaigns built from a selection', () => {
  test('reach the people chosen in the list and nobody else', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)

    for (let index = 0; index < 4; index += 1) {
      await joinCard(request, card.joinSlug, `pick-${Date.now()}-${index}@volvia.test`)
    }

    const all = await request.get(`${urls.api}/v1/customers?pageSize=50`, {
      headers: authHeaders(session),
    })
    const picked = ((await all.json()).items as Array<{ id: string }>).slice(0, 2)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/campaigns?customers=${picked.map((p) => p.id).join(',')}`)

    await expect(page.getByText('solo a los 2 clientes que elegiste')).toBeVisible()

    await page.getByRole('button', { name: /Novedad/ }).click()
    await expect(page.getByText('Llega a 2 clientes')).toBeVisible()
  })

  test('show the monthly allowance before it runs out', async ({ page, request }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/campaigns`)

    await expect(page.getByText(/0 de \d+ este mes/)).toBeVisible()
  })

  test('explain the placeholders with a real sentence', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    await createAndPublishCard(request, session)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/campaigns`)

    await page.getByRole('button', { name: /Última llamada/ }).click()

    // The preview resolves the placeholders instead of showing braces.
    await expect(page.getByText('Te quedan 2 sellos')).toBeVisible()
    await expect(page.getByText('los que le faltan')).toBeVisible()
  })
})
