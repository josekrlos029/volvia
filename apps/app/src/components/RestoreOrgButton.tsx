'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

/** One tap undoes a closed business while its window is open. */
export function RestoreOrgButton({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={working}
        onClick={async () => {
          setWorking(true)
          setError(null)
          try {
            await api.post('/v1/org/restore', { orgId })
            router.push('/')
            router.refresh()
          } catch (caught) {
            setWorking(false)
            setError(
              caught instanceof ApiError
                ? caught.message
                : `No pudimos recuperar ${name}. Intenta de nuevo.`,
            )
          }
        }}
        className={buttonClass('primary', 'sm')}
      >
        {working ? 'Recuperando' : `Recuperar ${name}`}
      </button>
      {error ? (
        <p role="alert" className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
