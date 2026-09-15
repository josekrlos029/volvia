'use client'

import type { Locale } from '@/lib/i18n'
import { type FeatureKey, PLAN_LIST } from '@volvia/shared'
import { useState } from 'react'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

const PLAN_NAMES: Record<string, string> = {
  free: 'Gratis',
  pro: 'Pro',
  business: 'Negocio',
  multi: 'Multi',
}

const PLAN_NAMES_EN: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
  multi: 'Multi',
}

const FEATURE_LABELS: Record<FeatureKey, { es: string; en: string }> = {
  wallet_passes: { es: 'Apple y Google Wallet', en: 'Apple and Google Wallet' },
  custom_branding: { es: 'Colores propios', en: 'Your own colours' },
  custom_stamp_icons: { es: 'Icono de sello propio', en: 'Custom stamp icon' },
  premium_card_display: { es: 'Tarjeta destacada', en: 'Premium card display' },
  customer_contact_details: { es: 'Correos de tus clientes', en: 'Customer emails' },
  birthday_automation: { es: 'Cumpleaños automáticos', en: 'Birthday automation' },
  customer_messages: { es: 'Mensajes a clientes', en: 'Customer messages' },
  campaigns: { es: 'Campañas', en: 'Campaigns' },
  surveys: { es: 'Encuestas', en: 'Surveys' },
  google_review_requests: { es: 'Reseñas en Google', en: 'Google review requests' },
  full_analytics: { es: 'Analítica completa', en: 'Full analytics' },
  csv_export: { es: 'Exportar a CSV', en: 'CSV export' },
  team_accounts: { es: 'Cuentas de equipo', en: 'Team accounts' },
  kiosk_mode: { es: 'Modo kiosko', en: 'Kiosk mode' },
  multi_location: { es: 'Varias sedes', en: 'Multiple locations' },
  priority_support: { es: 'Soporte prioritario', en: 'Priority support' },
}

/**
 * Pricing, generated from the same plan matrix the API enforces. If a plan changes in
 * code, this page changes with it, so the page can never promise something the product
 * will refuse.
 */
export function PricingTable({ locale }: { locale: Locale }) {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const isSpanish = locale === 'es'
  const names = isSpanish ? PLAN_NAMES : PLAN_NAMES_EN
  const currency = isSpanish ? 'cop' : 'usd'

  const format = (minorUnits: number) =>
    new Intl.NumberFormat(isSpanish ? 'es-CO' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(minorUnits / 100)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-center">
        <fieldset className="inline-flex rounded-[10px] border border-[var(--color-line)] bg-white p-1">
          <legend className="sr-only">
            {isSpanish ? 'Periodo de facturación' : 'Billing period'}
          </legend>
          {(['monthly', 'yearly'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              aria-pressed={interval === option}
              className={[
                'rounded-[7px] px-4 py-2 text-[14px] font-medium transition-colors',
                interval === option
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'text-[var(--color-ink-muted)]',
              ].join(' ')}
            >
              {option === 'monthly'
                ? isSpanish
                  ? 'Mensual'
                  : 'Monthly'
                : isSpanish
                  ? 'Anual'
                  : 'Yearly'}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {PLAN_LIST.map((plan, index) => {
          const previous = PLAN_LIST[index - 1]
          const price =
            interval === 'yearly' ? plan.price[currency].yearly : plan.price[currency].monthly
          // Only the features this plan adds: repeating the full list four times makes
          // the actual difference between plans impossible to see.
          const added = plan.features.filter((feature) => !previous?.features.includes(feature))
          const isRecommended = plan.id === 'business'

          return (
            <article
              key={plan.id}
              className={[
                'flex flex-col rounded-[14px] border bg-white p-5',
                isRecommended
                  ? 'border-[var(--color-primary)] shadow-[0_16px_40px_-24px_rgba(22,98,74,0.5)]'
                  : 'border-[var(--color-line)]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[17px] font-semibold">{names[plan.id]}</h3>
                {isRecommended ? (
                  <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-primary)]">
                    {isSpanish ? 'El más elegido' : 'Most chosen'}
                  </span>
                ) : null}
              </div>

              <p className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                {price === 0 ? (isSpanish ? 'Gratis' : 'Free') : format(price)}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
                {price === 0
                  ? isSpanish
                    ? 'para siempre'
                    : 'forever'
                  : interval === 'yearly'
                    ? isSpanish
                      ? 'al año'
                      : 'per year'
                    : isSpanish
                      ? 'al mes'
                      : 'per month'}
              </p>

              <ul className="mt-5 flex flex-1 flex-col gap-2 text-[14px]">
                {plan.id === 'free' ? (
                  <>
                    <li className="text-[var(--color-ink-muted)]">
                      {isSpanish ? 'Una tarjeta activa' : 'One active card'}
                    </li>
                    <li className="text-[var(--color-ink-muted)]">
                      {isSpanish
                        ? 'Clientes y sellos sin límite'
                        : 'Unlimited customers and stamps'}
                    </li>
                    <li className="text-[var(--color-ink-muted)]">
                      {isSpanish ? 'Tu página pública' : 'Your public page'}
                    </li>
                  </>
                ) : (
                  <>
                    <li className="font-medium">
                      {isSpanish
                        ? `Todo lo de ${names[previous!.id]}, más:`
                        : `Everything in ${names[previous!.id]}, plus:`}
                    </li>
                    {added.map((feature) => (
                      <li key={feature} className="text-[var(--color-ink-muted)]">
                        {FEATURE_LABELS[feature][locale]}
                      </li>
                    ))}
                    {plan.limits.locations !== null && plan.limits.locations > 1 ? (
                      <li className="text-[var(--color-ink-muted)]">
                        {isSpanish
                          ? `${plan.limits.locations} sedes incluidas`
                          : `${plan.limits.locations} locations included`}
                      </li>
                    ) : null}
                  </>
                )}
              </ul>

              <a
                href={`${appUrl}/login`}
                className={[
                  'mt-6 rounded-[9px] px-4 py-2.5 text-center text-[14px] font-semibold transition-transform duration-150 active:scale-[0.985]',
                  isRecommended
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-line)] text-[var(--color-ink)]',
                ].join(' ')}
              >
                {plan.id === 'free'
                  ? isSpanish
                    ? 'Empezar gratis'
                    : 'Start free'
                  : isSpanish
                    ? 'Elegir'
                    : 'Choose'}
              </a>
            </article>
          )
        })}
      </div>

      <p className="text-center text-[14px] text-[var(--color-ink-muted)]">
        {isSpanish
          ? 'Puedes bajar de plan cuando quieras. Tus clientes y sus sellos no se pierden.'
          : 'You can downgrade any time. Your customers and their stamps stay.'}
      </p>
    </div>
  )
}
