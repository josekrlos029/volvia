import { expect, test } from '@playwright/test'
import { createAndPublishCard, joinCard, registerBusiness, urls } from '../helpers'

/**
 * Wallet passes.
 *
 * With development certificates the pass is structurally real but not installable on a
 * device, so these tests check the parts that must be right either way: the archive
 * shape, the content, and the web service that keeps a pass up to date.
 */
test.describe('wallet passes', () => {
  test('a signed pkpass is generated for a customer card', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    const response = await request.get(`${urls.api}/wallet/apple/pass/${customer.token}`)
    expect(response.ok(), await response.text()).toBeTruthy()
    expect(response.headers()['content-type']).toBe('application/vnd.apple.pkpass')
    // A pass must never be cached: it changes on every stamp.
    expect(response.headers()['cache-control']).toContain('no-store')

    const buffer = await response.body()
    // The zip local file header, which is what makes this a readable archive.
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK')
    expect(buffer.length).toBeGreaterThan(1_000)
  })

  test('the PassKit web service refuses an unauthenticated device', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    const response = await request.post(
      `${urls.api}/wallet/apple/v1/devices/device-e2e/registrations/pass.co.volvia.loyalty/${customer.token}`,
      { data: { pushToken: 'token-e2e' } },
    )
    expect(response.status()).toBe(401)
  })

  test('a card link is not guessable from another customer token', async ({ request }) => {
    const session = await registerBusiness(request)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    // Flip one character: the token is opaque, so a near miss must not resolve.
    const tampered = `${customer.token.slice(0, -1)}${customer.token.at(-1) === 'a' ? 'b' : 'a'}`
    const response = await request.get(`${urls.api}/p/card/${tampered}`)
    expect(response.status()).toBe(404)
  })
})
