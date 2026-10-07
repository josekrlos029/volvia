import { expect, test } from '@playwright/test'
import {
  authHeaders,
  createAndPublishCard,
  joinCard,
  registerBusiness,
  signIn,
  uniqueBusiness,
  urls,
} from '../helpers'

/**
 * What the business can change about a card, and what it cannot change once people are
 * collecting against it.
 */
test.describe('a card that starts with a head start', () => {
  test('hands the customer stamps the moment they join', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session, {
      stampsRequired: 6,
      initialStamps: 2,
      rewards: [{ atStamp: 6, title: 'Café gratis', description: '' }],
    })
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await expect(page.getByText('2 / 6')).toBeVisible()
  })

  test('never hands over the reward itself', async ({ request }) => {
    const session = await registerBusiness(request)
    const response = await request.post(`${urls.api}/v1/cards`, {
      headers: authHeaders(session),
      data: {
        name: 'Regalada',
        stampsRequired: 3,
        initialStamps: 3,
        rules: { cooldownMinutes: 0, dailyCap: 10, maxStampsPerScan: 1 },
        rewards: [{ atStamp: 3, title: 'Gratis', description: '' }],
        terms: '',
      },
    })
    expect(response.status()).toBe(422)
    expect(await response.text()).toContain('initial_stamps_complete_card')
  })
})

test.describe('what the card says', () => {
  test('shows the line written for the moment the customer is in', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session, {
      stampsRequired: 6,
      initialStamps: 1,
      messages: {
        variants: ['Gracias por volver'],
        perStamp: { '1': 'Bienvenida, ya llevas uno' },
      },
      rewards: [{ atStamp: 6, title: 'Café gratis', description: '' }],
    })
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await expect(page.getByText('Bienvenida, ya llevas uno')).toBeVisible()

    // Past that moment, the rotating line takes over.
    await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: {
        cardToken: customer.token,
        count: 1,
        source: 'staff_scan',
        idempotencyKey: `msg-${Date.now()}`,
      },
    })

    await page.reload()
    await expect(page.getByText('Gracias por volver')).toBeVisible()
  })
})

test.describe('a card with customers on it', () => {
  test('cannot have its rewards rewritten underneath them', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await joinCard(request, card.joinSlug)

    const rewritten = await request.patch(`${urls.api}/v1/cards/${card.id}`, {
      headers: authHeaders(session),
      data: {
        rewards: [{ atStamp: 4, title: 'Algo más barato', description: '', kind: 'free_item' }],
      },
    })
    expect(rewritten.status()).toBe(409)

    const shortened = await request.patch(`${urls.api}/v1/cards/${card.id}`, {
      headers: authHeaders(session),
      data: { stampsRequired: 10 },
    })
    expect(shortened.status()).toBe(409)

    const headStart = await request.patch(`${urls.api}/v1/cards/${card.id}`, {
      headers: authHeaders(session),
      data: { initialStamps: 3 },
    })
    expect(headStart.status()).toBe(409)
  })

  test('can still be redesigned and rewritten', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await joinCard(request, card.joinSlug)

    const restyled = await request.patch(`${urls.api}/v1/cards/${card.id}`, {
      headers: authHeaders(session),
      data: {
        design: { stampStyle: 'square', bannerPattern: 'dots', bannerPatternOpacity: 20 },
        messages: { variants: ['Nos alegra verte'] },
        terms: 'Un sello por visita, una recompensa por tarjeta.',
      },
    })
    expect(restyled.ok(), await restyled.text()).toBeTruthy()

    const body = await restyled.json()
    expect(body.design.stampStyle).toBe('square')
    expect(body.design.bannerPattern).toBe('dots')
  })

  test('saving the editor without touching the deal is not blocked', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await joinCard(request, card.joinSlug)

    // The editor re-sends every reward on each save; that must not count as a change.
    const resaved = await request.patch(`${urls.api}/v1/cards/${card.id}`, {
      headers: authHeaders(session),
      data: {
        rewards: [
          { atStamp: 2, title: 'Postre gratis', description: '', kind: 'free_item' },
          { atStamp: 4, title: 'Plato gratis', description: 'El que quieras', kind: 'free_item' },
        ],
      },
    })
    expect(resaved.ok(), await resaved.text()).toBeTruthy()
  })
})

test.describe('the card editor', () => {
  test('offers the head start, the textures and the card messages', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/cards/${card.id}`)

    await expect(page.getByText('Sellos de regalo al unirse')).toBeVisible()
    await expect(page.getByText('Forma del sello')).toBeVisible()
    await expect(page.getByText('Textura encima')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lo que dice la tarjeta' })).toBeVisible()

    // Writing a line shows it on the preview straight away.
    await page.getByRole('button', { name: 'Añadir frase' }).click()
    const firstLine = page.getByRole('textbox', { name: 'Frase 1' })
    await firstLine.fill('Nos alegra verte de nuevo')

    await expect(firstLine).toHaveValue('Nos alegra verte de nuevo')
    // And straight away on the live preview beside it.
    await expect(page.getByText('Nos alegra verte de nuevo').first()).toBeVisible()
  })

  test('explains why the deal is locked instead of failing on save', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)
    await joinCard(request, card.joinSlug)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/cards/${card.id}`)

    await expect(page.getByText('ya hay clientes con sellos en esta tarjeta').first()).toBeVisible()
  })
})
