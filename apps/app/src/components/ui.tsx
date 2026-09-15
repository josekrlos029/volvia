import type { ReactNode } from 'react'

/**
 * Dashboard primitives.
 *
 * Deliberately few: a panel, a metric, a badge, a button. Product UI gets worse when
 * every screen invents its own container, so these are the only shells in use.
 */

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-[12px] border border-[var(--color-line)] bg-white ${className}`}>
      {title || action ? (
        <header className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-4 py-3">
          {title ? <h2 className="text-[14px] font-semibold">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Metric({
  label,
  value,
  hint,
  trend,
}: {
  label: string
  value: string
  hint?: string
  trend?: number | null
}) {
  return (
    <div className="rounded-[12px] border border-[var(--color-line)] bg-white p-4">
      <p className="text-[13px] text-[var(--color-ink-muted)]">{label}</p>
      <p className="tabular mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em]">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[13px]">
        {trend !== undefined && trend !== null ? (
          <span
            className={
              trend >= 0
                ? 'font-medium text-[var(--color-success)]'
                : 'font-medium text-[var(--color-danger)]'
            }
          >
            {trend >= 0 ? '+' : ''}
            {trend}%
          </span>
        ) : null}
        {hint ? <span className="text-[var(--color-ink-muted)]">{hint}</span> : null}
      </div>
    </div>
  )
}

const BADGE_TONES = {
  neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]',
  success: 'bg-[#E4F1EA] text-[var(--color-success)]',
  warning: 'bg-[var(--color-accent-soft)] text-[var(--color-warning)]',
  danger: 'bg-[#FBEBEA] text-[var(--color-danger)]',
  brand: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
} as const

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const BUTTON_VARIANTS = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60',
  secondary:
    'border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
  ghost: 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]',
} as const

export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = 'primary',
  size: 'sm' | 'md' = 'md',
): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-[9px] font-medium',
    'transition-[background-color,transform] duration-150 active:scale-[0.985]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40',
    'disabled:pointer-events-none',
    size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-[14px]',
    BUTTON_VARIANTS[variant],
  ].join(' ')
}

/** Empty states say what is missing and how to fix it, never just "no data". */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="max-w-[42ch] text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
        {body}
      </p>
      {action}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** Inline explanation of why a control is disabled, with the plan that unlocks it. */
export function PlanLock({ feature, upgradeTo }: { feature: string; upgradeTo: string | null }) {
  return (
    <p className="rounded-[10px] bg-[var(--color-accent-soft)] px-3.5 py-3 text-[13px] leading-snug text-[var(--color-warning)]">
      {feature} está disponible desde el plan {upgradeTo ?? 'superior'}.{' '}
      <a href="/settings/billing" className="font-semibold underline underline-offset-2">
        Ver planes
      </a>
    </p>
  )
}
