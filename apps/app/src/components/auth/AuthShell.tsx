import type { ReactNode } from 'react'

/**
 * The frame every screen outside the dashboard shares: sign in, sign up, and the four
 * pages our emails link to. One shell so a person who arrives from an email never
 * wonders whether they are still on Volvia.
 */
export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: string
  lead?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <header className="mb-8">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Volvia</p>
        <h1 className="mt-6 text-[26px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
        {lead ? (
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">{lead}</p>
        ) : null}
      </header>

      {children}

      {footer ? (
        <p className="mt-6 text-center text-[14px] text-[var(--color-ink-muted)]">{footer}</p>
      ) : null}
    </main>
  )
}

/** A result, not a form: what happened, and the one thing to do next. */
export function AuthNotice({
  tone = 'neutral',
  title,
  body,
  action,
}: {
  tone?: 'neutral' | 'success' | 'danger'
  title: string
  body?: ReactNode
  action?: ReactNode
}) {
  const accent =
    tone === 'success'
      ? 'border-[var(--color-success)]/30 bg-[#F2F8F4]'
      : tone === 'danger'
        ? 'border-[var(--color-danger)]/25 bg-[#FBEBEA]'
        : 'border-[var(--color-line)] bg-white'

  return (
    <div className={`rounded-[12px] border p-5 ${accent}`}>
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {body ? (
        <div className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">{body}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export const fieldClass =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[15px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

export const labelClass = 'text-[14px] font-medium'
