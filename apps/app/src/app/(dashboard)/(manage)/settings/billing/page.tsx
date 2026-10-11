import { PlanPicker } from '@/components/PlanPicker'
import { Badge, Panel } from '@/components/ui'
import { PLAN_NAMES, formatDate, formatMoney } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface Subscription {
  plan: string
  status: string
  interval: string | null
  provider: string | null
  currency: 'usd' | 'cop'
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  extraLocations: number
  trialCustomersRemaining: number | null
}

interface PlansResponse {
  currency: 'usd' | 'cop'
  provider: 'stripe' | 'wompi'
  plans: Array<{
    id: string
    nameKey: string
    price: { monthly: number; yearly: number }
    features: string[]
    limits: Record<string, number | null>
    extraLocationPrice: number | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  none: 'Sin suscripción',
  trialing: 'En prueba',
  active: 'Activa',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
  incomplete: 'Incompleta',
}

export default async function BillingPage() {
  const [subscription, plans, payments] = await Promise.all([
    apiFetch<Subscription>('/v1/billing/subscription'),
    apiFetch<PlansResponse>('/v1/billing/plans'),
    apiFetch<
      Array<{
        id: string
        amount: number
        currency: 'usd' | 'cop'
        status: string
        paidAt: string | null
      }>
    >('/v1/billing/payments').catch(() => []),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/settings"
          className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          Ajustes
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Plan y facturación</h1>
      </header>

      <Panel title="Tu plan">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[20px] font-semibold">
              {PLAN_NAMES[subscription.plan] ?? subscription.plan}
            </p>
            <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
              {subscription.currentPeriodEnd
                ? subscription.cancelAtPeriodEnd
                  ? `Termina el ${formatDate(subscription.currentPeriodEnd, 'long')}`
                  : `Se renueva el ${formatDate(subscription.currentPeriodEnd, 'long')}`
                : subscription.trialCustomersRemaining !== null
                  ? `Funciones premium abiertas por ${subscription.trialCustomersRemaining} clientes más`
                  : 'Sin fecha de renovación'}
            </p>
          </div>
          <Badge
            tone={
              subscription.status === 'active'
                ? 'success'
                : subscription.status === 'past_due'
                  ? 'danger'
                  : 'neutral'
            }
          >
            {STATUS_LABELS[subscription.status] ?? subscription.status}
          </Badge>
        </div>
      </Panel>

      <PlanPicker
        currentPlan={subscription.plan}
        currency={plans.currency}
        provider={plans.provider}
        plans={plans.plans}
      />

      {payments.length > 0 ? (
        <Panel title="Pagos">
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <span className="text-[14px] text-[var(--color-ink-muted)]">
                  {formatDate(payment.paidAt, 'long')}
                </span>
                <span className="tabular text-[14px] font-medium">
                  {formatMoney(payment.amount, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
