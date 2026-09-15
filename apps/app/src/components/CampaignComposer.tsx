'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Panel, buttonClass } from './ui'

/**
 * Campaign templates.
 *
 * Each one is a real situation a shop owner recognises, with the offer and timing
 * already sensible. Starting from a blank campaign form is how campaigns never get sent.
 */
const TEMPLATES = [
  {
    id: 'slow_day',
    name: 'Día flojo',
    headline: 'Hoy tus sellos valen doble',
    body: 'Pásate hoy y suma dos sellos en lugar de uno.',
    offer: { kind: 'multiplier' as const, factor: 2 },
    days: 1,
    description: 'Para llenar el día más tranquilo de tu semana.',
  },
  {
    id: 'happy_hour',
    name: 'Hora feliz',
    headline: 'De 3 a 6 sumas doble',
    body: 'Esta semana, cada visita entre las 3 y las 6 suma dos sellos.',
    offer: { kind: 'multiplier' as const, factor: 2 },
    days: 7,
    hours: { from: '15:00', to: '18:00' },
    description: 'Mueve gente a las horas muertas de la tarde.',
  },
  {
    id: 'win_back',
    name: 'Recupéralos',
    headline: 'Te dejamos un sello de regalo',
    body: 'Hace rato no te vemos. Pasa y encuentra un sello ya puesto en tu tarjeta.',
    offer: { kind: 'bonus_stamps' as const, amount: 1 },
    days: 14,
    segment: 'inactive' as const,
    description: 'Para quienes no vuelven hace más de dos meses.',
  },
]

export function CampaignComposer({ cards }: { cards: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [audienceSize, setAudienceSize] = useState<number | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = TEMPLATES.find((item) => item.id === selected)

  // Show the reach before sending: "this goes to 214 people" is the number that
  // decides whether a campaign is worth launching.
  useEffect(() => {
    if (!template) {
      setAudienceSize(null)
      return
    }
    let cancelled = false
    api
      .post<{ size: number }>('/v1/campaigns/preview', {
        segment: template.segment ?? 'all',
        cardIds: cards.map((card) => card.id),
        customerIds: [],
        consentOnly: true,
      })
      .then((response) => {
        if (!cancelled) setAudienceSize(response.size)
      })
      .catch(() => {
        if (!cancelled) setAudienceSize(null)
      })
    return () => {
      cancelled = true
    }
  }, [cards, template])

  async function launch() {
    if (!template) return
    setWorking(true)
    setError(null)

    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + template.days * 86_400_000)

    try {
      const created = await api.post<{ id: string }>('/v1/campaigns', {
        name: template.name,
        template: template.id,
        headline: template.headline,
        body: template.body,
        offer: template.offer,
        audience: {
          segment: template.segment ?? 'all',
          cardIds: cards.map((card) => card.id),
          customerIds: [],
          consentOnly: true,
        },
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        sendPush: true,
        activeWeekdays: [],
        activeHours: template.hours ?? null,
      })
      await api.post(`/v1/campaigns/${created.id}/launch`)
      setSelected(null)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.isPlanLimit
            ? 'Llegaste al máximo de campañas de este mes.'
            : caught.message
          : 'No pudimos lanzar la campaña.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <Panel title="Lanzar una campaña">
      <ul className="grid gap-3 md:grid-cols-3">
        {TEMPLATES.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelected(selected === item.id ? null : item.id)}
              aria-pressed={selected === item.id}
              className={[
                'h-full w-full rounded-[10px] border p-3.5 text-left transition-colors',
                selected === item.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                  : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]',
              ].join(' ')}
            >
              <p className="text-[14px] font-semibold">{item.name}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--color-ink-muted)]">
                {item.description}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {template ? (
        <div className="mt-4 rounded-[10px] border border-[var(--color-line)] p-4">
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
            Así lo verá tu cliente
          </p>
          <div className="mt-2.5 rounded-[9px] bg-[var(--color-ink)] p-3.5 text-white">
            <p className="text-[15px] font-semibold">{template.headline}</p>
            <p className="mt-1 text-[14px] leading-snug opacity-80">{template.body}</p>
          </div>

          <p className="mt-3 text-[14px] text-[var(--color-ink-muted)]">
            {audienceSize === null
              ? 'Calculando a cuántas personas llega'
              : `Llega a ${audienceSize} cliente${audienceSize === 1 ? '' : 's'} que aceptaron promociones. Dura ${template.days} día${template.days === 1 ? '' : 's'}.`}
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={launch}
            disabled={working || audienceSize === 0}
            className={`${buttonClass('primary', 'sm')} mt-4`}
          >
            {working ? 'Lanzando' : 'Lanzar ahora'}
          </button>
        </div>
      ) : null}
    </Panel>
  )
}
