import { expect, test } from '@playwright/test'
import { createAndPublishCard, registerBusiness, urls } from '../helpers'

test.describe('public surfaces', () => {
  test('the marketing home renders in both languages', async ({ page }) => {
    await page.goto(`${urls.web}/es`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveTitle(/Volvia/)

    await page.goto(`${urls.web}/en`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/come back/i)
  })

  test('pricing shows every plan', async ({ page }) => {
    await page.goto(`${urls.web}/es/precios`)
    for (const plan of ['Gratis', 'Pro', 'Negocio', 'Multi']) {
      await expect(page.getByRole('heading', { name: plan, exact: true })).toBeVisible()
    }
  })

  test('the sitemap lists both languages and the industry pages', async ({ request }) => {
    const response = await request.get(`${urls.web}/sitemap.xml`)
    expect(response.ok()).toBeTruthy()

    const xml = await response.text()
    expect(xml).toContain('/es/precios')
    expect(xml).toContain('/en/precios')
    expect(xml).toContain('/es/sectores/cafeterias')
  })

  test('a business page is public and a customer card is not indexable', async ({
    page,
    request,
  }) => {
    const session = await registerBusiness(request)
    await createAndPublishCard(request, session)

    const org = await request.get(`${urls.api}/v1/org`, {
      headers: { authorization: `Bearer ${session.accessToken}`, 'x-org-id': session.orgId },
    })
    const slug = (await org.json()).slug

    await page.goto(`${urls.pass}/b/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      session.business.businessName,
    )

    // A customer's card link must never be indexed.
    const cardResponse = await page.request.get(`${urls.pass}/es`)
    expect(cardResponse.headers()['x-robots-tag']).toContain('noindex')
  })

  test('the dashboard sends a signed-out visitor to the login screen', async ({ page }) => {
    await page.goto(`${urls.app}/`)
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
