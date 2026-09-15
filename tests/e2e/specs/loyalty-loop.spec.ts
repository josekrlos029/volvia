import { expect, test } from '@playwright/test'
import {
  authHeaders,
  createAndPublishCard,
  idempotencyKey,
  joinCard,
  registerBusiness,
  urls,
} from '../helpers'

/**
 * The circuit the whole product exists for: a business publishes a card, a customer
 * joins from the QR, staff stamp it, a reward unlocks, the customer claims it, and the
 * card resets. If this passes, Volvia works.
 */
test.describe('loyalty loop', () => {
  test('a customer joins, fills a card, and claims the reward', async ({ request, page }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)

    // The join page a customer reaches by scanning the counter QR.
    await page.goto(`${urls.pass}/j/${card.joinSlug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      session.business.businessName,
    )

    await page.fill('#firstName', 'Camila')
    await page.fill('#email', `camila-${Date.now()}@volvia.test`)
    await page.click('button[type=submit]')

    // Landing on the card means the signup completed and the token is valid.
    await page.waitForURL(/\/c\/[A-Za-z0-9_-]{16,}/)
    const token = page.url().split('/c/')[1]!.split('?')[0]!
    await expect(page.getByText('0 / 4')).toBeVisible()

    // Stamp 1: nothing unlocked yet.
    const first = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: token, count: 1, idempotencyKey: idempotencyKey() },
    })
    expect(first.ok()).toBeTruthy()
    expect((await first.json()).unlockedRewards).toHaveLength(0)

    // Stamp 2 crosses the intermediate reward.
    const second = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: token, count: 1, idempotencyKey: idempotencyKey() },
    })
    const secondBody = await second.json()
    expect(secondBody.stampsCount).toBe(2)
    expect(secondBody.unlockedRewards[0].title).toBe('Postre gratis')

    // Stamps 3 and 4 complete the card, which resets and starts a new cycle.
    await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: token, count: 1, idempotencyKey: idempotencyKey() },
    })
    const fourth = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: token, count: 1, idempotencyKey: idempotencyKey() },
    })
    const fourthBody = await fourth.json()
    expect(fourthBody.stampsCount, 'card resets on completion').toBe(0)
    expect(fourthBody.cycleIndex, 'a new cycle begins').toBe(1)
    expect(fourthBody.unlockedRewards[0].title).toBe('Plato gratis')

    const rewardCode = fourthBody.unlockedRewards[0].code as string

    // The customer sees the reward and its code on their card.
    await page.goto(`${urls.pass}/c/${token}`)
    await expect(page.getByText('¡Tu recompensa está lista!')).toBeVisible()
    await expect(page.getByText(rewardCode)).toBeVisible()

    // Staff redeems by typing the code.
    const redeemed = await request.post(`${urls.api}/v1/redeem`, {
      headers: authHeaders(session),
      data: { code: rewardCode, idempotencyKey: idempotencyKey() },
    })
    expect(redeemed.ok()).toBeTruthy()
    expect((await redeemed.json()).title).toBe('Plato gratis')

    // Redeeming the same code again is a conflict, not a second free meal.
    const replay = await request.post(`${urls.api}/v1/redeem`, {
      headers: authHeaders(session),
      data: { code: rewardCode, idempotencyKey: idempotencyKey() },
    })
    expect(replay.status()).toBe(409)
    expect((await replay.json()).error.code).toBe('REWARD_ALREADY_REDEEMED')
  })

  test('joining twice with the same email returns the same card', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)

    const email = `repetido-${Date.now()}@volvia.test`
    const first = await joinCard(request, card.joinSlug, email)
    const second = await joinCard(request, card.joinSlug, email)

    expect(first.isNew).toBe(true)
    expect(second.isNew).toBe(false)
    expect(second.token, 'a customer never ends up with two cards').toBe(first.token)
  })

  test('a replayed scan does not stamp twice', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    const key = idempotencyKey()
    const payload = { cardToken: customer.token, count: 1, idempotencyKey: key }

    const first = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: payload,
    })
    const second = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: payload,
    })

    const firstBody = await first.json()
    const secondBody = await second.json()

    expect(firstBody.stampsCount).toBe(1)
    expect(secondBody.stampsCount, 'the retry returns the original result').toBe(1)
    expect(secondBody.replayed).toBe(true)
  })

  test('anti-fraud rules stop a customer being stamped repeatedly', async ({ request }) => {
    const session = await registerBusiness(request)
    // A card with a real cooldown, which is how a shop would actually configure it.
    const card = await createAndPublishCard(request, session, {
      name: 'Con espera',
      rules: { cooldownMinutes: 30, dailyCap: 2, maxStampsPerScan: 1 },
    })
    const customer = await joinCard(request, card.joinSlug)

    const ok = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: customer.token, count: 1, idempotencyKey: idempotencyKey() },
    })
    expect(ok.ok()).toBeTruthy()

    const blocked = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: customer.token, count: 1, idempotencyKey: idempotencyKey() },
    })
    expect(blocked.status()).toBe(429)
    expect((await blocked.json()).error.code).toBe('STAMP_COOLDOWN_ACTIVE')
  })
})
