'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useState } from 'react'
import { AuthShell } from './auth/AuthShell'
import { buttonClass } from './ui'

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-center font-mono text-[20px] tracking-[0.2em] uppercase focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * Approves the code the extension is showing. The code arrives in the link the
 * extension opened, but the person still compares it by eye and presses the button:
 * a link alone must never be enough to hand someone a session.
 */
export function ConnectExtension({ code, name }: { code: string; name: string }) {
  const [value, setValue] = useState(code)
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    setStatus('working')
    setError(null)
    try {
      await api.post('/v1/auth/device/approve', { userCode: value })
      setStatus('done')
    } catch (caught) {
      setStatus('idle')
      setError(
        caught instanceof ApiError && (caught.code === 'NOT_FOUND' || caught.code === 'CONFLICT')
          ? 'Ese código venció o ya se usó. Vuelve a la extensión y pide uno nuevo.'
          : 'No pudimos conectar la extensión. Intenta de nuevo.',
      )
    }
  }

  if (status === 'done') {
    return (
      <AuthShell
        title="Extensión conectada"
        lead="Ya puedes cerrar esta pestaña. La extensión entra sola en unos segundos."
      >
        <span />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Conectar la extensión"
      lead={`Vas a entrar a la extensión Volvia Biz como ${name}. Revisa que el código sea el mismo que ves en ella.`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void approve()
        }}
      >
        <input
          aria-label="Código de la extensión"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          className={field}
        />
        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={status === 'working' || value.replace(/[^0-9A-Za-z]/g, '').length !== 8}
          className={buttonClass('primary')}
        >
          {status === 'working' ? 'Conectando' : 'Conectar en este navegador'}
        </button>
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
          Si no abriste tú la extensión, no conectes: cierra esta pestaña.
        </p>
      </form>
    </AuthShell>
  )
}
