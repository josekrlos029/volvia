'use client'

import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor: string
  help?: string
  error?: string
  children: ReactNode
}

/**
 * Label above, help text under the label, error below the control. Placeholders are
 * never used as labels: they vanish the moment someone starts typing.
 */
export function Field({ label, htmlFor, help, error, children }: FieldProps) {
  const helpId = help ? `${htmlFor}-help` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-[var(--color-ink)]">
        {label}
      </label>
      {children}
      {help && !error ? (
        <p id={helpId} className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass = [
  'w-full rounded-[10px] border bg-white px-3.5 py-3 text-[16px] text-[var(--color-ink)]',
  'border-[var(--color-line)] placeholder:text-[#8A908A]',
  'focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25',
  'disabled:opacity-60',
].join(' ')
