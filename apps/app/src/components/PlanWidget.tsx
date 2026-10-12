'use client'

import { PLAN_NAMES } from '@/lib/format'
import { trialLockSummary } from '@/lib/plan-copy'
import Link from 'next/link'

export interface PlanWidgetProps {
  effectivePlan: string
  inPremiumTrial: boolean
  customerCount: number
  trialCustomerLimit: number
  /** Campaigns allowed per month on the plan; null means unlimited or not included. */
  campaignsPerMonth: number | null
  /** Campaigns created this month, when the plan includes them. */
  campaignsUsed: number | null
}

/**
 * The plan, as a number the owner can act on. During the trial that is how close the
 * business is to thirty customers and what closes at that point; on a paid plan it is
 * the monthly campaign allowance. Never just the plan's name.
 */
export function PlanWidget({
  effectivePlan,
  inPremiumTrial,
  customerCount,
  trialCustomerLimit,
  campaignsPerMonth,
  campaignsUsed,
}: PlanWidgetProps) {
  const planName = PLAN_NAMES[effectivePlan] ?? effectivePlan

  if (inPremiumTrial) {
    const count = Math.min(customerCount, trialCustomerLimit)
    const remaining = Math.max(0, trialCustomerLimit - customerCount)
    const dots = Array.from({ length: trialCustomerLimit }, (_, index) => index < count)
    return (
      <div className="mt-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)]/60 p-3">
        <p className="flex items-center justify-between text-[13px]">
          <span className="font-medium">Plan {planName}</span>
          <span className="tabular text-[var(--color-ink-muted)]">
            {customerCount} de {trialCustomerLimit}
          </span>
        </p>
        <div
          role="img"
          aria-label={`${customerCount} de ${trialCustomerLimit} clientes de prueba`}
          className="mt-2 grid grid-cols-10 gap-1"
        >
          {dots.map((filled, index) => (
            <span
              key={`dot-${index + 1}`}
              className={[
                'h-1.5 rounded-full',
                filled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-line)]',
              ].join(' ')}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-[var(--color-ink-muted)]">
          {remaining === 0
            ? `Al llegar a ${trialCustomerLimit} clientes se cierran: ${trialLockSummary()}.`
            : `Te quedan ${remaining}. Al llegar a ${trialCustomerLimit} se cierran: ${trialLockSummary()}.`}
        </p>
        <Link
          href="/settings/billing"
          className="mt-2 inline-block text-[13px] font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Ver planes
        </Link>
      </div>
    )
  }

  const showCampaigns = campaignsUsed !== null && campaignsPerMonth !== null
  return (
    <div className="mt-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)]/60 p-3">
      <p className="flex items-center justify-between text-[13px]">
        <span className="font-medium">Plan {planName}</span>
        {showCampaigns ? (
          <span className="tabular text-[var(--color-ink-muted)]">
            {campaignsUsed} de {campaignsPerMonth}
          </span>
        ) : null}
      </p>
      {showCampaigns ? (
        <>
          <div
            role="img"
            aria-label={`${campaignsUsed} de ${campaignsPerMonth} campañas este mes`}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]"
          >
            <span
              className="block h-full rounded-full bg-[var(--color-primary)]"
              style={{
                width: `${Math.min(100, Math.round((campaignsUsed / campaignsPerMonth) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[12px] leading-snug text-[var(--color-ink-muted)]">
            {campaignsUsed >= campaignsPerMonth
              ? 'Campañas de este mes agotadas. El contador vuelve a cero el día 1.'
              : `${campaignsPerMonth - campaignsUsed} campaña${campaignsPerMonth - campaignsUsed === 1 ? '' : 's'} más este mes.`}
          </p>
        </>
      ) : null}
      <Link
        href="/settings/billing"
        className="mt-2 inline-block text-[13px] font-medium text-[var(--color-primary)] underline underline-offset-2"
      >
        {effectivePlan === 'free' ? 'Ver planes' : 'Tu plan'}
      </Link>
    </div>
  )
}
