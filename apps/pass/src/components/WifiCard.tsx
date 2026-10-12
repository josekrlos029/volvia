'use client'

import { useState } from 'react'

/**
 * The guest Wi-Fi, on the page instead of on a sticky note by the till. The password
 * copies with one tap, which is the whole reason it is here.
 */
export function WifiCard({
  ssid,
  password,
  labels,
}: {
  ssid: string
  password: string
  labels: { title: string; password: string; copy: string; copied: string }
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mb-6 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        {labels.title}
      </h2>
      <p className="mt-1.5 text-[16px] font-medium leading-snug">{ssid}</p>
      {password ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 text-[14px] text-[var(--color-ink-muted)]">
            {labels.password}: <span className="font-mono text-[var(--color-ink)]">{password}</span>
          </p>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-[9px] border border-[var(--color-line)] px-3 py-1.5 text-[13px] font-medium transition-transform duration-150 active:scale-[0.985]"
          >
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
      ) : null}
    </section>
  )
}
