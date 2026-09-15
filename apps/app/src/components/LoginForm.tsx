'use client'

import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

type Mode = 'password' | 'magic'

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('password')
  const [status, setStatus] = useState<'idle' | 'working' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()

    setError(null)
    setStatus('working')

    try {
      if (mode === 'magic') {
        const response = await fetch(`${apiUrl}/v1/auth/magic-link`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email }),
        })
        if (!response.ok) throw new Error('No pudimos enviar el enlace.')
        setStatus('sent')
        return
      }

      const response = await fetch(`${apiUrl}/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password: String(form.get('password') ?? '') }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(response.status, body?.error ?? { code: 'INTERNAL', message: 'Error' })
      }

      // The API sets httpOnly cookies; a refresh is enough for the server to see them.
      router.push('/')
      router.refresh()
    } catch (caught) {
      setStatus('idle')
      setError(
        caught instanceof ApiError && caught.code === 'INVALID_CREDENTIALS'
          ? 'Correo o contraseña incorrectos.'
          : caught instanceof Error
            ? caught.message
            : 'Algo salió mal. Intenta de nuevo.',
      )
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-[12px] border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-[16px] font-semibold">Revisa tu correo</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          Te enviamos un enlace para entrar. Vence en 15 minutos.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className={`${buttonClass('ghost', 'sm')} mt-4 -ml-3`}
        >
          Usar otro correo
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[14px] font-medium">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[15px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
          placeholder="hola@tunegocio.com"
        />
      </div>

      {mode === 'password' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[14px] font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[15px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
          />
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'working'}
        className={`${buttonClass('primary')} w-full`}
      >
        {status === 'working' ? 'Entrando' : mode === 'magic' ? 'Enviar enlace' : 'Entrar'}
      </button>

      <div className="flex items-center justify-between text-[14px]">
        <button
          type="button"
          onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
          className="font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          {mode === 'password' ? 'Entrar con un enlace' : 'Usar contraseña'}
        </button>
        <a
          href="/reset-password"
          className="text-[var(--color-ink-muted)] underline underline-offset-2"
        >
          Olvidé mi contraseña
        </a>
      </div>
    </form>
  )
}
