'use client'

import { api } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

/**
 * Closing the business.
 *
 * Typing the name is not friction for its own sake: it is the difference between
 * meaning it and mis-clicking it. Everything stops working straight away, and we say so
 * before asking, not after.
 */
export function DangerZone({ businessName }: { businessName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = typed.trim().toLowerCase() === businessName.trim().toLowerCase()

  return (
    <Panel title="Cerrar el negocio">
      <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
        Tu página pública y tus tarjetas dejan de funcionar al momento, y tus clientes ya no podrán
        abrir las suyas. Guardamos los datos un tiempo por si fue un error: escríbenos y los
        recuperamos.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${buttonClass('secondary')} mt-4`}
        >
          Quiero cerrar mi negocio
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label htmlFor="confirm-name" className="text-[14px] font-medium">
            Escribe <span className="font-semibold">{businessName}</span> para confirmar
          </label>
          <input
            id="confirm-name"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] focus:border-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]/25"
          />

          {error ? (
            <p role="alert" className="text-[13px] text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!matches || working}
              onClick={async () => {
                setWorking(true)
                setError(null)
                try {
                  await api.post('/v1/org/close', { confirmName: typed.trim() })
                  router.push('/login')
                  router.refresh()
                } catch {
                  setWorking(false)
                  setError('No pudimos cerrarlo. Intenta de nuevo.')
                }
              }}
              className={`${buttonClass('danger')} disabled:opacity-50`}
            >
              {working ? 'Cerrando' : 'Cerrar definitivamente'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setTyped('')
              }}
              className={buttonClass('ghost')}
            >
              Mejor no
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}
