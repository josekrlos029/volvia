'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

export function PublishButton({ cardId }: { cardId: string }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function publish() {
    setWorking(true)
    setError(null)
    try {
      await api.post(`/v1/cards/${cardId}/publish`)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.isPlanLimit
            ? `Tu plan permite menos tarjetas activas.${caught.upgradeTo ? ` Sube al plan ${caught.upgradeTo} para activar más.` : ''}`
            : caught.message
          : 'No pudimos publicar la tarjeta.',
      )
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={publish} disabled={working} className={buttonClass('primary')}>
        {working ? 'Publicando' : 'Publicar tarjeta'}
      </button>
      {error ? (
        <p role="alert" className="max-w-[34ch] text-right text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
