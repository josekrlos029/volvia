import { createHash, timingSafeEqual } from 'node:crypto'
import { type BillingInterval, type Currency, PLANS, type PlanId } from '@volvia/shared'
import { env } from '../../../env'
import { AppError } from '../../../lib/errors'
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProviderAdapter,
  SubscriptionEvent,
} from './types'

/**
 * Wompi (Colombia): PSE, Nequi, Bancolombia and cards.
 *
 * Wompi has no subscription primitive, so Volvia bills a period at a time: each payment
 * extends the subscription by one month or year. That is why `parseWebhook` emits an
 * activation for every successful payment rather than tracking a remote subscription.
 */
export class WompiAdapter implements PaymentProviderAdapter {
  readonly name = 'wompi' as const

  get available(): boolean {
    return Boolean(env.WOMPI_PUBLIC_KEY && env.WOMPI_PRIVATE_KEY && env.WOMPI_INTEGRITY_SECRET)
  }

  private amountFor(request: CheckoutRequest): number {
    const plan = PLANS[request.plan]
    const base = request.interval === 'yearly' ? plan.price.cop.yearly : plan.price.cop.monthly
    const extras =
      request.extraLocations > 0 && plan.extraLocationPrice
        ? plan.extraLocationPrice.cop *
          request.extraLocations *
          (request.interval === 'yearly' ? 12 : 1)
        : 0
    return base + extras
  }

  /**
   * Wompi requires a SHA-256 integrity signature over reference+amount+currency so the
   * amount cannot be tampered with in the browser before the customer pays.
   */
  private integritySignature(reference: string, amountInCents: number, currency: string): string {
    return createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${env.WOMPI_INTEGRITY_SECRET}`)
      .digest('hex')
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (!this.available) {
      throw new AppError('SERVICE_UNAVAILABLE', { message: 'Wompi is not configured' })
    }

    // The reference carries everything the webhook needs to credit the right business.
    const reference = `volvia-${request.orgId}-${request.plan}-${request.interval}-${Date.now()}`
    const amountInCents = this.amountFor(request)
    const currency = 'COP'

    const params = new URLSearchParams({
      'public-key': env.WOMPI_PUBLIC_KEY,
      currency,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': this.integritySignature(reference, amountInCents, currency),
      'redirect-url': request.successUrl,
      'customer-data:email': request.email,
      'customer-data:full-name': request.orgName,
    })

    return {
      url: `https://checkout.wompi.co/p/?${params.toString()}`,
      providerSessionId: reference,
    }
  }

  async cancelSubscription(): Promise<void> {
    // Nothing to cancel remotely: a period simply is not renewed. The subscription row
    // is marked `cancelAtPeriodEnd` by the caller and lapses on its own.
  }

  async parseWebhook(input: { rawBody: Buffer; signature: string }) {
    const payload = JSON.parse(input.rawBody.toString('utf8')) as {
      event?: string
      signature?: { checksum?: string; properties?: string[] }
      timestamp?: number
      data?: { transaction?: WompiTransaction }
    }

    const transaction = payload.data?.transaction
    if (!transaction) {
      throw new AppError('VALIDATION_FAILED', { message: 'wompi webhook has no transaction' })
    }

    this.assertChecksum(payload, transaction)

    const parsed = parseReference(transaction.reference)
    const succeeded = transaction.status === 'APPROVED'

    const now = new Date()
    const periodEnd = new Date(now)
    if (parsed?.interval === 'yearly') periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1)
    else periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

    const event: SubscriptionEvent = {
      type: succeeded ? 'subscription.activated' : 'payment.failed',
      orgId: parsed?.orgId ?? null,
      providerCustomerId: transaction.customer_email ?? null,
      providerSubscriptionId: transaction.reference,
      plan: parsed?.plan ?? null,
      interval: parsed?.interval ?? null,
      currentPeriodStart: succeeded ? now : null,
      currentPeriodEnd: succeeded ? periodEnd : null,
      cancelAtPeriodEnd: false,
      payment: {
        providerPaymentId: transaction.id,
        amount: transaction.amount_in_cents,
        currency: (transaction.currency?.toLowerCase() as Currency) ?? 'cop',
        status: transaction.status.toLowerCase(),
        paidAt: succeeded ? now : null,
      },
    }

    return { eventId: transaction.id, ...event }
  }

  /**
   * Wompi signs each event with a checksum over named properties plus the timestamp.
   * Without this check anyone could POST a fake "APPROVED" and upgrade themselves.
   */
  private assertChecksum(
    payload: { signature?: { checksum?: string; properties?: string[] }; timestamp?: number },
    transaction: WompiTransaction,
  ): void {
    const checksum = payload.signature?.checksum
    const properties = payload.signature?.properties ?? []
    if (!checksum || properties.length === 0) {
      throw new AppError('FORBIDDEN', { message: 'wompi webhook is unsigned' })
    }

    const source = properties
      .map((path) => {
        // Properties are dotted paths rooted at `transaction`, e.g. `transaction.status`.
        const value = path
          .split('.')
          .slice(1)
          .reduce<unknown>(
            (current, key) => (current as Record<string, unknown>)?.[key],
            transaction,
          )
        return String(value ?? '')
      })
      .join('')

    const expected = createHash('sha256')
      .update(`${source}${payload.timestamp ?? ''}${env.WOMPI_EVENTS_SECRET}`)
      .digest('hex')

    const a = Buffer.from(expected)
    const b = Buffer.from(checksum.toLowerCase())
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError('FORBIDDEN', { message: 'invalid wompi signature' })
    }
  }
}

interface WompiTransaction {
  id: string
  reference: string
  status: string
  amount_in_cents: number
  currency?: string
  customer_email?: string
}

/** `volvia-<orgId>-<plan>-<interval>-<timestamp>` */
function parseReference(
  reference: string,
): { orgId: string; plan: PlanId; interval: BillingInterval } | null {
  const match = /^volvia-([0-9a-f-]{36})-(pro|business|multi)-(monthly|yearly)-\d+$/.exec(reference)
  if (!match) return null
  return {
    orgId: match[1]!,
    plan: match[2] as PlanId,
    interval: match[3] as BillingInterval,
  }
}
