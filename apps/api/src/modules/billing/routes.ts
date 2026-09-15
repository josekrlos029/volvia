import { eq, organizations, payments, subscriptions } from '@volvia/db'
import { PLAN_LIST, checkoutSchema, subscriptionViewSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { typed } from '../../types'
import {
  applySubscriptionEvent,
  cancelSubscription,
  createCheckout,
  defaultProviderFor,
  loadSubscriptionView,
  providers,
} from './service'

export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/subscription',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { response: { 200: subscriptionViewSchema }, tags: ['billing'] },
    },
    async (request) => loadSubscriptionView(app.db, request.org!.orgId),
  )

  /** The pricing table, in the organisation's own currency. */
  app.get(
    '/plans',
    { preHandler: [app.requireOrg('staff')], schema: { tags: ['billing'] } },
    async (request) => {
      const [org] = await app.db
        .select({ currency: organizations.currency, country: organizations.country })
        .from(organizations)
        .where(eq(organizations.id, request.org!.orgId))
        .limit(1)

      const currency = org?.currency ?? 'cop'
      return {
        currency,
        provider: defaultProviderFor(org?.country ?? 'CO', currency),
        plans: PLAN_LIST.map((plan) => ({
          id: plan.id,
          nameKey: plan.nameKey,
          price: plan.price[currency],
          features: plan.features,
          limits: plan.limits,
          extraLocationPrice: plan.extraLocationPrice?.[currency] ?? null,
        })),
      }
    },
  )

  app.post(
    '/checkout',
    { preHandler: [app.requireOrg('owner')], schema: { body: checkoutSchema, tags: ['billing'] } },
    async (request) => {
      if (!env.BILLING_ENABLED) {
        throw new AppError('SERVICE_UNAVAILABLE', {
          message: 'billing is disabled on this environment',
        })
      }
      return createCheckout(app.db, {
        orgId: request.org!.orgId,
        email: request.auth!.email,
        plan: request.body.plan as Exclude<typeof request.body.plan, 'free'>,
        interval: request.body.interval,
        extraLocations: request.body.extraLocations,
        provider: request.body.provider,
        successPath: request.body.successPath,
        cancelPath: request.body.cancelPath,
      })
    },
  )

  app.post(
    '/portal',
    { preHandler: [app.requireOrg('owner')], schema: { tags: ['billing'] } },
    async (request) => {
      const view = await loadSubscriptionView(app.db, request.org!.orgId)
      if (!view.provider) throw new AppError('NOT_FOUND', { message: 'no subscription to manage' })

      const provider = providers[view.provider]
      if (!provider.createPortalUrl) {
        // Wompi has no hosted portal; the dashboard handles cancellation itself.
        throw new AppError('SERVICE_UNAVAILABLE', {
          message: `${view.provider} does not provide a billing portal`,
        })
      }

      const [subscription] = await app.db
        .select({ providerCustomerId: subscriptions.providerCustomerId })
        .from(subscriptions)
        .where(eq(subscriptions.orgId, request.org!.orgId))
        .limit(1)

      if (!subscription?.providerCustomerId) {
        throw new AppError('NOT_FOUND', { message: 'no billing account to manage' })
      }

      const url = await provider.createPortalUrl({
        providerCustomerId: subscription.providerCustomerId,
        returnUrl: `${env.APP_URL}/settings/billing`,
      })
      return { url }
    },
  )

  app.post(
    '/cancel',
    { preHandler: [app.requireOrg('owner')], schema: { tags: ['billing'] } },
    async (request) => cancelSubscription(app.db, app.redis, request.org!.orgId),
  )

  app.get(
    '/payments',
    { preHandler: [app.requireOrg('owner')], schema: { tags: ['billing'] } },
    async (request) =>
      app.db
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          paidAt: payments.paidAt,
          provider: payments.provider,
        })
        .from(payments)
        .where(eq(payments.orgId, request.org!.orgId))
        .orderBy(payments.createdAt)
        .limit(50),
  )
}

/**
 * Webhooks.
 *
 * Registered separately because both providers sign the *raw* body: parsing it as JSON
 * first would change the bytes and break every signature check.
 */
export async function billingWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) =>
    done(null, body),
  )

  app.post(
    '/stripe',
    { config: { rateLimit: { max: 200, timeWindow: '1 minute' } }, schema: { tags: ['billing'] } },
    async (request, reply) => {
      const signature = request.headers['stripe-signature']
      if (typeof signature !== 'string') {
        throw new AppError('FORBIDDEN', { message: 'missing stripe signature' })
      }

      const event = await providers.stripe.parseWebhook({
        rawBody: request.body as Buffer,
        signature,
      })
      const result = await applySubscriptionEvent(app.db, app.redis, 'stripe', event)
      // Always 200 once verified: a non-2xx makes Stripe retry an event we already have.
      return reply.status(200).send(result)
    },
  )

  app.post(
    '/wompi',
    { config: { rateLimit: { max: 200, timeWindow: '1 minute' } }, schema: { tags: ['billing'] } },
    async (request, reply) => {
      const event = await providers.wompi.parseWebhook({
        rawBody: request.body as Buffer,
        signature: '',
      })
      const result = await applySubscriptionEvent(app.db, app.redis, 'wompi', event)
      return reply.status(200).send(result)
    },
  )
}
