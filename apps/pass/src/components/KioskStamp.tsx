'use client'

import { browserApiUrl } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { Field, inputClass } from './Field'

const CARD_STORAGE_KEY = 'volvia.card.token'

interface StampResult {
  stampsCount: number
  stampsRequired: number
  unlockedRewards: Array<{ grantId: string; title: string; code: string }>
  customer: { firstName: string }
}

/**
 * Self-service stamping.
 *
 * The customer's card token is remembered locally after the first time, so a regular
 * scans the kiosk and is done in one tap instead of pasting a link every visit.
 */
export function KioskStamp({ nonce }: { nonce: string }) {
  const copy = t('es')
  const [cardToken, setCardToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<StampResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(CARD_STORAGE_KEY)
    if (stored) setCardToken(stored)
  }, [])

  async function stamp(token: string) {
    setStatus('working')
    setError(null)

    try {
      const response = await fetch(`${browserApiUrl}/v1/kiosk/stamp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nonce,
          cardToken: token,
          idempotencyKey: `kiosk-${crypto.randomUUID()}`,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const code = body?.error?.code
        setStatus('error')
        setError(
          code === 'KIOSK_NONCE_INVALID'
            ? 'Ese código ya venció. Vuelve a escanear la pantalla.'
            : code === 'STAMP_COOLDOWN_ACTIVE'
              ? 'Ya sumaste un sello hace poco.'
              : code === 'STAMP_DAILY_CAP_REACHED'
                ? 'Llegaste al máximo de sellos por hoy.'
                : code === 'CUSTOMER_CARD_NOT_FOUND'
                  ? 'No encontramos tu tarjeta. Revisa el enlace.'
                  : 'No pudimos sumar tu sello. Intenta de nuevo.',
        )
        return
      }

      const stamped = (await response.json()) as StampResult
      localStorage.setItem(CARD_STORAGE_KEY, token)
      setResult(stamped)
      setStatus('done')
    } catch {
      setStatus('error')
      setError('No pudimos conectar. Revisa tu señal e intenta de nuevo.')
    }
  }

  if (status === 'done' && result) {
    const hasReward = result.unlockedRewards.length > 0
    return (
      <div className="flex min-h-[70dvh] flex-col justify-center text-center">
        <p className="text-[48px]" aria-hidden="true">
          {hasReward ? '🎉' : '✓'}
        </p>
        <h1 className="mt-3 text-[24px] font-semibold leading-tight">
          {hasReward ? '¡Completaste tu tarjeta!' : 'Sello sumado'}
        </h1>
        <p className="tabular mt-2 text-[16px] text-[var(--color-ink-muted)]">
          {result.stampsCount} de {result.stampsRequired} sellos
        </p>

        {hasReward ? (
          <ul className="mt-5 flex flex-col gap-2">
            {result.unlockedRewards.map((reward) => (
              <li
                key={reward.grantId}
                className="rounded-[12px] bg-[var(--color-accent-soft)] p-4 text-[var(--color-ink)]"
              >
                <p className="text-[16px] font-semibold">{reward.title}</p>
                <p className="font-[family-name:var(--font-geist-mono)] mt-1 text-[24px] font-semibold tracking-[0.18em]">
                  {reward.code}
                </p>
                <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
                  Muestra este código en el mostrador.
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        <a
          href={`/c/${cardToken}`}
          className="mt-6 rounded-[10px] bg-[var(--color-primary)] px-5 py-3 text-[16px] font-semibold text-white"
        >
          Ver mi tarjeta
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center">
      <h1 className="text-[24px] font-semibold leading-tight">Suma tu sello</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
        Pega el enlace de tu tarjeta o ábrela desde tu wallet y vuelve a escanear.
      </p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          const token = cardToken.trim().split('/').pop()?.split('?')[0] ?? ''
          if (token.length >= 16) void stamp(token)
          else setError('Ese enlace no parece válido.')
        }}
      >
        <Field label="Tu tarjeta" htmlFor="cardToken" error={error ?? undefined}>
          <input
            id="cardToken"
            value={cardToken}
            onChange={(event) => setCardToken(event.target.value)}
            className={inputClass}
            placeholder="Pega aquí el enlace de tu tarjeta"
            autoComplete="off"
          />
        </Field>

        <button
          type="submit"
          disabled={status === 'working'}
          className="w-full rounded-[10px] bg-[var(--color-primary)] px-4 py-3.5 text-[16px] font-semibold text-white disabled:opacity-70"
        >
          {status === 'working' ? 'Sumando' : 'Sumar mi sello'}
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] text-[var(--color-ink-muted)]">
        {copy.card.saveHint}
      </p>
    </div>
  )
}
