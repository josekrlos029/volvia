'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

export function AutomationToggle({
  active,
  headline,
  body,
  bonusStamps,
}: {
  active: boolean
  headline: string
  body: string
  bonusStamps: number
}) {
  const router = useRouter()
  const [value, setValue] = useState({ active, headline, body, bonusStamps })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save(next: typeof value) {
    setStatus('saving')
    setError(null)
    try {
      await api.put('/v1/automations', {
        type: 'birthday',
        isActive: next.active,
        offsetDays: 0,
        headline: next.headline,
        body: next.body,
        offer: {
          kind: 'bonus_stamps',
          amount: next.bonusStamps,
          title: null,
          validForDays: 14,
        },
        sendEmail: true,
        sendPush: true,
      })
      setValue(next)
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch (caught) {
      setStatus('idle')
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar el cambio.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-[14px]">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(event) => void save({ ...value, active: event.target.checked })}
          className="mt-0.5 h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        <span className="font-medium">Activar el detalle de cumpleaños</span>
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="birthday-headline" className="text-[14px] font-medium">
          Título
        </label>
        <input
          id="birthday-headline"
          value={value.headline}
          onChange={(event) => setValue({ ...value, headline: event.target.value })}
          maxLength={60}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="birthday-body" className="text-[14px] font-medium">
          Mensaje
        </label>
        <textarea
          id="birthday-body"
          value={value.body}
          onChange={(event) => setValue({ ...value, body: event.target.value })}
          maxLength={240}
          rows={2}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="birthday-bonus" className="text-[14px] font-medium">
          Sellos de regalo
        </label>
        <select
          id="birthday-bonus"
          value={value.bonusStamps}
          onChange={(event) => setValue({ ...value, bonusStamps: Number(event.target.value) })}
          className={fieldClass}
        >
          {[1, 2, 3].map((amount) => (
            <option key={amount} value={amount}>
              {amount}
            </option>
          ))}
        </select>
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
          onClick={() => void save(value)}
          disabled={status === 'saving'}
          className={buttonClass('primary', 'sm')}
        >
          {status === 'saving' ? 'Guardando' : 'Guardar'}
        </button>
        {status === 'saved' ? (
          <span className="text-[14px] text-[var(--color-success)]">Guardado</span>
        ) : null}
      </div>
    </div>
  )
}

const fieldClass =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'
