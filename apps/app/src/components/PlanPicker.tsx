'use client'

import { api } from '@/lib/api-client'
import { PLAN_NAMES, formatMoney } from '@/lib/format'
import { ApiError } from '@volvia/shared/client'
import { useState } from 'react'
import { buttonClass } from './ui'

interface Plan {
  id: string
  price: { monthly: number; yearly: number }
  features: string[]
  limits: Record<string, number | null>
  extraLocationPrice: number | null
}

const FEATURE_LABELS: Record<string, string> = {
  wallet_passes: 'Tarjeta en Apple y Google Wallet',
  custom_branding: 'Colores propios',
  custom_stamp_icons: 'Icono de sello propio',
  premium_card_display: 'Tarjeta destacada',
  customer_contact_details: 'Correos de tus clientes',
  birthday_automation: 'Cumpleaños automáticos',
  customer_messages: 'Mensajes a clientes',
  campaigns: 'Campañas',
  surveys: 'Encuestas',
  google_review_requests: 'Pedir reseñas en Google',
  full_analytics: 'Analítica completa',
  csv_export: 'Exportar a CSV',
  team_accounts: 'Cuentas para tu equipo',
  kiosk_mode: 'Modo kiosko',
  multi_location: 'Varias sedes',
  priority_support: 'Soporte prioritario',
}

export function PlanPicker({
  currentPlan,
  currency,
  provider,
  plans,
}: {
  currentPlan: string
  currency: 'usd' | 'cop'
  provider: 'stripe' | 'wompi'
  plans: Plan[]
}) {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkout(plan: string) {
    setWorking(plan)
    setError(null)
    try {
      const session = await api.post<{ url: string }>('/v1/billing/checkout', {
        plan,
        interval,
        extraLocations: 0,
      })
      window.location.href = session.url
    } catch (caught) {
      setWorking(null)
      setError(
        caught instanceof ApiError
          ? caught.code === 'SERVICE_UNAVAILABLE'
            ? 'Los pagos todavía no están configurados en este entorno.'
            : caught.message
          : 'No pudimos abrir el pago.',
      )
    }
  }

  const paidPlans = plans.filter((plan) => plan.id !== 'free')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">Cambiar de plan</h2>
        <fieldset className="inline-flex rounded-[9px] border border-[var(--color-line)] bg-white p-0.5">
          <legend className="sr-only">Periodo de facturación</legend>
          {(['monthly', 'yearly'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              aria-pressed={interval === option}
              className={[
                'rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors',
                interval === option
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-ink-muted)]',
              ].join(' ')}
            >
              {option === 'monthly' ? 'Mensual' : 'Anual'}
            </button>
          ))}
        </fieldset>
      </div>

      {interval === 'yearly' ? (
        <p className="text-[13px] text-[var(--color-success)]">
          Pagando al año te ahorras dos meses.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {paidPlans.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const price = interval === 'yearly' ? plan.price.yearly : plan.price.monthly
          const previous = paidPlans[paidPlans.indexOf(plan) - 1]

          return (
            <article
              key={plan.id}
              className={[
                'flex flex-col rounded-[12px] border bg-white p-4',
                isCurrent ? 'border-[var(--color-primary)]' : 'border-[var(--color-line)]',
              ].join(' ')}
            >
              <h3 className="text-[16px] font-semibold">{PLAN_NAMES[plan.id] ?? plan.id}</h3>
              <p className="tabular mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em]">
                {formatMoney(price, currency)}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
                {interval === 'yearly' ? 'al año' : 'al mes'}
              </p>

              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-[13px]">
                {/* Only what this plan adds over the previous one: repeating every
                    feature on every card makes the difference impossible to see. */}
                {plan.features
                  .filter((feature) => !previous?.features.includes(feature))
                  .map((feature) => (
                    <li key={feature} className="text-[var(--color-ink-muted)]">
                      {FEATURE_LABELS[feature] ?? feature}
                    </li>
                  ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent || working !== null}
                onClick={() => checkout(plan.id)}
                className={`${buttonClass(isCurrent ? 'secondary' : 'primary', 'sm')} mt-4 w-full`}
              >
                {isCurrent ? 'Tu plan actual' : working === plan.id ? 'Abriendo' : 'Elegir'}
              </button>
            </article>
          )
        })}
      </div>

      <p className="text-[13px] text-[var(--color-ink-muted)]">
        {provider === 'wompi'
          ? 'Pagas con PSE, Nequi o tarjeta a través de Wompi.'
          : 'Pagas con tarjeta a través de Stripe.'}
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}
