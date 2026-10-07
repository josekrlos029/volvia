'use client'

import { api } from '@/lib/api-client'
import { authErrorMessage } from '@/lib/auth-messages'
import type { Role } from '@volvia/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from '../ui'
import { AuthNotice, fieldClass, labelClass } from './AuthShell'
import { FormError } from './FormError'

export interface InvitePreview {
  email: string
  orgName: string
  role: Role
  needsAccount: boolean
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'dueño',
  admin: 'administrador',
  staff: 'personal de mostrador',
}

/**
 * Accepting an invitation takes two shapes: someone who already has a Volvia account
 * just confirms, and someone brand new picks a name and a password. The email always
 * comes from the invitation, never from this form.
 */
export function InviteClient({
  token,
  preview,
  signedIn,
}: {
  token: string
  preview: InvitePreview
  signedIn: boolean
}) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intro = (
    <>
      Te invitaron a{' '}
      <strong className="font-semibold text-[var(--color-ink)]">{preview.orgName}</strong> como{' '}
      {ROLE_LABEL[preview.role]}, con el correo {preview.email}.
    </>
  )

  async function accept(body: Record<string, unknown>, path: string) {
    setError(null)
    setWorking(true)
    try {
      await api.post(path, body)
      router.push('/')
      router.refresh()
    } catch (caught) {
      setWorking(false)
      setError(authErrorMessage(caught))
    }
  }

  if (signedIn || !preview.needsAccount) {
    return (
      <div className="flex flex-col gap-4">
        <AuthNotice title={`Únete a ${preview.orgName}`} body={intro} />

        {error ? <FormError>{error}</FormError> : null}

        {signedIn ? (
          <button
            type="button"
            disabled={working}
            onClick={() => accept({ token }, '/v1/org/members/accept')}
            className={`${buttonClass('primary')} w-full`}
          >
            {working ? 'Entrando' : 'Aceptar la invitación'}
          </button>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
              Ese correo ya tiene una cuenta de Volvia. Entra y vuelve a abrir este enlace para
              aceptar.
            </p>
            <a
              href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}
              className={`${buttonClass('primary')} w-full`}
            >
              Entrar
            </a>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthNotice title={`Únete a ${preview.orgName}`} body={intro} />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void accept(
            {
              token,
              name: String(form.get('name') ?? '').trim(),
              password: String(form.get('password') ?? ''),
            },
            '/p/invite/accept',
          )
        }}
      >
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
            className={fieldClass}
            placeholder="Ana Martínez"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className={labelClass}>
            Elige una contraseña
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

        {error ? <FormError>{error}</FormError> : null}

        <button type="submit" disabled={working} className={`${buttonClass('primary')} w-full`}>
          {working ? 'Creando tu cuenta' : 'Aceptar y entrar'}
        </button>
      </form>
    </div>
  )
}
