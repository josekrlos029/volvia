import { expect, test } from '@playwright/test'
import { urls } from '../helpers'

/**
 * The job endpoints that replace the always-on worker in production.
 *
 * They must be unreachable without the shared secret, and with it they must run to
 * completion and report what they did, because Cloud Scheduler only sees the status.
 */
const secret = process.env.JOBS_SECRET ?? ''
const headers = { authorization: `Bearer ${secret}` }

test.describe('job endpoints', () => {
  test.skip(secret.length === 0, 'JOBS_SECRET is not set in this environment')

  test('refuse anyone without the secret', async ({ request }) => {
    const anonymous = await request.post(`${urls.api}/internal/jobs/outbox`)
    expect(anonymous.status()).toBe(401)

    const wrong = await request.post(`${urls.api}/internal/jobs/cron`, {
      headers: { authorization: 'Bearer not-the-secret' },
    })
    expect(wrong.status()).toBe(401)
  })

  test('drain the outbox and report the run', async ({ request }) => {
    const response = await request.post(`${urls.api}/internal/jobs/outbox`, { headers })
    expect(response.status()).toBe(200)

    const tick = await response.json()
    expect(typeof tick.processed).toBe('number')
    expect(typeof tick.failed).toBe('number')
    expect(tick.batches).toBeGreaterThanOrEqual(1)
    expect(typeof tick.exhausted).toBe('boolean')
  })

  test('run the scheduled jobs behind their locks', async ({ request }) => {
    const response = await request.post(`${urls.api}/internal/jobs/cron`, { headers })
    expect(response.status()).toBe(200)

    const tick = await response.json()
    expect(Array.isArray(tick.ran)).toBe(true)
    // The local worker may hold a lock at the same moment; the outbox part always runs.
    expect(typeof tick.outbox.exhausted).toBe('boolean')
  })
})
