'use client'

import { api } from '@/lib/api-client'
import { CAMPAIGN_VARIABLES, renderCampaignText } from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

const fieldClass =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * The first email a customer gets from the business.
 *
 * It arrives seconds after someone handed over their email at a counter, which makes it
 * the single most-opened message the business will ever send. Left blank it still says
 * something sensible in the business's name; written by hand it sounds like them.
 */
export function WelcomeEmailEditor({
  active,
  headline,
  body,
  businessName,
}: {
  active: boolean
  headline: string
  body: string
  businessName: string
}) {
  const router = useRouter()
  const [value, setValue] = useState({ active, headline, body })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const context = { name: 'María', business: businessName, stamps: 0, remaining: 6, hour: null }
  const preview = {
    headline: renderCampaignText(value.headline, context),
    body: renderCampaignText(value.body, context),
  }

  async function save(next: typeof value) {
    setStatus('saving')
    setError(null)
    try {
      await api.put('/v1/automations', {
        type: 'welcome',
        isActive: next.active,
        offsetDays: 0,
        headline: next.headline.trim() || 'Bienvenido',
        body: next.body.trim() || 'Gracias por unirte.',
        offer: { kind: 'none', amount: null, title: null, validForDays: 14 },
        sendEmail: true,
        sendPush: false,
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
        <span className="font-medium">Enviar el correo de bienvenida</span>
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="welcome-headline" className="text-[14px] font-medium">
          Título
        </label>
        <input
          id="welcome-headline"
          value={value.headline}
          onChange={(event) => setValue({ ...value, headline: event.target.value })}
          maxLength={60}
          placeholder={`Ya eres de la casa en ${businessName}`}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="welcome-body" className="text-[14px] font-medium">
          Mensaje
        </label>
        <textarea
          id="welcome-body"
          value={value.body}
          onChange={(event) => setValue({ ...value, body: event.target.value })}
          maxLength={240}
          rows={3}
          placeholder="Gracias por unirte, {{name}}. Te faltan {{remaining}} sellos para tu primera recompensa."
          className={fieldClass}
        />
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
          Puedes usar {CAMPAIGN_VARIABLES.map((name) => `{{${name}}}`).join(', ')}. Si lo dejas
          vacío usamos nuestro texto, siempre a nombre de tu negocio.
        </p>
      </div>

      {value.headline || value.body ? (
        <div className="rounded-[10px] border border-[var(--color-line)] p-4">
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
            Así llega
          </p>
          <p className="mt-2 text-[16px] font-semibold leading-snug">{preview.headline}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
            {preview.body}
          </p>
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
