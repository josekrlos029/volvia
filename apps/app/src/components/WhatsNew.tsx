'use client'

import { CHANGELOG, LATEST_CHANGELOG_DATE } from '@/content/changelog'
import { formatDate } from '@/lib/format'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const SEEN_KEY = 'volvia:whatsnew'

/**
 * "Novedades": a button with a dot while there is a release the owner has not opened,
 * and a side panel with the notes. Seen state lives in the browser; this is a nudge,
 * not a record, so nothing about it needs the server.
 */
export function WhatsNew({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(SEEN_KEY) ?? ''
      setUnread(LATEST_CHANGELOG_DATE > seen)
    } catch {
      setUnread(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function show() {
    setOpen(true)
    setUnread(false)
    try {
      window.localStorage.setItem(SEEN_KEY, LATEST_CHANGELOG_DATE)
    } catch {
      // Private mode: the dot simply comes back next time.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          'relative inline-flex items-center gap-2 rounded-[8px] text-[14px] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]',
          compact
            ? 'border border-[var(--color-line)] px-3 py-1.5 text-[13px] font-medium'
            : 'w-full px-3 py-2 text-left',
        ].join(' ')}
      >
        Qué hay de nuevo
        {unread ? (
          <span
            aria-label="Hay novedades sin leer"
            className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]"
          />
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button
            type="button"
            aria-label="Cerrar novedades"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(16,18,15,0.35)]"
          />
          <dialog
            open
            aria-modal="true"
            aria-labelledby="whats-new-title"
            className="relative m-0 flex h-full w-full max-w-[420px] flex-col overflow-y-auto border-l border-[var(--color-line)] bg-white p-6 text-[var(--color-ink)] shadow-[-12px_0_40px_-12px_rgba(16,18,15,0.3)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="whats-new-title" className="text-[18px] font-semibold tracking-[-0.01em]">
                  Qué hay de nuevo
                </h2>
                <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
                  Lo último que cambió en Volvia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-[var(--color-line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--color-surface-muted)]"
              >
                Cerrar
              </button>
            </div>

            <ol className="mt-6 flex flex-col divide-y divide-[var(--color-line)]">
              {CHANGELOG.map((entry) => (
                <li key={entry.id} className="py-4 first:pt-0">
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                    {formatDate(entry.date)}
                  </p>
                  <h3 className="mt-1 text-[15px] font-semibold leading-snug">{entry.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
                    {entry.body}
                  </p>
                  {entry.href ? (
                    <Link
                      href={entry.href}
                      onClick={() => setOpen(false)}
                      className="mt-2 inline-block text-[14px] font-medium text-[var(--color-primary)] underline underline-offset-2"
                    >
                      Ir a verlo
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          </dialog>
        </div>
      ) : null}
    </>
  )
}
