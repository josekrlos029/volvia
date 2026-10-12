import { createConnection } from 'node:net'
import { type APIRequestContext, expect, test } from '@playwright/test'
import {
  type Session,
  allowNotificationsAnytime,
  authHeaders,
  createAndPublishCard,
  idempotencyKey,
  registerBusiness,
  urls,
} from '../helpers'

/**
 * The birthday automation, end to end: the treat lands on the card that morning with
 * its own expiry, the email waits for a decent hour, and the first visit closes it.
 */
const secret = process.env.JOBS_SECRET ?? ''
const jobHeaders = { authorization: `Bearer ${secret}` }
const bogota = 'America/Bogota'

function todayIn(zone: string): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date())
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { month: read('month'), day: read('day') }
}

function hourIn(date: Date, zone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: zone }).format(
      date,
    ),
  )
}

/**
 * The daily jobs run at most once a quarter hour, behind a Redis key. The suite cannot
 * wait that long, so it releases the key the same way a new window would.
 */
async function releaseDailyWindow(): Promise<void> {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port: Number(url.port || 6379) })
    socket.once('error', reject)
    socket.once('connect', () => socket.write('DEL lock:cron:daily-due\r\n'))
    socket.once('data', () => {
      socket.end()
      resolve()
    })
  })
}

async function runJobs(request: APIRequestContext): Promise<void> {
  await releaseDailyWindow()
  const response = await request.post(`${urls.api}/internal/jobs/cron`, { headers: jobHeaders })
  expect(response.ok(), await response.text()).toBeTruthy()
}

async function cardState(request: APIRequestContext, token: string) {
  const response = await request.get(`${urls.api}/p/card/${token}`)
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as {
    stampsCount: number
    activeOffer: {
      title: string
      headerLabel: string | null
      bannerPreset: string | null
      hideStamps: boolean
      endsAt: string | null
    } | null
  }
}

test.describe('birthday automation', () => {
  test.skip(secret.length === 0, 'JOBS_SECRET is not set in this environment')

  test('the treat lands that morning, expires on its own date and ends with the visit', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    await allowNotificationsAnytime(request, session)
    const card = await createAndPublishCard(request, session)

    const birthday = todayIn(bogota)
    const email = `cumple-${Date.now()}@volvia.test`
    const joined = await request.post(`${urls.api}/p/join/${card.joinSlug}`, {
      data: { firstName: 'Ana', email, marketingConsent: true, birthday },
    })
    expect(joined.ok(), await joined.text()).toBeTruthy()
    const customer = (await joined.json()) as { token: string; customerId: string }

    const saved = await request.put(`${urls.api}/v1/automations`, {
      headers: authHeaders(session),
      data: {
        type: 'birthday',
        isActive: true,
        offsetDays: 0,
        headline: '¡Feliz cumpleaños, {{name}}!',
        body: 'Te dejamos un sello de regalo.',
        offer: { kind: 'bonus_stamps', amount: 1, title: null, validForDays: 7 },
        sendEmail: true,
        sendPush: true,
        passOverride: {
          header: 'CUMPLEAÑOS',
          banner: { kind: 'preset', value: 'cake' },
          stampStyle: 'hidden',
          endsOnFirstStamp: true,
        },
      },
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()

    await runJobs(request)

    const state = await cardState(request, customer.token)
    expect(state.stampsCount, 'the gift stamp was given').toBe(1)
    expect(state.activeOffer?.title).toBe('¡Feliz cumpleaños, Ana!')
    expect(state.activeOffer?.headerLabel).toBe('CUMPLEAÑOS')
    expect(state.activeOffer?.bannerPreset).toBe('cake')
    expect(state.activeOffer?.hideStamps).toBe(true)

    // Valid for a week from the end of the birthday, in the business's own clock.
    const endsAt = new Date(state.activeOffer?.endsAt ?? 0)
    const days = (endsAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(7)
    expect(days).toBeLessThan(8.1)

    // The email waits for the morning window rather than going out at midnight.
    const { createDatabase, eq, outbox, sql, and } = await import('@volvia/db')
    const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })
    try {
      const [mail] = await connection.db
        .select({ runAt: outbox.runAt })
        .from(outbox)
        .where(
          and(
            eq(outbox.orgId, session.orgId),
            eq(outbox.kind, 'email.send'),
            sql`${outbox.payload} ->> 'type' = 'birthday'`,
          ),
        )
        .limit(1)
      expect(mail, 'a birthday email was queued').toBeTruthy()
      expect(hourIn(mail!.runAt, bogota)).toBeGreaterThanOrEqual(8)
    } finally {
      await connection.close()
    }

    const visit = await request.post(`${urls.api}/v1/stamp`, {
      headers: authHeaders(session),
      data: { cardToken: customer.token, count: 1, idempotencyKey: idempotencyKey() },
    })
    expect(visit.ok(), await visit.text()).toBeTruthy()
    expect((await cardState(request, customer.token)).activeOffer).toBeNull()

    // Running the day again greets nobody twice.
    await runJobs(request)
    expect((await cardState(request, customer.token)).stampsCount).toBe(2)
  })
})
