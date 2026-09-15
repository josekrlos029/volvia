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
 * Multi-tenant isolation.
 *
 * One business reading or stamping another's data is the failure that would end the
 * product, so it is tested directly rather than assumed from the query helpers.
 */
test.describe('tenant isolation', () => {
  test('a business cannot read another business data', async ({ request }) => {
    const alice = await registerBusiness(request)
    const bob = await registerBusiness(request)

    const aliceCard = await createAndPublishCard(request, alice)
    await joinCard(request, aliceCard.joinSlug)

    // Bob asking for Alice's card by id must not find it.
    const cardPeek = await request.get(`${urls.api}/v1/cards/${aliceCard.id}`, {
      headers: authHeaders(bob),
    })
    expect(cardPeek.status()).toBe(404)

    // Bob's customer list contains only his own customers, which is to say none.
    const customers = await request.get(`${urls.api}/v1/customers`, { headers: authHeaders(bob) })
    expect(customers.ok()).toBeTruthy()
    expect((await customers.json()).total).toBe(0)

    // Bob's analytics never include Alice's activity.
    const overview = await request.get(`${urls.api}/v1/analytics/overview?preset=30d`, {
      headers: authHeaders(bob),
    })
    expect((await overview.json()).customers.total).toBe(0)
  })

  test('a business cannot stamp a card that belongs to another', async ({ request }) => {
    const alice = await registerBusiness(request)
    const bob = await registerBusiness(request)

    const aliceCard = await createAndPublishCard(request, alice)
    const aliceCustomer = await joinCard(request, aliceCard.joinSlug)

    // Bob holds a valid token, but not one of his.
    const attempt = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(bob),
      data: { cardToken: aliceCustomer.token, count: 1, idempotencyKey: idempotencyKey() },
    })
    expect(attempt.ok(), 'a foreign card must not be stampable').toBeFalsy()
  })

  test('an unauthenticated request reaches nothing private', async ({ request }) => {
    for (const path of ['/v1/cards', '/v1/customers', '/v1/org', '/v1/analytics/overview']) {
      const response = await request.get(`${urls.api}${path}`)
      expect(response.status(), `${path} must require auth`).toBe(401)
    }
  })

  test('the org header cannot be used to reach a foreign organisation', async ({ request }) => {
    const alice = await registerBusiness(request)
    const bob = await registerBusiness(request)

    // Bob's token with Alice's org id: the membership check has to catch this.
    const response = await request.get(`${urls.api}/v1/org`, {
      headers: { authorization: `Bearer ${bob.accessToken}`, 'x-org-id': alice.orgId },
    })
    expect(response.status()).toBe(403)
    expect((await response.json()).error.code).toBe('NOT_A_MEMBER')
  })
})
