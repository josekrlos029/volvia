import { check, sleep } from 'k6'
import http from 'k6/http'

/**
 * Load profile for the one endpoint with a real budget.
 *
 * Models a busy hour at a counter: many customers, each scanned once, arriving in
 * bursts. The threshold is the p95 the product promises, not an aspiration.
 */
export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 40 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{name:stamp}': ['p(95)<200'],
    'http_req_failed{name:stamp}': ['rate<0.01'],
  },
}

const API = __ENV.API_URL || 'http://localhost:8080'
const TOKEN = __ENV.ACCESS_TOKEN
const ORG_ID = __ENV.ORG_ID
// A newline-separated list of customer card tokens, produced by the seed.
const CARDS = (__ENV.CARD_TOKENS || '').split(/\s+/).filter(Boolean)

export default function () {
  if (CARDS.length === 0) {
    throw new Error('CARD_TOKENS is required: pass customer card tokens to stamp')
  }

  const cardToken = CARDS[Math.floor(Math.random() * CARDS.length)]

  const response = http.post(
    `${API}/v1/stamp`,
    JSON.stringify({
      cardToken,
      count: 1,
      idempotencyKey: `k6-${__VU}-${__ITER}-${Date.now()}`,
    }),
    {
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TOKEN}`,
        'x-org-id': ORG_ID,
      },
      tags: { name: 'stamp' },
    },
  )

  // A cooldown rejection is the product working, not a failure of the endpoint.
  check(response, {
    handled: (r) => r.status === 201 || r.status === 429,
  })

  sleep(Math.random() * 2)
}
