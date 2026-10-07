import { expect, test } from '@playwright/test'
import {
  authHeaders,
  connectGooglePlace,
  createAndPublishCard,
  createSurvey,
  joinCard,
  registerBusiness,
  urls,
} from '../helpers'

/**
 * Surveys and Google review prompts, on the surface where the customer meets them.
 *
 * Both features were fully built in the API and completely unreachable: the customer
 * card never rendered either one. These tests drive the card page itself, so a survey
 * that cannot be answered by a person counts as a failure again.
 */
test.describe('surveys on the customer card', () => {
  test('the card asks the survey the business configured', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)

    await expect(page.getByRole('heading', { name: 'Cuéntanos cómo nos fue' })).toBeVisible()
    await expect(page.getByText('¿Cómo estuvo tu visita?')).toBeVisible()
    await expect(page.getByRole('button', { name: '5 de 5' })).toBeVisible()
  })

  test('a happy answer leads to the Google review prompt', async ({ page, request }) => {
    const session = await registerBusiness(request)
    await connectGooglePlace(request, session)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await page.getByRole('button', { name: '5 de 5' }).click()
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()

    await expect(page.getByRole('heading', { name: '¿Nos dejas una reseña?' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Escribir en Google' })).toHaveAttribute(
      'href',
      /search\.google\.com\/local\/writereview/,
    )
  })

  test('an unhappy answer keeps the feedback private', async ({ page, request }) => {
    const session = await registerBusiness(request)
    await connectGooglePlace(request, session)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await page.getByRole('button', { name: '2 de 5' }).click()
    await page.getByRole('textbox').fill('La espera fue larga')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Gracias por contarnos' })).toBeVisible()
    // A business should never be able to funnel a bad experience to a public review.
    await expect(page.getByRole('link', { name: 'Escribir en Google' })).toHaveCount(0)
  })

  test('the business reads the answer, rating and comment included', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const survey = await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await page.getByRole('button', { name: '3 de 5' }).click()
    await page.getByRole('textbox').fill('Más mesas, por favor')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gracias por contarnos' })).toBeVisible()

    const responses = await request.get(`${urls.api}/v1/surveys/${survey.id}/responses`, {
      headers: authHeaders(session),
    })
    expect(responses.ok(), await responses.text()).toBeTruthy()
    const body = await responses.json()
    const rows = Array.isArray(body) ? body : (body.items ?? body.responses)

    expect(rows).toHaveLength(1)
    expect(rows[0].rating).toBe(3)
    expect(JSON.stringify(rows[0].answers)).toContain('Más mesas')
  })

  test('a survey already answered is not asked again', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await page.getByRole('button', { name: '4 de 5' }).click()
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gracias por contarnos' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Cuéntanos cómo nos fue' })).toHaveCount(0)
  })

  test('a survey waiting for the fifth stamp is not asked on the first visit', async ({
    page,
    request,
  }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session, { trigger: 'after_nth_stamp', triggerStamp: 5 })
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)

    await expect(page.getByRole('heading', { name: 'Cuéntanos cómo nos fue' })).toHaveCount(0)
    // The card itself still works, which is the point of not getting in its way.
    await expect(page.getByText('Club de prueba')).toBeVisible()
  })

  test('a paused survey is asked of nobody', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session, { isActive: false })
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await expect(page.getByRole('heading', { name: 'Cuéntanos cómo nos fue' })).toHaveCount(0)
  })

  test('the customer can decline without losing the card', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await page.getByRole('button', { name: 'Ahora no' }).click()

    await expect(page.getByRole('heading', { name: 'Cuéntanos cómo nos fue' })).toHaveCount(0)
    await expect(page.getByText('Club de prueba')).toBeVisible()
  })

  test('a rating is required before the answer can be sent', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    await createSurvey(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()

    await expect(page.locator('p[role="alert"]')).toContainText('Elige una puntuación')
  })
})
