import { expect, test } from '@playwright/test'
import { createAndPublishCard, joinCard, registerBusiness, signIn, urls } from '../helpers'

/**
 * Phone surfaces. The customer card and the staff scanner are used on a phone almost
 * exclusively, so they are tested at phone width rather than a narrowed desktop.
 */
test.describe('phone surfaces', () => {
  test('the customer card is usable on a phone', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await page.goto(`${urls.pass}/c/${customer.token}`)
    await expect(page.getByText('0 / 4')).toBeVisible()

    // Nothing may overflow horizontally on a phone.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflows, 'the card page must not scroll sideways').toBe(false)

    // Wallet buttons are the primary action and must be reachable.
    await expect(page.getByRole('link', { name: /Apple Wallet/i })).toBeVisible()
  })

  test('the join form is filled comfortably on a phone', async ({ page, request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)

    await page.goto(`${urls.pass}/j/${card.joinSlug}`)

    // A 16px input is what stops iOS zooming in when the field takes focus.
    const fontSize = await page.evaluate(() => {
      const input = document.querySelector('#email')
      return input ? Number.parseFloat(getComputedStyle(input).fontSize) : 0
    })
    expect(fontSize, 'inputs below 16px make iOS zoom on focus').toBeGreaterThanOrEqual(16)

    await page.fill('#firstName', 'Ana')
    await page.fill('#email', `ana-${Date.now()}@volvia.test`)
    await page.click('button[type=submit]')
    await page.waitForURL(/\/c\//)
  })

  test('the scanner opens for signed-in staff', async ({ page, request }) => {
    const session = await registerBusiness(request)
    await signIn(page, session.business.email, session.business.password)

    await page.goto(`${urls.app}/scan`)
    // The camera is unavailable in a headless browser, so the surface should say so
    // rather than sit blank.
    await expect(page.getByText(/cámara|código de la tarjeta/i).first()).toBeVisible()
  })
})
