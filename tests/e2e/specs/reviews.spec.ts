import { expect, test } from '@playwright/test'
import {
  authHeaders,
  connectGooglePlace,
  createAndPublishCard,
  createSurvey,
  joinCard,
  registerBusiness,
  signIn,
  uniqueBusiness,
  urls,
} from '../helpers'

/** Asking a happy customer for a public review, and knowing whether it worked. */
async function askAndOpen(
  request: Parameters<typeof registerBusiness>[0],
  session: { accessToken: string; orgId: string },
  joinSlug: string,
  surveyId: string,
  email: string,
) {
  const customer = await joinCard(request, joinSlug, email)
  const answered = await request.post(`${urls.api}/p/survey/${surveyId}`, {
    data: { cardToken: customer.token, answers: [{ questionIndex: 0, rating: 5 }] },
  })
  const body = await answered.json()
  if (body.reviewRequestId) {
    await request.post(`${urls.api}/p/review/${body.reviewRequestId}/click`)
  }
  return body as { reviewUrl: string | null; reviewRequestId: string | null }
}

test.describe('Google review requests', () => {
  test('count what was asked and what was actually opened', async ({ request }) => {
    const session = await registerBusiness(request)
    await connectGooglePlace(request, session)
    const card = await createAndPublishCard(request, session)
    const survey = await createSurvey(request, session)

    await askAndOpen(request, session, card.joinSlug, survey.id, `rev-a-${Date.now()}@volvia.test`)

    const stats = await request.get(`${urls.api}/v1/reviews`, { headers: authHeaders(session) })
    const body = await stats.json()

    expect(body.connected).toBe(true)
    expect(body.shown).toBe(1)
    expect(body.opened).toBe(1)
  })

  test('nobody is asked twice in the same half year', async ({ request }) => {
    const session = await registerBusiness(request)
    await connectGooglePlace(request, session)
    const card = await createAndPublishCard(request, session)
    const first = await createSurvey(request, session, { name: 'Primera' })
    const second = await createSurvey(request, session, { name: 'Segunda' })

    const email = `rev-twice-${Date.now()}@volvia.test`
    const one = await askAndOpen(request, session, card.joinSlug, first.id, email)
    expect(one.reviewUrl).not.toBeNull()

    // The same customer answering a second survey, just as happily.
    const two = await askAndOpen(request, session, card.joinSlug, second.id, email)
    expect(two.reviewUrl).toBeNull()
  })

  test('pausing stops the ask without losing the connection', async ({ request }) => {
    const session = await registerBusiness(request)
    await connectGooglePlace(request, session)
    const card = await createAndPublishCard(request, session)
    const survey = await createSurvey(request, session)

    await request.patch(`${urls.api}/v1/org`, {
      headers: authHeaders(session),
      data: { settings: { reviewRequestsPaused: true } },
    })

    const asked = await askAndOpen(
      request,
      session,
      card.joinSlug,
      survey.id,
      `rev-paused-${Date.now()}@volvia.test`,
    )
    expect(asked.reviewUrl).toBeNull()

    const stats = await request.get(`${urls.api}/v1/reviews`, { headers: authHeaders(session) })
    const body = await stats.json()
    expect(body.connected).toBe(true)
    expect(body.paused).toBe(true)
    expect(body.shown).toBe(0)
  })

  test('the screen says what to do when Google is not connected yet', async ({ page, request }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/reviews`)

    await expect(page.getByRole('heading', { name: 'Conecta tu ficha de Google' })).toBeVisible()
  })

  test('the screen shows the numbers and can pause the asking', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)
    await connectGooglePlace(request, session)
    const card = await createAndPublishCard(request, session)
    const survey = await createSurvey(request, session)
    await askAndOpen(request, session, card.joinSlug, survey.id, `rev-ui-${Date.now()}@volvia.test`)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/reviews`)

    await expect(page.getByText('Veces que se pidió')).toBeVisible()
    await expect(page.getByText('Fueron a Google')).toBeVisible()

    await page.getByRole('button', { name: 'Pausar las reseñas' }).click()
    await expect(page.getByRole('button', { name: 'Volver a pedir reseñas' })).toBeVisible()
  })
})
