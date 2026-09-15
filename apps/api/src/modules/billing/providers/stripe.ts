import { type BillingInterval, type Currency, PLANS, type PlanId } from '@volvia/shared'
import Stripe from 'stripe'
import { env } from '../../../env'
import { AppError } from '../../../lib/errors'
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProviderAdapter,
  SubscriptionEvent,
} from './types'

/** Price ids are configured per plan and interval; a missing one is a config error. */
function priceId(plan: Exclude<PlanId, 'free'>, interval: BillingInterval): string {
  const table: Record<string, string> = {
    'pro:monthly': env.STRIPE_PRICE_PRO_MONTHLY,
    'pro:yearly': env.STRIPE_PRICE_PRO_YEARLY,
    'business:monthly': env.STRIPE_PRICE_BUSINESS_MONTHLY,
    'business:yearly': env.STRIPE_PRICE_BUSINESS_YEARLY,
    'multi:monthly': env.STRIPE_PRICE_MULTI_MONTHLY,
    'multi:yearly': env.STRIPE_PRICE_MULTI_YEARLY,
  }
  const id = table[`${plan}:${interval}`]
  if (!id) {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `no Stripe price configured for ${plan}/${interval}`,
    })
  }
  return id
}

function planFromPriceId(id: string): { plan: PlanId; interval: BillingInterval } | null {
  const entries: Array<[string, PlanId, BillingInterval]> = [
    [env.STRIPE_PRICE_PRO_MONTHLY, 'pro', 'monthly'],
    [env.STRIPE_PRICE_PRO_YEARLY, 'pro', 'yearly'],
    [env.STRIPE_PRICE_BUSINESS_MONTHLY, 'business', 'monthly'],
    [env.STRIPE_PRICE_BUSINESS_YEARLY, 'business', 'yearly'],
    [env.STRIPE_PRICE_MULTI_MONTHLY, 'multi', 'monthly'],
    [env.STRIPE_PRICE_MULTI_YEARLY, 'multi', 'yearly'],
  ]
  const match = entries.find(([priceId]) => priceId && priceId === id)
  return match ? { plan: match[1], interval: match[2] } : null
}

export class StripeAdapter implements PaymentProviderAdapter {
  readonly name = 'stripe' as const
  private readonly client: Stripe | null

  constructor() {
    this.client = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, {
          apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
        })
      : null
  }

  get available(): boolean {
    return this.client !== null && env.STRIPE_SECRET_KEY.startsWith('sk_')
  }

  private require(): Stripe {
    if (!this.client) {
      throw new AppError('SERVICE_UNAVAILABLE', { message: 'Stripe is not configured' })
    }
    return this.client
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const stripe = this.require()

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId(request.plan, request.interval), quantity: 1 },
    ]

    // Extra locations are billed as additional quantity on the same subscription.
    if (request.extraLocations > 0 && PLANS[request.plan].extraLocationPrice) {
      lineItems.push({
        price_data: {
          currency: request.currency,
          recurring: { interval: request.interval === 'yearly' ? 'year' : 'month' },
          unit_amount: PLANS[request.plan].extraLocationPrice![request.currency],
          product_data: { name: 'Sede adicional' },
        },
        quantity: request.extraLocations,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      customer_email: request.email,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      // The org id travels with the subscription so webhooks can find it without
      // depending on the checkout session still being around.
      client_reference_id: request.orgId,
      metadata: { orgId: request.orgId, plan: request.plan },
      subscription_data: { metadata: { orgId: request.orgId, plan: request.plan } },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      throw new AppError('SERVICE_UNAVAILABLE', { message: 'Stripe did not return a checkout URL' })
    }
    return { url: session.url, providerSessionId: session.id }
  }

  async createPortalUrl(input: { providerCustomerId: string; returnUrl: string }): Promise<string> {
    const session = await this.require().billingPortal.sessions.create({
      customer: input.providerCustomerId,
      return_url: input.returnUrl,
    })
    return session.url
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    // Cancel at period end: the business keeps what it paid for until it runs out.
    await this.require().subscriptions.update(providerSubscriptionId, {
      cancel_at_period_end: true,
    })
  }

  async parseWebhook(input: { rawBody: Buffer; signature: string }) {
    const stripe = this.require()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        input.rawBody,
        input.signature,
        env.STRIPE_WEBHOOK_SECRET,
      )
    } catch {
      // An unverifiable webhook is either misconfiguration or forgery; never process it.
      throw new AppError('FORBIDDEN', { message: 'invalid Stripe signature' })
    }

    return { eventId: event.id, ...this.toDomainEvent(event) }
  }

  private toDomainEvent(event: Stripe.Event): SubscriptionEvent {
    const empty: SubscriptionEvent = {
      type: 'ignored',
      orgId: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
      plan: null,
      interval: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      payment: null,
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const item = subscription.items.data[0]
        const resolved = item?.price?.id ? planFromPriceId(item.price.id) : null

        return {
          ...empty,
          type:
            event.type === 'customer.subscription.deleted'
              ? 'subscription.canceled'
              : subscription.status === 'active' || subscription.status === 'trialing'
                ? 'subscription.activated'
                : 'subscription.updated',
          orgId: (subscription.metadata?.orgId as string) ?? null,
          providerCustomerId: String(subscription.customer),
          providerSubscriptionId: subscription.id,
          plan: resolved?.plan ?? (subscription.metadata?.plan as PlanId) ?? null,
          interval: resolved?.interval ?? null,
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : null,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        return {
          ...empty,
          type: event.type === 'invoice.paid' ? 'payment.succeeded' : 'payment.failed',
          orgId: (invoice.subscription_details?.metadata?.orgId as string) ?? null,
          providerCustomerId: invoice.customer ? String(invoice.customer) : null,
          providerSubscriptionId: invoice.subscription ? String(invoice.subscription) : null,
          payment: {
            providerPaymentId: invoice.id ?? event.id,
            amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
            currency: (invoice.currency as Currency) ?? 'usd',
            status: event.type === 'invoice.paid' ? 'paid' : 'failed',
            paidAt: invoice.status_transitions?.paid_at
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : null,
          },
        }
      }

      default:
        return empty
    }
  }
}
