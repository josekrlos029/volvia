'use client'

import { api } from '@/lib/api-client'
import { authErrorMessage } from '@/lib/auth-messages'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { buttonClass } from '../ui'
import { AuthNotice } from './AuthShell'

type State = 'working' | 'done' | 'failed'

export function VerifyEmailClient({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter()
  const started = useRef(false)
  const [state, setState] = useState<State>('working')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    api
      .post('/v1/auth/verify-email/consume', { token })
      .then(() => {
        setState('done')
        // A verified address can change what the dashboard shows, so refresh the session.
        router.refresh()
      })
      .catch((caught) => {
        setError(authErrorMessage(caught))
        setState('failed')
      })
  }, [token, router])

  if (state === 'working') {
    return <AuthNotice title="Comprobando" body="Un momento." />
  }

  if (state === 'failed') {
    return (
      <AuthNotice
        tone="danger"
        title="No pudimos confirmar tu correo"
        body={error ?? undefined}
        action={
          signedIn ? (
            <ResendButton />
          ) : (
            <a href="/login" className={buttonClass('primary')}>
              Entrar
            </a>
          )
        }
      />
    )
  }

  return (
    <AuthNotice
      tone="success"
      title="Correo confirmado"
      body="Ya puedes recibir avisos de tus clientes y recuperar tu contraseña si la olvidas."
      action={
        <a href="/" className={buttonClass('primary')}>
          Ir a mi panel
        </a>
      }
    />
  )
}

/** Only useful for someone already signed in: the endpoint takes the session, not an email. */
export function ResendButton() {
  const [state, setState] = useState<'idle' | 'working' | 'sent' | 'failed'>('idle')

  if (state === 'sent') {
    return (
      <p className="text-[14px] text-[var(--color-ink-muted)]">
        Listo, te enviamos otro correo. Revisa también la carpeta de no deseados.
      </p>
    )
  }

  return (
    <button
      type="button"
      disabled={state === 'working'}
      onClick={() => {
        setState('working')
        api
          .post('/v1/auth/verify-email/send')
          .then(() => setState('sent'))
          .catch(() => setState('failed'))
      }}
      className={buttonClass('primary')}
    >
      {state === 'working'
        ? 'Enviando'
        : state === 'failed'
          ? 'Reintentar'
          : 'Enviarme otro correo'}
    </button>
  )
}
