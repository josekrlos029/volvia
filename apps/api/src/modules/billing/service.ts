import {
  type Database,
  eq,
  organizations,
  payments,
  subscriptions,
  webhookEvents,
} from '@volvia/db'
import {
  type Currency,
  PLANS,
  PREMIUM_TRIAL_CUSTOMER_LIMIT,
  type PlanId,
  type SubscriptionView,
} from '@volvia/shared'
import { env } from '../../env'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { invalidateEntitlements } from '../../lib/entitlements'
import { AppError } from '../../lib/errors'
import type { RedisClient } from '../../lib/redis'
import { StripeAdapter } from './providers/stripe'
import type { PaymentProviderAdapter, SubscriptionEvent } from './providers/types'
import { WompiAdapter } from './providers/wompi'

const stripe = new StripeAdapter()
const wompi = new WompiAdapter()

export const providers: Record<'stripe' | 'wompi', PaymentProviderAdapter> = { stripe, wompi }

/**
 * Picks the provider for a business.
 *
 * Colombian businesses default to Wompi — PSE and Nequi are how people actually pay
 * there, and a card-only checkout would lose most of them. Everyone else gets Stripe.
 */
export function defaultProviderFor(country: string, currency: Currency): 'stripe' | 'wompi' {
  if (country === 'CO' && currency === 'cop' && wompi.available) return 'wompi'
  return 'stripe'
}

export async function loadSubscriptionView(db: Database, orgId: string): Promise<SubscriptionView> {
  const [org] = await db
    .select({
      plan: organizations.plan,
      status: organizations.subscriptionStatus,
      currency: organizations.currency,
      extraLocations: organizations.extraLocations,
      customerCount: organizations.customerCount,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) throw new AppError('ORG_NOT_FOUND', { message: 'organization not found' })

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1)

  const inTrial =
    org.status !== 'active' &&
    org.status !== 'trialing' &&
    org.customerCount < PREMIUM_TRIAL_CUSTOMER_LIMIT

  return {
    plan: org.plan,
    status: org.status,
    interval: subscription?.interval ?? null,
    provider: subscription?.provider ?? null,
    currency: org.currency,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    extraLocations: org.extraLocations,
    trialCustomersRemaining: inTrial ? PREMIUM_TRIAL_CUSTOMER_LIMIT - org.customerCount : null,
  }
}

export async function createCheckout(
  db: Database,
  input: {
    orgId: string
    email: string
    plan: Exclude<PlanId, 'free'>
    interval: 'monthly' | 'yearly'
    extraLocations: number
    provider?: 'stripe' | 'wompi'
    successPath?: string
    cancelPath?: string
  },
) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, input.orgId))
    .limit(1)
  if (!org) throw new AppError('ORG_NOT_FOUND', { message: 'organization not found' })

  if (input.extraLocations > 0 && !PLANS[input.plan].extraLocationPrice) {
    throw new AppError('VALIDATION_FAILED', {
      message: `plan ${input.plan} does not support extra locations`,
    })
  }

  const providerName = input.provider ?? defaultProviderFor(org.country, org.currency)
  const provider = providers[providerName]
  if (!provider.available) {
    throw new AppError('SERVICE_UNAVAILABLE', { message: `${providerName} is not configured` })
  }

  const session = await provider.createCheckout({
    orgId: org.id,
    orgName: org.name,
    email: input.email,
    plan: input.plan,
    interval: input.interval,
    currency: org.currency,
    extraLocations: input.extraLocations,
    successUrl: `${env.APP_URL}${input.successPath ?? '/settings/billing?status=success'}`,
    cancelUrl: `${env.APP_URL}${input.cancelPath ?? '/settings/billing?status=cancelled'}`,
  })

  return { ...session, provider: providerName }
}

/**
 * Applies a provider event to the organisation's plan.
 *
 * Webhooks arrive out of order and more than once, so this is written to be idempotent:
 * the same event applied twice leaves the same state.
 */
export async function applySubscriptionEvent(
  db: Database,
  redis: RedisClient,
  provider: 'stripe' | 'wompi',
  event: SubscriptionEvent & { eventId: string },
): Promise<{ applied: boolean; reason?: string }> {
  // Record the event first: a duplicate delivery stops here.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider,
      providerEventId: event.eventId,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id })

  if (inserted.length === 0) return { applied: false, reason: 'duplicate' }
  if (event.type === 'ignored') {
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, inserted[0]!.id))
    return { applied: false, reason: 'not relevant' }
  }
  if (!event.orgId) return { applied: false, reason: 'no organisation reference' }

  const orgId = event.orgId

  await db.transaction(async (tx) => {
    if (event.payment) {
      await tx
        .insert(payments)
        .values({
          orgId,
          provider,
          providerPaymentId: event.payment.providerPaymentId,
          amount: event.payment.amount,
          currency: event.payment.currency,
          status: event.payment.status,
          paidAt: event.payment.paidAt,
        })
        .onConflictDoNothing()
    }

    if (event.type === 'subscription.activated' || event.type === 'subscription.updated') {
      const plan = event.plan ?? 'free'
      const status = event.type === 'subscription.activated' ? 'active' : 'past_due'

      await tx
        .insert(subscriptions)
        .values({
          orgId,
          provider,
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
          plan,
          interval: event.interval ?? 'monthly',
          status,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: subscriptions.orgId,
          set: {
            provider,
            providerCustomerId: event.providerCustomerId,
            providerSubscriptionId: event.providerSubscriptionId,
            plan,
            interval: event.interval ?? 'monthly',
            status,
            currentPeriodStart: event.currentPeriodStart,
            currentPeriodEnd: event.currentPeriodEnd,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd,
            updatedAt: new Date(),
          },
        })

      await tx
        .update(organizations)
        .set({ plan, subscriptionStatus: status, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
    }

    if (event.type === 'subscription.canceled') {
      await tx
        .update(subscriptions)
        .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
        .where(eq(subscriptions.orgId, orgId))

      // Dropping to free never deletes anything: cards, customers and stamps stay,
      // the business simply loses the paid features.
      await tx
        .update(organizations)
        .set({ plan: 'free', subscriptionStatus: 'canceled', updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
    }

    if (event.type === 'payment.failed') {
      await tx
        .update(organizations)
        .set({ subscriptionStatus: 'past_due', updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
    }

    await audit(tx, {
      orgId,
      actorType: 'system',
      action: AUDIT_ACTIONS.planChanged,
      meta: { provider, event: event.type, plan: event.plan },
    })

    await tx
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, inserted[0]!.id))
  })

  // Entitlements are cached; the new plan must take effect on the very next request.
  await invalidateEntitlements(redis, orgId)
  return { applied: true }
}

export async function cancelSubscription(db: Database, redis: RedisClient, orgId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1)

  if (!subscription || !subscription.providerSubscriptionId) {
    throw new AppError('NOT_FOUND', { message: 'no active subscription' })
  }

  await providers[subscription.provider].cancelSubscription(subscription.providerSubscriptionId)

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.orgId, orgId))

  await invalidateEntitlements(redis, orgId)
  return { cancelAtPeriodEnd: true, endsAt: subscription.currentPeriodEnd }
}
