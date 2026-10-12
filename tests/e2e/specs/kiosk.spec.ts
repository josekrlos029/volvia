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
 * The self-service screen: a tablet shows a QR that changes every half minute, the
 * customer's phone posts the code, and the screen learns that a stamp went through so
 * it can celebrate and show a fresh code at once.
 */
test.describe('kiosk', () => {
  test('a stamp through the kiosk is reported back to the screen', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session, {
      rules: { cooldownMinutes: 0, dailyCap: 20, maxStampsPerScan: 1, kioskEnabled: true },
    })
    const customer = await joinCard(request, card.joinSlug)

    const locations = await request.get(`${urls.api}/v1/org/locations`, {
      headers: authHeaders(session),
    })
    const locationId = ((await locations.json()) as Array<{ id: string }>)[0]?.id
    expect(locationId, 'a new business starts with one location').toBeTruthy()

    const opened = await request.post(`${urls.api}/v1/kiosk/session`, {
      headers: authHeaders(session),
      data: { cardId: card.id, locationId },
    })
    expect(opened.ok(), await opened.text()).toBeTruthy()
    const kiosk = (await opened.json()) as { sessionId: string; secret: string }

    const before = await request.post(`${urls.api}/v1/kiosk/status`, { data: kiosk })
    expect((await before.json()).lastStamp).toBeNull()

    const issued = await request.post(`${urls.api}/v1/kiosk/nonce`, { data: kiosk })
    const { nonce } = (await issued.json()) as { nonce: string }

    const stamped = await request.post(`${urls.api}/v1/kiosk/stamp`, {
      data: { nonce, cardToken: customer.token, idempotencyKey: idempotencyKey() },
    })
    expect(stamped.status(), await stamped.text()).toBe(201)
    expect((await stamped.json()).design.nextReward).toMatchObject({ atStamp: 2 })

    const after = await request.post(`${urls.api}/v1/kiosk/status`, { data: kiosk })
    const { lastStamp } = (await after.json()) as {
      lastStamp: { at: number; rewardUnlocked: boolean } | null
    }
    expect(lastStamp?.rewardUnlocked).toBe(false)
    expect(lastStamp?.at).toBeGreaterThan(Date.now() - 60_000)

    // The status says nothing about who stamped: the screen is public.
    expect(Object.keys(lastStamp ?? {}).sort()).toEqual(['at', 'rewardUnlocked'])

    const stranger = await request.post(`${urls.api}/v1/kiosk/status`, {
      data: { sessionId: kiosk.sessionId, secret: 'x'.repeat(24) },
    })
    expect(stranger.status()).toBe(401)
  })
})
