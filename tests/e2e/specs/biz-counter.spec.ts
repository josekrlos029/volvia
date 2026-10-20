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
 * What Volvia Biz 1.2 does at the counter beyond a plain scan: look the card up before
 * stamping, stamp a customer picked from the list, undo a mistaken scan, sign a new
 * customer up, and list the cashier's own scans of the day.
 */
test.describe('Volvia Biz at the counter', () => {
  test('lookup, stamp by customer card, undo and my activity', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const joined = await joinCard(request, card.joinSlug)
    const headers = authHeaders(session)

    const lookup = await request.get(`${urls.api}/v1/lookup?cardToken=${joined.token}`, {
      headers,
    })
    expect(lookup.ok(), await lookup.text()).toBeTruthy()
    const looked = await lookup.json()
    expect(looked.customer.firstName).toBe('María')
    expect(looked.stampsCount).toBe(0)
    expect(looked.card.maxStampsPerScan).toBe(5)
    expect(looked.design.rewardPositions).toEqual([2, 4])

    // Two stamps in one go cross the first reward.
    const stamped = await request.post(`${urls.api}/v1/stamp`, {
      headers,
      data: { customerCardId: looked.customerCardId, count: 2, idempotencyKey: idempotencyKey() },
    })
    expect(stamped.status(), await stamped.text()).toBe(201)
    const result = await stamped.json()
    expect(result.stampsCount).toBe(2)
    expect(result.unlockedRewards).toHaveLength(1)
    expect(result.eventId).toBeTruthy()

    const mine = await request.get(`${urls.api}/v1/activity/mine`, { headers })
    const { items } = await mine.json()
    expect(items[0]).toMatchObject({ kind: 'stamp', delta: 2, canVoid: true, firstName: 'María' })

    const voided = await request.post(`${urls.api}/v1/stamp/${result.eventId}/void`, {
      headers,
      data: { reason: 'Cliente equivocado' },
    })
    expect(voided.ok(), await voided.text()).toBeTruthy()
    expect(await voided.json()).toMatchObject({ stampsCount: 0, stampsRemoved: 2, rewardsRevoked: 1 })

    // The reward it unlocked is gone, and the same scan cannot be undone twice.
    const after = await (
      await request.get(`${urls.api}/v1/lookup?cardToken=${joined.token}`, { headers })
    ).json()
    expect(after.stampsCount).toBe(0)
    expect(after.pendingRewards).toHaveLength(0)

    const again = await request.post(`${urls.api}/v1/stamp/${result.eventId}/void`, {
      headers,
      data: {},
    })
    expect(again.status()).toBe(409)
    expect((await again.json()).error.code).toBe('STAMP_VOID_NOT_ALLOWED')

    const listed = (await (await request.get(`${urls.api}/v1/activity/mine`, { headers })).json())
      .items
    expect(listed.map((item: { kind: string }) => item.kind)).toEqual(['void', 'stamp'])
    expect(listed[1].canVoid).toBe(false)
  })

  test('a card of another business is invisible', async ({ request }) => {
    const owner = await registerBusiness(request)
    const card = await createAndPublishCard(request, owner)
    const joined = await joinCard(request, card.joinSlug)
    const rival = await registerBusiness(request)

    const lookup = await request.get(`${urls.api}/v1/lookup?cardToken=${joined.token}`, {
      headers: authHeaders(rival),
    })
    expect(lookup.status()).toBe(404)

    const ownLookup = await (
      await request.get(`${urls.api}/v1/lookup?cardToken=${joined.token}`, {
        headers: authHeaders(owner),
      })
    ).json()
    const stamp = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(rival),
      data: { customerCardId: ownLookup.customerCardId, idempotencyKey: idempotencyKey() },
    })
    expect(stamp.status()).toBe(404)
  })

  test('sign-up at the counter, with the first stamp and Habeas Data consent', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const headers = authHeaders(session)
    const email = `mostrador-${Date.now()}@volvia.test`

    const withoutConsent = await request.post(`${urls.api}/v1/enroll`, {
      headers,
      data: { cardId: card.id, firstName: 'Ana', email, idempotencyKey: idempotencyKey() },
    })
    expect(withoutConsent.status()).toBe(422)

    const enrolled = await request.post(`${urls.api}/v1/enroll`, {
      headers,
      data: {
        cardId: card.id,
        firstName: 'Ana',
        email,
        phone: '+573001234567',
        dataConsent: true,
        marketingConsent: true,
        stampNow: true,
        idempotencyKey: idempotencyKey(),
      },
    })
    expect(enrolled.status(), await enrolled.text()).toBe(201)
    const body = await enrolled.json()
    expect(body.isNew).toBe(true)
    expect(body.cardUrl).toContain(`/c/${body.cardToken}`)
    expect(body.stamp.stampsCount).toBe(1)

    // The same customer again gets their existing card back, never a second one.
    const twice = await request.post(`${urls.api}/v1/enroll`, {
      headers,
      data: {
        cardId: card.id,
        firstName: 'Ana',
        email,
        dataConsent: true,
        idempotencyKey: idempotencyKey(),
      },
    })
    expect(twice.status()).toBe(200)
    expect((await twice.json()).cardToken).toBe(body.cardToken)
  })
})
