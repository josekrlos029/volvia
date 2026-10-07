'use client'

import { api } from '@/lib/api-client'
import { REVIEW_REQUEST_COOLDOWN_DAYS } from '@volvia/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

/**
 * Turning the ask off without unlinking Google.
 *
 * A business in the middle of a bad week should be able to stop asking for public
 * reviews today and start again on Monday, without losing the connection or the
 * history behind it.
 */
export function ReviewPauseToggle({ paused }: { paused: boolean }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={working}
        onClick={async () => {
          setWorking(true)
          try {
            await api.patch('/v1/org', { settings: { reviewRequestsPaused: !paused } })
            router.refresh()
          } finally {
            setWorking(false)
          }
        }}
        className={buttonClass(paused ? 'primary' : 'secondary')}
      >
        {working ? 'Guardando' : paused ? 'Volver a pedir reseñas' : 'Pausar las reseñas'}
      </button>
      <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
        {paused
          ? 'Ahora mismo no le pedimos reseñas a nadie.'
          : `A cada cliente se le pide como mucho una vez cada ${REVIEW_REQUEST_COOLDOWN_DAYS} días.`}
      </p>
    </div>
  )
}
