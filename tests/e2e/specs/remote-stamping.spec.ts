import { expect, test } from '@playwright/test'
import {
  authHeaders,
  createAndPublishCard,
  idempotencyKey,
  registerBusiness,
  urls,
} from '../helpers'

/**
 * Delivery businesses stamp customers they never see, from the browser extension:
 * found by cédula, phone or name, stamped with `channel: 'remote'`, and only once
 * the owner has allowed it.
 */
test.describe('remote stamping', () => {
  test('finds a delivery customer by cédula, phone or name and stamps them', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    const headers = authHeaders(session)
    const card = await createAndPublishCard(request, session, {
      collectPhone: true,
      collectDocument: true,
    })

    const join = await request.get(`${urls.api}/p/join/${card.joinSlug}`)
    expect(
      ((await join.json()) as { card: { collectDocument: boolean } }).card.collectDocument,
    ).toBe(true)

    const joined = await request.post(`${urls.api}/p/join/${card.joinSlug}`, {
      data: {
        firstName: 'Lucía Domicilio',
        email: `remote-${Date.now()}@volvia.test`,
        phone: '+57 301 555 7788',
        documentNumber: '1.065.123.456',
      },
    })
    expect(joined.ok(), await joined.text()).toBeTruthy()
    const { token, customerId } = (await joined.json()) as { token: string; customerId: string }

    // Off by default: nothing is searchable or stampable remotely yet.
    const status = await request.get(`${urls.api}/v1/remote/status`, { headers })
    expect(((await status.json()) as { enabled: boolean }).enabled).toBe(false)
    const refused = await request.get(`${urls.api}/v1/remote/lookup?q=1065123456`, { headers })
    expect(refused.status()).toBe(403)
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe(
      'REMOTE_STAMPING_DISABLED',
    )
    const refusedStamp = await request.post(`${urls.api}/v1/stamp`, {
      headers,
      data: { cardToken: token, idempotencyKey: idempotencyKey(), channel: 'remote' },
    })
    expect(refusedStamp.status()).toBe(403)

    const enabled = await request.patch(`${urls.api}/v1/org`, {
      headers,
      data: { settings: { remoteStamping: true } },
    })
    expect(enabled.ok(), await enabled.text()).toBeTruthy()

    type Lookup = {
      items: Array<{
        cardToken: string
        customer: { firstName: string; phoneTail: string | null; documentTail: string | null }
        missingDocument: boolean
        design: { cardName: string }
      }>
      joinUrl: string | null
    }
    for (const q of ['1065123456', '1.065.123.456', '555 7788', 'lucía']) {
      const found = await request.get(`${urls.api}/v1/remote/lookup?q=${encodeURIComponent(q)}`, {
        headers,
      })
      expect(found.ok(), await found.text()).toBeTruthy()
      const body = (await found.json()) as Lookup
      expect(
        body.items.map((item) => item.cardToken),
        q,
      ).toEqual([token])
      expect(body.items[0]!.customer).toMatchObject({ phoneTail: '7788', documentTail: '3456' })
      expect(body.items[0]!.missingDocument).toBe(false)
    }

    const nobody = await request.get(`${urls.api}/v1/remote/lookup?q=999999999`, { headers })
    const empty = (await nobody.json()) as Lookup
    expect(empty.items).toEqual([])
    expect(empty.joinUrl).toContain(`/j/${card.joinSlug}`)

    const stamped = await request.post(`${urls.api}/v1/stamp`, {
      headers,
      data: {
        cardToken: token,
        idempotencyKey: idempotencyKey(),
        channel: 'remote',
        note: 'Pedido #4512',
      },
    })
    expect(stamped.status(), await stamped.text()).toBe(201)
    expect(((await stamped.json()) as { stampsCount: number }).stampsCount).toBe(1)

    const detail = await request.get(`${urls.api}/v1/customers/${customerId}`, { headers })
    const activity = (
      (await detail.json()) as {
        activity: Array<{ source: string; note: string | null }>
      }
    ).activity
    expect(activity[0]).toMatchObject({ source: 'remote', note: 'Pedido #4512' })
  })

  test('the owner can require an order number, and staff can save a missing cédula', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    const headers = authHeaders(session)
    const card = await createAndPublishCard(request, session, { collectDocument: true })
    await request.patch(`${urls.api}/v1/org`, {
      headers,
      data: { settings: { remoteStamping: true, remoteStampingRequireOrder: true } },
    })

    const joined = await request.post(`${urls.api}/p/join/${card.joinSlug}`, {
      data: { firstName: 'Pedro Sincédula', email: `nodoc-${Date.now()}@volvia.test` },
    })
    const { token, customerId } = (await joined.json()) as { token: string; customerId: string }

    const byName = await request.get(`${urls.api}/v1/remote/lookup?q=sincédula`, { headers })
    const row = ((await byName.json()) as { items: Array<{ missingDocument: boolean }> }).items[0]
    expect(row?.missingDocument).toBe(true)

    const saved = await request.put(`${urls.api}/v1/remote/customers/${customerId}/document`, {
      headers,
      data: { documentNumber: '98.765.432' },
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const byDocument = await request.get(`${urls.api}/v1/remote/lookup?q=98765432`, { headers })
    expect(((await byDocument.json()) as { items: unknown[] }).items).toHaveLength(1)

    const withoutOrder = await request.post(`${urls.api}/v1/stamp`, {
      headers,
      data: { cardToken: token, idempotencyKey: idempotencyKey(), channel: 'remote' },
    })
    expect(withoutOrder.status()).toBe(422)

    // A QR scan at the counter is unaffected by the remote rules.
    const atCounter = await request.post(`${urls.api}/v1/stamp`, {
      headers,
      data: { cardToken: token, idempotencyKey: idempotencyKey() },
    })
    expect(atCounter.status(), await atCounter.text()).toBe(201)
  })

  test('the extension connects with a code approved from a signed-in session', async ({
    request,
  }) => {
    const session = await registerBusiness(request)

    const started = await request.post(`${urls.api}/v1/auth/device/start`)
    expect(started.ok(), await started.text()).toBeTruthy()
    const { userCode, pollToken } = (await started.json()) as {
      userCode: string
      pollToken: string
    }
    expect(userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    const pending = await request.post(`${urls.api}/v1/auth/device/poll`, {
      data: { pollToken },
    })
    expect(pending.status()).toBe(202)

    const approved = await request.post(`${urls.api}/v1/auth/device/approve`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      data: { userCode: userCode.toLowerCase() },
    })
    expect(approved.ok(), await approved.text()).toBeTruthy()

    const collected = await request.post(`${urls.api}/v1/auth/device/poll`, {
      data: { pollToken },
    })
    expect(collected.ok(), await collected.text()).toBeTruthy()
    const tokens = (await collected.json()) as { accessToken: string; refreshToken: string }
    const me = await request.get(`${urls.api}/v1/auth/me`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    })
    expect(me.ok(), await me.text()).toBeTruthy()

    // Exactly once.
    const again = await request.post(`${urls.api}/v1/auth/device/poll`, { data: { pollToken } })
    expect(again.status()).toBe(401)
  })
})
