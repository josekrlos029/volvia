import { expect, test } from '@playwright/test'
import {
  COMMUNITY_HISTORIES,
  allowNotificationsAnytime,
  authHeaders,
  businessWithACommunity,
  installWalletPass,
  signIn,
  urls,
} from '../helpers'

/**
 * Segments and messages.
 *
 * A saved segment is a rule with a name; a message is a push to whoever the rule
 * matches. What these tests guard is that the number shown before sending is the
 * number of people reached, and that sending twice never pushes twice.
 */
test.describe('suggested segments', () => {
  test('count the community the way the fixture was built', async ({ request }) => {
    const { session } = await businessWithACommunity(request)

    const response = await request.get(`${urls.api}/v1/segments`, {
      headers: authHeaders(session),
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    const body = (await response.json()) as {
      suggested: Array<{ key: string; count: number }>
      segments: unknown[]
      canCreate: boolean
    }
    const count = (key: string) => body.suggested.find((item) => item.key === key)?.count

    expect(count('cold')).toBe(2)
    expect(count('recurring')).toBe(2)
    expect(count('vip')).toBe(0)
    expect(count('never_redeemed')).toBe(
      COMMUNITY_HISTORIES.filter((h) => h.totalStamps > 0).length,
    )
    expect(count('new_no_second_visit')).toBe(1)
    // Every fixture customer was born on the 15th of April.
    expect(count('birthday_this_month')).toBe(new Date().getMonth() + 1 === 4 ? 5 : 0)
    // A new business is inside the premium trial, so it may save its own.
    expect(body.canCreate).toBe(true)
    expect(body.segments).toEqual([])
  })
})

test.describe('custom segments', () => {
  test('are a saved rule the customer list and the preview both honour', async ({ request }) => {
    const { session } = await businessWithACommunity(request)
    const headers = authHeaders(session)

    const created = await request.post(`${urls.api}/v1/segments`, {
      headers,
      data: {
        name: 'Fríos con sellos',
        description: 'Se alejan pero ya invirtieron en la tarjeta',
        definition: { base: 'cold', filters: { minStamps: 5 } },
      },
    })
    expect(created.status(), await created.text()).toBe(201)
    const segment = (await created.json()) as { id: string }

    const detail = await request.get(`${urls.api}/v1/segments/${segment.id}`, { headers })
    expect((await detail.json()).count).toBe(2)

    const list = await request.get(`${urls.api}/v1/customers?segmentId=${segment.id}&pageSize=50`, {
      headers,
    })
    expect((await list.json()).total).toBe(2)

    // Names are unique per business, case aside.
    const duplicate = await request.post(`${urls.api}/v1/segments`, {
      headers,
      data: { name: 'fríos CON sellos', definition: { base: 'all', filters: {} } },
    })
    expect(duplicate.status()).toBe(409)

    const updated = await request.put(`${urls.api}/v1/segments/${segment.id}`, {
      headers,
      data: {
        name: 'Fríos con sellos',
        description: null,
        definition: { base: 'cold', filters: { minStamps: 6 } },
      },
    })
    expect(updated.ok(), await updated.text()).toBeTruthy()
    const afterUpdate = await request.get(`${urls.api}/v1/segments/${segment.id}`, { headers })
    expect((await afterUpdate.json()).count).toBe(1)

    const removed = await request.delete(`${urls.api}/v1/segments/${segment.id}`, { headers })
    expect(removed.status()).toBe(204)
    const after = await request.get(`${urls.api}/v1/segments`, { headers })
    expect((await after.json()).segments).toEqual([])
  })

  test('the editor counts as you type and saves what it counted', async ({ page, request }) => {
    const { business } = await businessWithACommunity(request)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/segments/new?from=cold`)

    await expect(page.getByText('2 clientes encajan hoy')).toBeVisible()
    await page.getByLabel('Sellos, al menos').fill('6')
    await expect(page.getByText('1 cliente encaja hoy')).toBeVisible()

    await page.getByRole('button', { name: 'Guardar segmento' }).click()
    await page.waitForURL(`${urls.app}/segments`)
    await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible()
  })
})

test.describe('messages', () => {
  test('reach is counted by who can actually receive a push', async ({ request }) => {
    const { session, tokens } = await businessWithACommunity(request)
    const headers = authHeaders(session)

    const preview = async () => {
      const response = await request.post(`${urls.api}/v1/messages/preview`, {
        headers,
        data: {
          segment: 'all',
          suggested: 'cold',
          cardIds: [],
          customerIds: [],
          consentOnly: true,
        },
      })
      expect(response.ok(), await response.text()).toBeTruthy()
      return (await response.json()) as { size: number; withWallet: number; applePasses: number }
    }

    expect(await preview()).toMatchObject({ size: 2, withWallet: 0 })

    // One of the cold customers installs the pass.
    await installWalletPass(tokens.lost!)

    expect(await preview()).toMatchObject({ size: 2, withWallet: 1, applePasses: 1 })
  })

  test('goes out once, to the segment, and reports who it reached', async ({ request }) => {
    const { session, tokens } = await businessWithACommunity(request)
    const headers = authHeaders(session)
    await allowNotificationsAnytime(request, session)
    await installWalletPass(tokens.lost!)

    const created = await request.post(`${urls.api}/v1/messages`, {
      headers,
      data: {
        headline: 'Te extrañamos, {{name}}',
        body: 'Pásate esta semana por {{business}}.',
        audience: {
          segment: 'all',
          suggested: 'cold',
          cardIds: [],
          customerIds: [],
          consentOnly: true,
        },
      },
    })
    expect(created.status(), await created.text()).toBe(201)
    const message = (await created.json()) as { id: string; status: string }
    expect(message.status).toBe('draft')

    const sent = await request.post(`${urls.api}/v1/messages/${message.id}/send`, {
      headers,
      data: { scheduledAt: null },
    })
    expect(sent.ok(), await sent.text()).toBeTruthy()
    expect((await sent.json()).status).toBe('scheduled')

    // The worker drains the outbox every couple of seconds; in stub wallet mode nothing
    // is pushed for real, but every delivery still settles.
    await expect
      .poll(
        async () => {
          const detail = await request.get(`${urls.api}/v1/messages/${message.id}`, { headers })
          return ((await detail.json()) as { status: string }).status
        },
        { timeout: 30_000, intervals: [1_000] },
      )
      .toBe('sent')

    const detail = await request.get(`${urls.api}/v1/messages/${message.id}`, { headers })
    const body = (await detail.json()) as {
      targetedCount: number
      deliveredCount: number
      deliveries: { queued: number; delivered: number; failed: number; skipped: number }
    }
    expect(body.targetedCount).toBe(2)
    expect(body.deliveredCount).toBe(1)
    expect(body.deliveries).toEqual({ queued: 0, delivered: 1, failed: 0, skipped: 1 })

    // Sent is sent: it cannot go out again.
    const again = await request.post(`${urls.api}/v1/messages/${message.id}/send`, {
      headers,
      data: { scheduledAt: null },
    })
    expect(again.status()).toBe(409)

    const list = await request.get(`${urls.api}/v1/messages`, { headers })
    expect((await list.json()).thisMonth.used).toBe(1)
  })

  test('sent outside the notification hours, it waits for the next opening', async ({
    request,
  }) => {
    const { session } = await businessWithACommunity(request)
    const headers = authHeaders(session)

    // A window that starts two hours from now in the business's timezone (Bogotá), so
    // "now" is always outside it, whatever time the suite runs.
    const bogotaHour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
    )
    const opensAt = (bogotaHour + 2) % 24
    const closesAt = (bogotaHour + 3) % 24
    const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`
    const updated = await request.patch(`${urls.api}/v1/org`, {
      headers,
      data: { settings: { notificationHours: { from: clock(opensAt), to: clock(closesAt) } } },
    })
    expect(updated.ok(), await updated.text()).toBeTruthy()

    const created = await request.post(`${urls.api}/v1/messages`, {
      headers,
      data: {
        headline: 'Buenas noches',
        body: 'Esto no debería sonar a las once.',
        audience: { segment: 'all', cardIds: [], customerIds: [], consentOnly: true },
      },
    })
    const message = (await created.json()) as { id: string }

    const sent = await request.post(`${urls.api}/v1/messages/${message.id}/send`, {
      headers,
      data: { scheduledAt: null },
    })
    expect(sent.ok(), await sent.text()).toBeTruthy()
    const body = (await sent.json()) as { status: string; scheduledAt: string }
    expect(body.status).toBe('scheduled')

    const leavesAt = new Date(body.scheduledAt)
    expect(leavesAt.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000)
    const leavesAtHour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        hour12: false,
      }).format(leavesAt),
    )
    expect(leavesAtHour % 24).toBe(opensAt)

    // Nothing drains it early: a few seconds later it is still waiting.
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    const detail = await request.get(`${urls.api}/v1/messages/${message.id}`, { headers })
    expect((await detail.json()).status).toBe('scheduled')
  })

  test('a scheduled message can be pulled back before it leaves', async ({ request }) => {
    const { session } = await businessWithACommunity(request)
    const headers = authHeaders(session)

    const created = await request.post(`${urls.api}/v1/messages`, {
      headers,
      data: {
        headline: 'Mañana',
        body: 'Algo que todavía no pasa.',
        audience: { segment: 'all', cardIds: [], customerIds: [], consentOnly: true },
      },
    })
    const message = (await created.json()) as { id: string }

    const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const sent = await request.post(`${urls.api}/v1/messages/${message.id}/send`, {
      headers,
      data: { scheduledAt: inAnHour },
    })
    expect((await sent.json()).status).toBe('scheduled')

    const cancelled = await request.post(`${urls.api}/v1/messages/${message.id}/cancel`, {
      headers,
    })
    expect(cancelled.ok(), await cancelled.text()).toBeTruthy()
    expect((await cancelled.json()).status).toBe('draft')

    // Give the worker a couple of cycles: a cancelled message must stay a draft.
    await new Promise((resolve) => setTimeout(resolve, 5_000))
    const detail = await request.get(`${urls.api}/v1/messages/${message.id}`, { headers })
    expect((await detail.json()).status).toBe('draft')
  })

  test('the composer shows the reach, fills from a template and sends', async ({
    page,
    request,
  }) => {
    const { business, session } = await businessWithACommunity(request)
    await allowNotificationsAnytime(request, session)

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/messages/new?suggested=cold`)

    await expect(page.getByText('Llega a 2 clientes')).toBeVisible()
    await page.getByRole('button', { name: 'Te extrañamos, {{name}}' }).click()
    await expect(page.getByText('Te extrañamos, María')).toBeVisible()

    await page.getByRole('button', { name: 'Enviar ahora' }).click()
    await page.waitForURL(`${urls.app}/messages`)
    await expect(page.getByText(/1 de \d+ este mes/)).toBeVisible()

    await expect
      .poll(
        async () => {
          await page.reload()
          return page.getByText('Enviado', { exact: true }).count()
        },
        { timeout: 30_000, intervals: [1_500] },
      )
      .toBe(1)
  })
})
