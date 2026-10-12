'use client'

import { browserApiUrl } from '@/lib/api'
import { useEffect } from 'react'

/** Tells the API the page was opened. Fire-and-forget; a blocked beacon costs nothing. */
export function PageViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const url = `${browserApiUrl}/p/business/${encodeURIComponent(slug)}/view`
    try {
      if (!navigator.sendBeacon?.(url)) {
        void fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined)
      }
    } catch {
      // Nothing to do: the page works the same whether or not it was counted.
    }
  }, [slug])
  return null
}
