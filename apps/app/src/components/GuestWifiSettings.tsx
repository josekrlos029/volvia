'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/** The Wi-Fi a customer asks for at the counter, on the page instead. */
export function GuestWifiSettings({
  wifi,
  onSaved,
}: {
  wifi: { ssid: string; password: string } | null
  onSaved?: () => void
}) {
  const router = useRouter()
  const [value, setValue] = useState({ ssid: wifi?.ssid ?? '', password: wifi?.password ?? '' })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save(next: { ssid: string; password: string } | null) {
    setStatus('saving')
    setError(null)
    try {
      await api.patch('/v1/org', { settings: { guestWifi: next } })
      if (!next) setValue({ ssid: '', password: '' })
      setStatus('saved')
      router.refresh()
      onSaved?.()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch (caught) {
      setStatus('idle')
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar el Wi-Fi.')
    }
  }

  return (
    <Panel title="Wi-Fi para clientes">
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          Aparece en tu página con un botón para copiar la clave. Déjalo vacío si prefieres no
          compartirlo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[14px] font-medium">
            Nombre de la red
            <input
              value={value.ssid}
              onChange={(event) => setValue({ ...value, ssid: event.target.value })}
              maxLength={32}
              placeholder="Cafe Raices"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-2 text-[14px] font-medium">
            Clave
            <input
              value={value.password}
              onChange={(event) => setValue({ ...value, password: event.target.value })}
              maxLength={63}
              placeholder="Sin clave"
              className={field}
            />
          </label>
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
            type="button"
            onClick={() =>
              void save(
                value.ssid.trim()
                  ? { ssid: value.ssid.trim(), password: value.password.trim() }
                  : null,
              )
            }
            disabled={status === 'saving'}
            className={buttonClass('primary', 'sm')}
          >
            {status === 'saving' ? 'Guardando' : 'Guardar'}
          </button>
          {wifi ? (
            <button
              type="button"
              onClick={() => void save(null)}
              disabled={status === 'saving'}
              className={buttonClass('ghost', 'sm')}
            >
              Quitar de la página
            </button>
          ) : null}
          {status === 'saved' ? (
            <span className="text-[14px] text-[var(--color-success)]">Guardado</span>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
