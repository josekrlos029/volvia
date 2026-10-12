'use client'

import { api } from '@/lib/api-client'
import { type CampaignPassOverrideInput, EMPTY_PASS_OVERRIDE } from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PreviewDesign } from './CardPreview'
import { OfferDesigner } from './OfferDesigner'
import { buttonClass } from './ui'

/** The birthday look, before the business touches it: a cake, and gone after the visit. */
export const BIRTHDAY_PASS_DEFAULTS: CampaignPassOverrideInput = {
  ...EMPTY_PASS_OVERRIDE,
  header: 'CUMPLEAÑOS',
  banner: { kind: 'preset', value: 'cake' },
  endsOnFirstStamp: true,
}

const VALIDITY_CHOICES = [
  { days: 7, label: '1 semana' },
  { days: 14, label: '2 semanas' },
  { days: 30, label: '1 mes' },
]

export function AutomationToggle({
  active,
  headline,
  body,
  bonusStamps,
  validForDays,
  sendEmail,
  passOverride,
  businessName,
  previewCard,
}: {
  active: boolean
  headline: string
  body: string
  bonusStamps: number
  validForDays: number
  sendEmail: boolean
  passOverride: CampaignPassOverrideInput
  businessName: string
  previewCard?: {
    name: string
    design: PreviewDesign
    stampsRequired: number
    rewardPositions: number[]
  } | null
}) {
  const router = useRouter()
  const [value, setValue] = useState({
    active,
    headline,
    body,
    bonusStamps,
    validForDays,
    sendEmail,
    passOverride,
  })
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
          validForDays: next.validForDays,
        },
        sendEmail: next.sendEmail,
        sendPush: true,
        passOverride: next.passOverride,
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

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-medium">¿Cuánto dura el detalle?</p>
        <div className="flex flex-wrap gap-2">
          {VALIDITY_CHOICES.map((choice) => (
            <button
              key={choice.days}
              type="button"
              onClick={() => setValue({ ...value, validForDays: choice.days })}
              aria-pressed={value.validForDays === choice.days}
              className={[
                'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                value.validForDays === choice.days
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]',
              ].join(' ')}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
          Si el cliente no viene, la tarjeta vuelve a la normalidad sola al vencer.
        </p>
      </div>

      <label className="flex items-start gap-3 text-[14px]">
        <input
          type="checkbox"
          checked={value.sendEmail}
          onChange={(event) => setValue({ ...value, sendEmail: event.target.checked })}
          className="mt-0.5 h-[18px] w-[18px] accent-[var(--color-primary)]"
        />
        <span>
          <span className="font-medium">Enviar también un correo</span>
          <span className="mt-0.5 block text-[13px] text-[var(--color-ink-muted)]">
            Sale entre las 8:00 y las 10:00 de tu hora, solo a quien aceptó recibir promociones.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-medium">Cómo se ve en la tarjeta ese día</p>
        <OfferDesigner
          value={value.passOverride}
          onChange={(passOverride) => setValue({ ...value, passOverride })}
          design={previewCard?.design ?? null}
          businessName={businessName}
          cardName={previewCard?.name}
          stampsRequired={previewCard?.stampsRequired}
          rewardPositions={previewCard?.rewardPositions}
          previewMessage={value.headline}
          idPrefix="birthday"
        />
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
