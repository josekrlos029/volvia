'use client'

import { api } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Stamping customers who are not at the counter.
 *
 * A delivery business never sees the QR, so its team stamps from the browser extension
 * by cédula, phone or name. Off until the owner says so: a stamp nobody witnessed is
 * easier to hand to a friend, which is also why it can demand the order number.
 */
export function RemoteStampingSettings({
  enabled,
  requireOrder,
}: {
  enabled: boolean
  requireOrder: boolean
}) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(settings: {
    remoteStamping?: boolean
    remoteStampingRequireOrder?: boolean
  }) {
    setWorking(true)
    setError(null)
    try {
      await api.patch('/v1/org', { settings })
      router.refresh()
    } catch {
      setError('No pudimos guardar el cambio. Solo el dueño o un administrador puede hacerlo.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
        Para negocios a domicilio: tu equipo busca al cliente por cédula, teléfono o nombre desde la
        extensión Volvia Biz para Chrome o Safari y le pone el sello sin escanear su código. Se
        aplican las mismas reglas de espera y tope diario, y cada sello queda marcado como «a
        distancia».
      </p>
      <label className="flex items-start gap-3 text-[14px]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          checked={enabled}
          disabled={working}
          onChange={(event) => save({ remoteStamping: event.target.checked })}
        />
        <span>
          <span className="font-medium">Permitir sellos a distancia</span>
          <span className="block text-[13px] text-[var(--color-ink-muted)]">
            Cualquier persona del equipo podrá sellar desde la extensión.
          </span>
        </span>
      </label>
      {enabled ? (
        <label className="flex items-start gap-3 text-[14px]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
            checked={requireOrder}
            disabled={working}
            onChange={(event) => save({ remoteStampingRequireOrder: event.target.checked })}
          />
          <span>
            <span className="font-medium">Pedir el número de pedido</span>
            <span className="block text-[13px] text-[var(--color-ink-muted)]">
              Así puedes cruzar cada sello con tus domicilios.
            </span>
          </span>
        </label>
      ) : null}
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
    </div>
  )
}
