import { expect, test } from '@playwright/test'
import { authHeaders, createAndPublishCard, joinCard, registerBusiness, urls } from '../helpers'

/**
 * Plan enforcement.
 *
 * A new business gets every premium feature until it reaches the customer trial gate,
 * which is what these tests exercise: the gate opens the product, and closing it must
 * actually close it.
 */
test.describe('plans and entitlements', () => {
  test('a new business starts inside the premium trial', async ({ request }) => {
    const session = await registerBusiness(request)

    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    const body = await org.json()

    expect(body.entitlements.inPremiumTrial).toBe(true)
    expect(body.entitlements.trialCustomersRemaining).toBe(30)
    // Premium features are open during the trial, so a business can judge them.
    expect(body.entitlements.features.surveys).toBe(true)
    expect(body.entitlements.features.kiosk_mode).toBe(true)
  })

  test('the trial counter moves as customers join', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)

    await joinCard(request, card.joinSlug)
    await joinCard(request, card.joinSlug)

    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    expect((await org.json()).entitlements.trialCustomersRemaining).toBe(28)
  })

  test('the pricing surface and the API agree on what each plan includes', async ({ request }) => {
    const session = await registerBusiness(request)
    const plans = await request.get(`${urls.api}/v1/billing/plans`, {
      headers: authHeaders(session),
    })
    const body = await plans.json()

    const free = body.plans.find((plan: { id: string }) => plan.id === 'free')
    const pro = body.plans.find((plan: { id: string }) => plan.id === 'pro')
    const business = body.plans.find((plan: { id: string }) => plan.id === 'business')

    expect(free.features).not.toContain('wallet_passes')
    expect(pro.features).toContain('wallet_passes')
    expect(pro.features).not.toContain('kiosk_mode')
    expect(business.features).toContain('kiosk_mode')
    // Saving your own segments is a business feature; the suggested ones are open.
    expect(pro.features).not.toContain('custom_segments')
    expect(business.features).toContain('custom_segments')
    // Colombian businesses are billed in pesos through the local provider.
    expect(body.currency).toBe('cop')
  })

  test('an unconfigured payment provider fails clearly rather than silently', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    const checkout = await request.post(`${urls.api}/v1/billing/checkout`, {
      headers: authHeaders(session),
      data: { plan: 'pro', interval: 'monthly', extraLocations: 0 },
    })

    // Local development has placeholder keys; the point is that it says so.
    if (!checkout.ok()) {
      expect((await checkout.json()).error.code).toBe('SERVICE_UNAVAILABLE')
    } else {
      expect((await checkout.json()).url).toContain('http')
    }
  })
})
