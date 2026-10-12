import { type APIRequestContext, expect, test } from '@playwright/test'
import {
  type Session,
  allowNotificationsAnytime,
  authHeaders,
  createAndPublishCard,
  idempotencyKey,
  joinCard,
  registerBusiness,
  urls,
} from '../helpers'

/**
 * What a campaign does to the card while it runs.
 *
 * Until the offers table existed, a campaign was a line of text: bonus stamps were
 * stored and never given, a multiplier never multiplied, and every pass of the
 * business showed the offer whether or not the customer was in the audience. These
 * tests pin the promises down from the outside: launch, visit, read the card.
 */
const secret = process.env.JOBS_SECRET ?? ''
const jobHeaders = { authorization: `Bearer ${secret}` }

async function runJobs(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${urls.api}/internal/jobs/cron`, { headers: jobHeaders })
  expect(response.ok(), await response.text()).toBeTruthy()
}

async function launchCampaign(
  request: APIRequestContext,
  session: Session,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  const created = await request.post(`${urls.api}/v1/campaigns`, {
    headers: authHeaders(session),
    data: {
      name: 'Prueba',
      template: 'custom',
      headline: 'Hoy hay sorpresa, {{name}}',
      body: 'Pásate hoy.',
      audience: {},
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      sendPush: true,
      activeWeekdays: [],
      activeHours: null,
      ...data,
    },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const campaign = (await created.json()) as { id: string }

  const launched = await request.post(`${urls.api}/v1/campaigns/${campaign.id}/launch`, {
    headers: authHeaders(session),
  })
  expect(launched.ok(), await launched.text()).toBeTruthy()
  await runJobs(request)
  return campaign
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
      endsOnFirstStamp: boolean
    } | null
  }
}

async function stamp(request: APIRequestContext, session: Session, token: string) {
  const response = await request.post(`${urls.api}/v1/stamp`, {
    headers: authHeaders(session),
    data: { cardToken: token, count: 1, idempotencyKey: idempotencyKey() },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as { stampsAdded: number; stampsCount: number }
}

test.describe('campaign offers', () => {
  test.skip(secret.length === 0, 'JOBS_SECRET is not set in this environment')

  test('bonus stamps land on the card the moment the campaign starts', async ({ request }) => {
    const session = await registerBusiness(request)
    await allowNotificationsAnytime(request, session)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await launchCampaign(request, session, {
      offer: { kind: 'bonus_stamps', amount: 1 },
      passOverride: { header: 'REGALO', banner: { kind: 'preset', value: 'gift' } },
    })

    const state = await cardState(request, customer.token)
    expect(state.stampsCount, 'the gift stamp was given').toBe(1)
    expect(state.activeOffer).not.toBeNull()
    expect(state.activeOffer?.title).toBe('Hoy hay sorpresa, María')
    expect(state.activeOffer?.headerLabel).toBe('REGALO')
    expect(state.activeOffer?.bannerPreset).toBe('gift')
  })

  test('a multiplier doubles the visit, and the first visit can end the offer', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    await allowNotificationsAnytime(request, session)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    await launchCampaign(request, session, {
      offer: { kind: 'multiplier', factor: 2 },
      passOverride: {
        stampStyle: 'hidden',
        banner: { kind: 'preset', value: 'sparkle' },
        endsOnFirstStamp: true,
      },
    })

    const before = await cardState(request, customer.token)
    expect(before.activeOffer?.hideStamps).toBe(true)
    expect(before.activeOffer?.endsOnFirstStamp).toBe(true)

    const visit = await stamp(request, session, customer.token)
    expect(visit.stampsAdded, 'one scan counts double').toBe(2)
    expect(visit.stampsCount).toBe(2)

    const after = await cardState(request, customer.token)
    expect(after.activeOffer, 'the visit returned the card to normal').toBeNull()

    const again = await stamp(request, session, customer.token)
    expect(again.stampsAdded, 'the doubling went with the offer').toBe(1)
  })

  test('only the audience sees the offer', async ({ request }) => {
    const session = await registerBusiness(request)
    await allowNotificationsAnytime(request, session)
    const card = await createAndPublishCard(request, session)
    const chosen = await joinCard(request, card.joinSlug)
    const bystander = await joinCard(request, card.joinSlug)

    await launchCampaign(request, session, {
      offer: { kind: 'message_only' },
      audience: { customerIds: [chosen.customerId] },
    })

    expect((await cardState(request, chosen.token)).activeOffer).not.toBeNull()
    expect((await cardState(request, bystander.token)).activeOffer).toBeNull()
  })

  test('cancelling takes the offer off the card and refreshes the pass', async ({ request }) => {
    const session = await registerBusiness(request)
    await allowNotificationsAnytime(request, session)
    const card = await createAndPublishCard(request, session)
    const customer = await joinCard(request, card.joinSlug)

    const campaign = await launchCampaign(request, session, { offer: { kind: 'message_only' } })
    expect((await cardState(request, customer.token)).activeOffer).not.toBeNull()

    const cancelled = await request.post(`${urls.api}/v1/campaigns/${campaign.id}/cancel`, {
      headers: authHeaders(session),
    })
    expect(cancelled.ok(), await cancelled.text()).toBeTruthy()
    await runJobs(request)

    expect((await cardState(request, customer.token)).activeOffer).toBeNull()

    // The pass refresh is what makes the phone drop the offer; it must have been queued.
    const { createDatabase, eq, outbox, sql, and } = await import('@volvia/db')
    const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })
    try {
      const rows = await connection.db
        .select({ id: outbox.id })
        .from(outbox)
        .where(
          and(
            eq(outbox.orgId, session.orgId),
            sql`${outbox.payload} ->> 'reason' = 'campaign_end'`,
          ),
        )
      expect(rows.length).toBeGreaterThanOrEqual(1)
    } finally {
      await connection.close()
    }
  })
})
