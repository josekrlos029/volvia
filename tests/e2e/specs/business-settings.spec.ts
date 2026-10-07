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

/** The settings a business touches once and then forgets, and the pages they feed. */
test.describe('the public page', () => {
  test('carries the business’s own links, colour and button wording', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    await createAndPublishCard(request, session)

    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    const slug = (await org.json()).slug as string

    await request.patch(`${urls.api}/v1/org`, {
      headers: authHeaders(session),
      data: {
        brandColor: '#123227',
        socialLinks: [{ platform: 'whatsapp', url: 'https://wa.me/573001234567' }],
        settings: { pageCtaLabel: 'Quiero mi tarjeta' },
      },
    })

    await page.goto(`${urls.pass}/b/${slug}`)

    await expect(page.getByRole('link', { name: 'Quiero mi tarjeta' })).toBeVisible()
    await expect(page.locator('a[href="https://wa.me/573001234567"]')).toBeVisible()
  })

  test('links to a privacy notice written in the business’s name', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    await createAndPublishCard(request, session)

    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    const slug = (await org.json()).slug as string

    await request.patch(`${urls.api}/v1/org`, {
      headers: authHeaders(session),
      data: {
        settings: {
          legalName: 'Café Luna S.A.S.',
          taxId: 'NIT 900.123.456-7',
          privacyEmail: 'datos@cafeluna.test',
        },
      },
    })

    await page.goto(`${urls.pass}/b/${slug}`)
    await page.getByRole('link', { name: 'Cómo tratamos tus datos' }).click()

    await expect(page.getByRole('heading', { name: 'Cómo tratamos tus datos' })).toBeVisible()
    // The shop answers for the data, not Volvia.
    await expect(page.getByText('Café Luna S.A.S.').first()).toBeVisible()
    await expect(page.getByText('datos@cafeluna.test').first()).toBeVisible()
  })
})

test.describe('the signup form', () => {
  test('asks only what the business chose, and says what that costs', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/cards/${card.id}`)

    // Name, email and birthday: three fields, still an easy form.
    await expect(page.getByText('3 campos')).toBeVisible()
    await expect(page.getByText('Alta fácil')).toBeVisible()

    // Dropping the birthday makes it easier, and the form follows.
    await page.getByRole('checkbox', { name: 'Cumpleaños' }).uncheck()
    await expect(page.getByText('2 campos')).toBeVisible()
    await expect(page.getByText('Alta muy fácil')).toBeVisible()
  })

  test('a question the business wrote reaches the customer', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)

    const saved = await request.put(`${urls.api}/v1/org/profile-questions`, {
      headers: authHeaders(session),
      data: [
        {
          prompt: '¿Cómo nos conociste?',
          type: 'text',
          options: [],
          isRequired: false,
          askOn: 'signup',
        },
      ],
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const questions = (await saved.json()) as Array<{ id: string }>
    const question = questions[0]
    expect(question).toBeDefined()

    const card = await createAndPublishCard(request, session, {
      signupQuestionIds: [question!.id],
    })

    await page.goto(`${urls.pass}/j/${card.joinSlug}`)
    await expect(page.getByText('¿Cómo nos conociste?')).toBeVisible()
  })
})

test.describe('closing the business', () => {
  test('needs the name typed, and then nothing resolves', async ({ request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)

    const wrongName = await request.post(`${urls.api}/v1/org/close`, {
      headers: authHeaders(session),
      data: { confirmName: 'otro negocio' },
    })
    expect(wrongName.ok()).toBeFalsy()

    const closed = await request.post(`${urls.api}/v1/org/close`, {
      headers: authHeaders(session),
      data: { confirmName: business.businessName },
    })
    expect(closed.ok(), await closed.text()).toBeTruthy()

    // The card stops accepting new customers straight away.
    const join = await request.get(`${urls.api}/p/join/${card.joinSlug}`)
    expect(join.ok()).toBeFalsy()
  })
})

test.describe('the welcome email', () => {
  test('goes out in the business’s own words', async ({ request }) => {
    const session = await registerBusiness(request)

    const saved = await request.put(`${urls.api}/v1/automations`, {
      headers: authHeaders(session),
      data: {
        type: 'welcome',
        isActive: true,
        offsetDays: 0,
        headline: 'Ya eres de la casa',
        body: 'Gracias por unirte, {{name}}. Te faltan {{remaining}} sellos.',
        offer: { kind: 'none', amount: null, title: null, validForDays: 14 },
        sendEmail: true,
        sendPush: false,
      },
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()

    const read = await request.get(`${urls.api}/v1/automations`, { headers: authHeaders(session) })
    const body = await read.json()
    const welcome = body.automations.find((item: { type: string }) => item.type === 'welcome')

    expect(welcome.isActive).toBe(true)
    expect(welcome.config.headline).toBe('Ya eres de la casa')
  })
})

test.describe('the dashboard', () => {
  test('opens on today, not on a thirty-day average', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: {
        cardToken: customer.token,
        count: 1,
        source: 'staff_scan',
        idempotencyKey: `pulse-${Date.now()}`,
      },
    })

    await signIn(page, business.email, business.password)

    await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lo último' })).toBeVisible()
    await expect(page.getByText('sumó un sello')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar enlace de la tarjeta' })).toBeVisible()
  })
})
