'use client'

import { api } from '@/lib/api-client'
import { authErrorMessage } from '@/lib/auth-messages'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { buttonClass } from '../ui'
import { AuthNotice } from './AuthShell'

/**
 * Consumes a magic link and lands in the dashboard.
 *
 * The token is single-use, so the effect guards against React running it twice in
 * development — a second call would consume an already-consumed token and show a
 * spurious "this link no longer works".
 */
export function MagicClient({ token }: { token: string }) {
  const router = useRouter()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    api
      .post('/v1/auth/magic-link/consume', { token })
      .then(() => {
        router.replace('/')
        router.refresh()
      })
      .catch((caught) => setError(authErrorMessage(caught)))
  }, [token, router])

  if (error) {
    return (
      <AuthNotice
        tone="danger"
        title="Este enlace ya no sirve"
        body={`${error} Los enlaces para entrar vencen en 15 minutos y solo se pueden usar una vez.`}
        action={
          <a href="/login" className={buttonClass('primary')}>
            Pedir un enlace nuevo
          </a>
        }
      />
    )
  }

  return (
    <AuthNotice
      title="Entrando"
      body={<span aria-live="polite">Un momento, estamos abriendo tu panel.</span>}
    />
  )
}
