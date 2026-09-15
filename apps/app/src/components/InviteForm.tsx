'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

export function InviteForm() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    setStatus('sending')
    setError(null)

    try {
      await api.post('/v1/org/members/invite', {
        email: String(form.get('email') ?? '').trim(),
        role: String(form.get('role') ?? 'staff'),
        locationId: null,
      })
      setStatus('sent')
      router.refresh()
      setTimeout(() => setStatus('idle'), 3_000)
    } catch (caught) {
      setStatus('idle')
      setError(
        caught instanceof ApiError
          ? caught.code === 'CONFLICT'
            ? 'Esa persona ya está en tu equipo.'
            : caught.isPlanLimit
              ? `Tu plan no permite más cuentas.${caught.upgradeTo ? ` Sube al plan ${caught.upgradeTo}.` : ''}`
              : caught.message
          : 'No pudimos enviar la invitación.',
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-email" className="text-[14px] font-medium">
            Correo
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="persona@tunegocio.com"
            className="w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="invite-role" className="text-[14px] font-medium">
            Rol
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="staff"
            className="rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
          >
            <option value="staff">Mostrador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'sending'}
          className={buttonClass('primary', 'sm')}
        >
          {status === 'sending' ? 'Enviando' : 'Enviar invitación'}
        </button>
        {status === 'sent' ? (
          <span className="text-[14px] text-[var(--color-success)]">Invitación enviada</span>
        ) : null}
      </div>
    </form>
  )
}
