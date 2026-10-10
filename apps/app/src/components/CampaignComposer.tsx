'use client'

import { api } from '@/lib/api-client'
import { VARIABLE_HELP } from '@/lib/segments'
import { CAMPAIGN_VARIABLES, renderCampaignText } from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
    body: 'Hace rato no te vemos, {{name}}. Pasa y encuentra un sello ya puesto en tu tarjeta.',
    offer: { kind: 'bonus_stamps' as const, amount: 1 },
    days: 14,
    segment: 'missing' as const,
    description: 'Para quienes llevan más de lo normal sin aparecer.',
  },
  {
    id: 'double_stamps',
    name: 'Sellos dobles',
    headline: 'Fin de semana de sellos dobles',
    body: 'Viernes, sábado y domingo cada visita cuenta por dos.',
    offer: { kind: 'multiplier' as const, factor: 2 },
    days: 3,
    description: 'Un empujón corto, sin regalar nada de tu margen.',
  },
  {
    id: 'spend_and_get',
    name: 'Gasta y gana',
    headline: 'Un sello extra en tu próxima visita',
    body: 'Llévate algo más y te ponemos un sello de más. Van {{stamps}} de tu tarjeta.',
    offer: { kind: 'bonus_stamps' as const, amount: 1 },
    days: 7,
    description: 'Sube el ticket medio sin tocar los precios.',
  },
  {
    id: 'new_offer',
    name: 'Novedad',
    headline: 'Algo nuevo en la carta',
    body: 'Estrenamos algo y queremos que lo pruebes tú primero, {{name}}.',
    offer: { kind: 'message_only' as const },
    days: 10,
    description: 'Cuenta una novedad sin regalar sellos.',
  },
  {
    id: 'vip_thanks',
    name: 'Gracias, habitual',
    headline: 'Esto es solo para los de siempre',
    body: 'Gracias por volver tanto, {{name}}. La próxima te invitamos nosotros.',
    offer: { kind: 'instant_reward' as const, title: 'Invitación de la casa' },
    days: 14,
    segment: 'regulars' as const,
    description: 'Un gesto para quienes sostienen el negocio.',
  },
  {
    id: 'last_chance',
    name: 'Última llamada',
    headline: 'Tu recompensa está por vencer',
    body: 'Te quedan {{remaining}} sellos. No dejes que se enfríe la tarjeta.',
    offer: { kind: 'message_only' as const },
    days: 5,
    segment: 'returning' as const,
    description: 'Empuja a quien va a medio camino y se está enfriando.',
  },
  {
    id: 'special_deal',
    name: 'Oferta puntual',
    headline: 'Solo hoy, a partir de las {{hour}}',
    body: 'Una oferta corta para quien pueda pasarse. Te esperamos en {{business}}.',
    offer: { kind: 'message_only' as const },
    days: 1,
    description: 'Para una ocasión suelta: un puente, una fecha, una sobra de stock.',
  },
]

export interface SegmentOption {
  id: string
  name: string
  count: number
}

export function CampaignComposer({
  cards,
  selectedCustomerIds,
  remainingThisMonth,
  suggested = [],
  segments = [],
}: {
  cards: Array<{ id: string; name: string }>
  /** A selection carried over from the customer list, if the business came from there. */
  selectedCustomerIds?: string[]
  remainingThisMonth: number | null
  /** Segments the business can aim the campaign at instead of the template's own. */
  suggested?: SegmentOption[]
  segments?: SegmentOption[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  /** `suggested:<key>` or `custom:<id>`; empty means the template decides. */
  const [target, setTarget] = useState('')
  const [audienceSize, setAudienceSize] = useState<number | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = TEMPLATES.find((item) => item.id === selected)
  const picked = selectedCustomerIds ?? []

  /**
   * Chosen people win over the template's segment: someone who ticked twelve customers
   * in the list means those twelve, not "everyone who looks like them".
   */
  /**
   * The preview resolves the placeholders with a plausible customer, so the business
   * reads the sentence a person will read instead of a row of braces.
   */
  const preview = useMemo(() => {
    const context = {
      name: 'María',
      business: 'tu negocio',
      stamps: 3,
      remaining: 2,
      hour: new Date().getHours(),
    }
    return {
      headline: renderCampaignText(template?.headline ?? '', context),
      body: renderCampaignText(template?.body ?? '', context),
    }
  }, [template])

  const usedVariables = useMemo(() => {
    const text = `${template?.headline ?? ''} ${template?.body ?? ''}`
    return CAMPAIGN_VARIABLES.filter((name) =>
      new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'i').test(text),
    )
  }, [template])

  const audience = useMemo(() => {
    const [kind, value] = target.split(':')
    return {
      segment: picked.length > 0 ? ('all' as const) : (template?.segment ?? 'all'),
      suggested: picked.length === 0 && kind === 'suggested' ? (value ?? null) : null,
      segmentId: picked.length === 0 && kind === 'custom' ? (value ?? null) : null,
      cardIds: cards.map((card) => card.id),
      customerIds: picked,
      consentOnly: true,
    }
  }, [cards, template, picked, target])

  // Show the reach before sending: "this goes to 214 people" is the number that
  // decides whether a campaign is worth launching.
  useEffect(() => {
    if (!template) {
      setAudienceSize(null)
      return
    }
    let cancelled = false
    api
      .post<{ size: number }>('/v1/campaigns/preview', audience)
      .then((response) => {
        if (!cancelled) setAudienceSize(response.size)
      })
      .catch(() => {
        if (!cancelled) setAudienceSize(null)
      })
    return () => {
      cancelled = true
    }
  }, [audience, template])

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
        audience,
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
      {picked.length > 0 ? (
        <p className="mb-4 rounded-[9px] bg-[var(--color-primary-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-primary)]">
          Esta campaña irá solo a los {picked.length} clientes que elegiste en la lista.
        </p>
      ) : null}

      {remainingThisMonth === 0 ? (
        <p className="mb-4 rounded-[9px] bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-warning)]">
          Ya usaste todas las campañas de este mes. El contador vuelve a cero el día 1.
        </p>
      ) : null}

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
            <p className="text-[15px] font-semibold">{preview.headline}</p>
            <p className="mt-1 text-[14px] leading-snug opacity-80">{preview.body}</p>
          </div>

          {usedVariables.length > 0 ? (
            <p className="mt-2 text-[13px] leading-snug text-[var(--color-ink-muted)]">
              Cada cliente verá lo suyo:{' '}
              {usedVariables.map((name) => VARIABLE_HELP[name] ?? name).join(', ')}.
            </p>
          ) : null}

          {picked.length === 0 && (suggested.length > 0 || segments.length > 0) ? (
            <label className="mt-3 flex flex-col gap-1.5 text-[13px] font-medium">
              ¿A quién?
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] font-normal focus:border-[var(--color-primary)] focus:outline-none"
              >
                <option value="">A quien propone la plantilla</option>
                {suggested.length > 0 ? (
                  <optgroup label="Sugeridos por Volvia">
                    {suggested.map((item) => (
                      <option key={item.id} value={`suggested:${item.id}`}>
                        {item.name} ({item.count})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {segments.length > 0 ? (
                  <optgroup label="Tus segmentos">
                    {segments.map((item) => (
                      <option key={item.id} value={`custom:${item.id}`}>
                        {item.name} ({item.count})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
          ) : null}

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
