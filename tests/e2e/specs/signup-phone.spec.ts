import { expect, test } from '@playwright/test'
import { authHeaders, createAndPublishCard, registerBusiness, urls } from '../helpers'

/**
 * The signup form asks for a phone when the card says so, and the questions a
 * business writes keep their identity when the list is saved again.
 */
test.describe('signup form', () => {
  test('a card that collects phones gets them, stored and searchable', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session, {
      collectPhone: true,
      phoneRequired: true,
    })

    const page = await request.get(`${urls.api}/p/join/${card.joinSlug}`)
    expect(page.ok(), await page.text()).toBeTruthy()
    const join = (await page.json()) as { card: { collectPhone: boolean; phoneRequired: boolean } }
    expect(join.card.collectPhone).toBe(true)
    expect(join.card.phoneRequired).toBe(true)

    const email = `tel-${Date.now()}@volvia.test`
    const joined = await request.post(`${urls.api}/p/join/${card.joinSlug}`, {
      data: { firstName: 'Ana', email, marketingConsent: true, phone: '+57 300 123 4567' },
    })
    expect(joined.ok(), await joined.text()).toBeTruthy()
    const customer = (await joined.json()) as { customerId: string }

    const detail = await request.get(`${urls.api}/v1/customers/${customer.customerId}`, {
      headers: authHeaders(session),
    })
    expect(detail.ok(), await detail.text()).toBeTruthy()
    expect(((await detail.json()) as { customer: { phone: string } }).customer.phone).toBe(
      '+573001234567',
    )

    // Typed with spaces, found all the same.
    const found = await request.get(
      `${urls.api}/v1/customers?search=${encodeURIComponent('123 4567')}`,
      {
        headers: authHeaders(session),
      },
    )
    expect(found.ok(), await found.text()).toBeTruthy()
    const list = (await found.json()) as { items: Array<{ email: string }> }
    expect(list.items.map((item) => item.email)).toContain(email)

    const csv = await request.get(`${urls.api}/v1/customers/export.csv`, {
      headers: authHeaders(session),
    })
    expect(csv.ok(), await csv.text()).toBeTruthy()
    const text = await csv.text()
    expect(text.split('\n')[0]).toContain('telefono')
    expect(text).toContain('+573001234567')
  })

  test('a card that does not ask for a phone ignores one, and a bad one is refused', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session, {
      collectPhone: true,
      phoneRequired: false,
    })
    const bad = await request.post(`${urls.api}/p/join/${card.joinSlug}`, {
      data: { firstName: 'Ana', email: `x-${Date.now()}@volvia.test`, phone: 'llámame' },
    })
    expect(bad.status()).toBe(422)

    const blank = await request.post(`${urls.api}/p/join/${card.joinSlug}`, {
      data: { firstName: 'Ana', email: `y-${Date.now()}@volvia.test`, phone: '' },
    })
    expect(blank.ok(), await blank.text()).toBeTruthy()
  })

  test('saving the questions again keeps their ids, so cards keep asking them', async ({
    request,
  }) => {
    const session = await registerBusiness(request)

    const first = await request.put(`${urls.api}/v1/org/profile-questions`, {
      headers: authHeaders(session),
      data: [
        { prompt: 'Tu bebida favorita', type: 'single_choice', options: ['Café', 'Té'] },
        { prompt: '¿Cómo nos conociste?', type: 'text' },
      ],
    })
    expect(first.ok(), await first.text()).toBeTruthy()
    const saved = (await first.json()) as Array<{ id: string; prompt: string }>
    expect(saved).toHaveLength(2)
    const drink = saved.find((question) => question.prompt === 'Tu bebida favorita')!

    const card = await createAndPublishCard(request, session, { signupQuestionIds: [drink.id] })

    // Edit the wording of one, drop the other, add a third.
    const second = await request.put(`${urls.api}/v1/org/profile-questions`, {
      headers: authHeaders(session),
      data: [
        {
          id: drink.id,
          prompt: 'Tu bebida de siempre',
          type: 'single_choice',
          options: ['Café', 'Té'],
        },
        { prompt: 'Apellido', type: 'text' },
      ],
    })
    expect(second.ok(), await second.text()).toBeTruthy()
    const resaved = (await second.json()) as Array<{ id: string; prompt: string }>
    expect(resaved.map((question) => question.prompt)).toEqual(['Tu bebida de siempre', 'Apellido'])
    expect(resaved[0]!.id, 'the edited question kept its id').toBe(drink.id)

    // The card still asks it, under its new wording.
    const join = await request.get(`${urls.api}/p/join/${card.joinSlug}`)
    const page = (await join.json()) as { questions: Array<{ id: string; prompt: string }> }
    expect(page.questions.map((question) => question.id)).toEqual([drink.id])
    expect(page.questions[0]!.prompt).toBe('Tu bebida de siempre')
  })
})
