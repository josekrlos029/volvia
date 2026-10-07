'use client'

import { api } from '@/lib/api-client'
import { authErrorMessage } from '@/lib/auth-messages'
import type { SessionUser } from '@volvia/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from '../ui'
import { fieldClass, labelClass } from './AuthShell'
import { FormError } from './FormError'
import { GoogleButton, OrDivider } from './GoogleButton'

interface RegisterResponse {
  user: SessionUser
}

/**
 * Creates the person and their business in one step, which is how the API models it:
 * a Volvia account with no business cannot do anything, so asking for the business name
 * here saves a second screen before the person has seen any value.
 */
export function SignupForm({
  defaultEmail = '',
  defaultName = '',
}: {
  defaultEmail?: string
  defaultName?: string
}) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    setError(null)
    setWorking(true)

    try {
      await api.post<RegisterResponse>('/v1/auth/register', {
        name: String(form.get('name') ?? '').trim(),
        businessName: String(form.get('businessName') ?? '').trim(),
        email: String(form.get('email') ?? '')
          .trim()
          .toLowerCase(),
        password: String(form.get('password') ?? ''),
        marketingOptIn: form.get('marketingOptIn') === 'on',
      })

      // The API set the session cookies; the server components can see them after a refresh.
      router.push('/onboarding')
      router.refresh()
    } catch (caught) {
      setWorking(false)
      setError(authErrorMessage(caught))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton label="Continuar con Google" />
      <OrDivider />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="businessName" className={labelClass}>
            Nombre del negocio
          </label>
          <input
            id="businessName"
            name="businessName"
            required
            minLength={2}
            maxLength={120}
            autoComplete="organization"
            className={fieldClass}
            placeholder="Café Luna"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className={labelClass}>
            Tu nombre
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            defaultValue={defaultName}
            className={fieldClass}
            placeholder="Ana Martínez"
          />
        </div>

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

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className={labelClass}>
            Contraseña
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
            Al menos 12 caracteres. Una frase que recuerdes sirve mejor que símbolos.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-[14px] leading-snug">
          <input
            name="marketingOptIn"
            type="checkbox"
            className="mt-0.5 size-4 rounded border-[var(--color-line)] accent-[var(--color-primary)]"
          />
          <span className="text-[var(--color-ink-muted)]">
            Quiero recibir consejos para que mis clientes vuelvan más.
          </span>
        </label>

        {error ? <FormError>{error}</FormError> : null}

        <button type="submit" disabled={working} className={`${buttonClass('primary')} w-full`}>
          {working ? 'Creando tu cuenta' : 'Crear mi cuenta gratis'}
        </button>

        <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
          Al crear tu cuenta aceptas los{' '}
          <a
            href={`${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/es/terminos`}
            className="underline underline-offset-2"
          >
            términos
          </a>{' '}
          y la{' '}
          <a
            href={`${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/es/privacidad`}
            className="underline underline-offset-2"
          >
            política de privacidad
          </a>
          .
        </p>
      </form>
    </div>
  )
}
