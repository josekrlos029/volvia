import type { BillingInterval, Currency, PlanId } from '@volvia/shared'

/**
 * The seam between Volvia and whoever takes the money.
 *
 * Stripe covers international cards; Wompi covers Colombia (PSE, Nequi, Bancolombia),
 * where a card-only checkout would lose most of the market. Everything above this
 * interface is provider-agnostic, so adding Mercado Pago later is one more adapter.
 */
export interface CheckoutRequest {
  orgId: string
  orgName: string
  email: string
  plan: Exclude<PlanId, 'free'>
  interval: BillingInterval
  currency: Currency
  extraLocations: number
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  url: string
  providerSessionId: string
}

/** Normalised view of a provider event, so the domain never parses provider payloads. */
export interface SubscriptionEvent {
  type:
    | 'subscription.activated'
    | 'subscription.updated'
    | 'subscription.canceled'
    | 'payment.succeeded'
    | 'payment.failed'
    | 'ignored'
  orgId: string | null
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  plan: PlanId | null
  interval: BillingInterval | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  payment: {
    providerPaymentId: string
    amount: number
    currency: Currency
    status: string
    paidAt: Date | null
  } | null
}

export interface PaymentProviderAdapter {
  readonly name: 'stripe' | 'wompi'
  readonly available: boolean
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>
  /** Self-service billing portal, when the provider offers one. */
  createPortalUrl?(input: { providerCustomerId: string; returnUrl: string }): Promise<string>
  cancelSubscription(providerSubscriptionId: string): Promise<void>
  /** Verifies the signature and returns a provider-neutral event. */
  parseWebhook(input: { rawBody: Buffer; signature: string }): Promise<
    SubscriptionEvent & { eventId: string }
  >
}
