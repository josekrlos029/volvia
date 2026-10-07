import type { FastifyInstance } from 'fastify'
import { analyticsRoutes } from '../modules/analytics/routes'
import { authRoutes } from '../modules/auth/routes'
import { billingRoutes, billingWebhookRoutes } from '../modules/billing/routes'
import { cardRoutes } from '../modules/cards/routes'
import { customerRoutes } from '../modules/customers/routes'
import { engagementRoutes, publicSurveyRoutes } from '../modules/engagement/routes'
import { loyaltyRoutes } from '../modules/loyalty/routes'
import { orgRoutes, publicInviteRoutes } from '../modules/orgs/routes'
import { publicRoutes } from '../modules/public/routes'
import { walletRoutes } from '../modules/wallet/routes'
import { healthRoutes } from './health'

/**
 * Route registration. Modules own their own routes and are mounted under a stable
 * prefix; `/v1` is the authenticated business API, `/p` is public, `/wallet` serves passes.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes)
  await app.register(authRoutes, { prefix: '/v1/auth' })
  await app.register(cardRoutes, { prefix: '/v1/cards' })
  await app.register(loyaltyRoutes, { prefix: '/v1' })
  await app.register(engagementRoutes, { prefix: '/v1' })
  await app.register(publicRoutes, { prefix: '/p' })
  await app.register(publicSurveyRoutes, { prefix: '/p' })
  await app.register(publicInviteRoutes, { prefix: '/p' })
  await app.register(orgRoutes, { prefix: '/v1/org' })
  await app.register(customerRoutes, { prefix: '/v1/customers' })
  await app.register(analyticsRoutes, { prefix: '/v1/analytics' })
  await app.register(billingRoutes, { prefix: '/v1/billing' })
  await app.register(walletRoutes, { prefix: '/wallet' })
  // Webhooks are isolated so their raw-body parser cannot affect the rest of the API.
  await app.register(billingWebhookRoutes, { prefix: '/webhooks' })
}
