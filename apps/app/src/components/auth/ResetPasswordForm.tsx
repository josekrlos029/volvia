'use client'

import { api } from '@/lib/api-client'
import { authErrorMessage } from '@/lib/auth-messages'
import { useState } from 'react'
import { buttonClass } from '../ui'
import { AuthNotice, fieldClass, labelClass } from './AuthShell'
import { FormError } from './FormError'

/**
 * Two screens behind one URL, because that is how the emailed link works: without a
 * token it asks where to send the link, with one it sets the new password.
 */
export function RequestResetForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (state === 'sent') {
    return (
      <AuthNotice
        title="Revisa tu correo"
        body="Si ese correo tiene una cuenta, te enviamos un enlace para cambiar la contraseña. Vence en una hora."
        action={
          <a href="/login" className={buttonClass('secondary')}>
            Volver a entrar
          </a>
        }
      />
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const email = String(new FormData(event.currentTarget).get('email') ?? '')
          .trim()
          .toLowerCase()
        setError(null)
        setState('working')
        try {
          await api.post('/v1/auth/password-reset/request', { email })
          setState('sent')
        } catch (caught) {
          setState('idle')
          setError(authErrorMessage(caught))
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={labelClass}>
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          className={fieldClass}
          placeholder="hola@tunegocio.com"
        />
      </div>

      {error ? <FormError>{error}</FormError> : null}

      <button
        type="submit"
        disabled={state === 'working'}
        className={`${buttonClass('primary')} w-full`}
      >
        {state === 'working' ? 'Enviando' : 'Enviarme el enlace'}
      </button>
    </form>
  )
}

export function SetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (state === 'done') {
    return (
      <AuthNotice
        tone="success"
        title="Contraseña cambiada"
        body="Cerramos las demás sesiones por seguridad. Entra con la nueva contraseña."
        action={
          <a href="/login" className={buttonClass('primary')}>
            Entrar
          </a>
        }
      />
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const password = String(form.get('password') ?? '')
        if (password !== String(form.get('confirm') ?? '')) {
          setError('Las dos contraseñas no son iguales.')
          return
        }

        setError(null)
        setState('working')
        try {
          await api.post('/v1/auth/password-reset/confirm', { token, password })
          setState('done')
        } catch (caught) {
          setState('idle')
          setError(authErrorMessage(caught))
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className={labelClass}>
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          aria-describedby="password-hint"
          className={fieldClass}
        />
        <p id="password-hint" className="text-[13px] text-[var(--color-ink-muted)]">
          Al menos 12 caracteres.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className={labelClass}>
          Repítela
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className={fieldClass}
        />
      </div>

      {error ? <FormError>{error}</FormError> : null}

      <button
        type="submit"
        disabled={state === 'working'}
        className={`${buttonClass('primary')} w-full`}
      >
        {state === 'working' ? 'Guardando' : 'Cambiar mi contraseña'}
      </button>
    </form>
  )
}
