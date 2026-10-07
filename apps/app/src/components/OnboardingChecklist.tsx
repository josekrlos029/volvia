'use client'

import { api } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

/**
 * The one step nothing else can observe: whether the QR actually made it to the
 * counter. Everything else on the checklist is derived from real data, so this is the
 * only flag the browser has to write.
 */
export function MarkQrPrinted() {
  const router = useRouter()
  const [working, setWorking] = useState(false)

  return (
    <button
      type="button"
      disabled={working}
      onClick={async () => {
        setWorking(true)
        try {
          await api.patch('/v1/org/onboarding', { qrDownloaded: true })
          router.refresh()
        } finally {
          setWorking(false)
        }
      }}
      className={buttonClass('secondary', 'sm')}
    >
      {working ? 'Guardando' : 'Ya está en el mostrador'}
    </button>
  )
}
