import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const field =
  'w-full rounded-[10px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#94A3B8] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

const VARIANTS = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50',
  secondary:
    'border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50',
  ghost: 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
} as const

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
    />
  )
}

/** Header and body of every screen, so they all sit on the same lines. */
export function Screen({ header, children }: { header?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[520px] flex-col">
      {header ? (
        <header className="flex items-center gap-2 border-b border-[var(--color-line)] bg-white px-4 py-3">
          {header}
        </header>
      ) : null}
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </div>
  )
}

export function Notice({
  tone = 'neutral',
  children,
}: { tone?: 'neutral' | 'danger'; children: ReactNode }) {
  return (
    <p
      role={tone === 'danger' ? 'alert' : undefined}
      className={`rounded-[10px] px-3.5 py-2.5 text-[13px] leading-snug ${
        tone === 'danger'
          ? 'bg-[#FDECEA] text-[var(--color-danger)]'
          : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
      }`}
    >
      {children}
    </p>
  )
}
