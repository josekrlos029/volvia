'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Keeps an open card current.
 *
 * A customer often leaves the page open, hands the phone over the counter and comes
 * back to it. When the tab becomes visible again the server render is fetched anew, so
 * the stamp just added is there without a manual reload. Throttled so flicking between
 * apps does not hammer the API.
 */
export function RefreshOnReturn({ minIntervalMs = 5_000 }: { minIntervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    let last = Date.now()
    const onChange = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - last < minIntervalMs) return
      last = Date.now()
      router.refresh()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [router, minIntervalMs])

  return null
}

/**
 * "¡Sello sumado!" after the kiosk or the counter sends the customer here with
 * `?stamped=1`. The flag is dropped from the address once shown, so a reload or a
 * bookmark does not celebrate the same stamp twice.
 */
export function StampedToast({ show, label }: { show: boolean; label: string }) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (!show) return
    const url = new URL(window.location.href)
    url.searchParams.delete('stamped')
    window.history.replaceState(window.history.state, '', url)
    const timer = window.setTimeout(() => setVisible(false), 3_200)
    return () => window.clearTimeout(timer)
  }, [show])

  if (!visible) return null

  return (
    <output className="toast-in pointer-events-none fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <p className="rounded-full bg-[var(--color-inverse-surface)] px-4 py-2.5 text-[15px] font-semibold text-[var(--color-surface)] shadow-[0_10px_30px_-10px_rgba(15,23,42,0.5)]">
        {label}
      </p>
    </output>
  )
}
