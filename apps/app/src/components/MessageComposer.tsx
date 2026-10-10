'use client'

import { api } from '@/lib/api-client'
import { COMMUNITY_LABELS, EXTRA_SEGMENT_LABELS, VARIABLE_HELP } from '@/lib/segments'
import {
  CAMPAIGN_VARIABLES,
  CUSTOMER_SEGMENTS,
  GENERIC_MESSAGE_TEMPLATES,
  SUGGESTED_SEGMENTS,
  type SuggestedSegmentKey,
  renderCampaignText,
} from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Panel, buttonClass } from './ui'

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] font-normal focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

type Mode = 'suggested' | 'custom' | 'community' | 'picked'

interface Reach {
  size: number
  withWallet: number
  applePasses: number
  googlePasses: number
}

/** The audience as the API reads it. */
interface Audience {
  segment: string
  suggested: string | null
  segmentId: string | null
  cardIds: string[]
  customerIds: string[]
  consentOnly: true
}

function segmentName(id: string): string {
  return (
    COMMUNITY_LABELS[id as keyof typeof COMMUNITY_LABELS]?.label ?? EXTRA_SEGMENT_LABELS[id] ?? id
  )
}

/**
 * The message composer: who, what, when.
 *
 * The reach line is the one thing that must never lie. It is the same count the
 * worker will resolve when the message leaves, split by who actually carries the pass,
 * because a push to someone without the pass is a push to nobody.
 */
export function MessageComposer({
  suggested,
  segments,
  initialSuggested,
  initialSegmentId,
  selectedCustomerIds,
  remainingThisMonth,
}: {
  suggested: Array<{ key: string; name: string; count: number }>
  segments: Array<{ id: string; name: string; count: number }>
  initialSuggested?: string
  initialSegmentId?: string
  selectedCustomerIds?: string[]
  remainingThisMonth: number | null
}) {
  const router = useRouter()
  const picked = selectedCustomerIds ?? []

  const [mode, setMode] = useState<Mode>(
    picked.length > 0
      ? 'picked'
      : initialSegmentId
        ? 'custom'
        : initialSuggested
          ? 'suggested'
          : 'suggested',
  )
  const [suggestedKey, setSuggestedKey] = useState(initialSuggested ?? suggested[0]?.key ?? 'cold')
  const [segmentId, setSegmentId] = useState(initialSegmentId ?? segments[0]?.id ?? '')
  const [community, setCommunity] = useState<string>('all')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [reach, setReach] = useState<Reach | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audience = useMemo<Audience>(
    () => ({
      segment: mode === 'community' ? community : 'all',
      suggested: mode === 'suggested' ? suggestedKey : null,
      segmentId: mode === 'custom' && segmentId ? segmentId : null,
      cardIds: [],
      customerIds: mode === 'picked' ? picked : [],
      consentOnly: true,
    }),
    [mode, community, suggestedKey, segmentId, picked],
  )
  const audienceKey = JSON.stringify(audience)

  useEffect(() => {
    let cancelled = false
    setReach(null)
    api
      .post<Reach>('/v1/messages/preview', JSON.parse(audienceKey))
      .then((response) => {
        if (!cancelled) setReach(response)
      })
      .catch(() => {
        if (!cancelled) setReach(null)
      })
    return () => {
      cancelled = true
    }
  }, [audienceKey])

  const templates = useMemo(() => {
    const own =
      mode === 'suggested'
        ? (SUGGESTED_SEGMENTS[suggestedKey as SuggestedSegmentKey]?.messageTemplates ?? [])
        : []
    return [...own, ...GENERIC_MESSAGE_TEMPLATES]
  }, [mode, suggestedKey])

  const preview = useMemo(() => {
    const context = {
      name: 'María',
      business: 'tu negocio',
      stamps: 3,
      remaining: 2,
      hour: new Date().getHours(),
    }
    return {
      headline: renderCampaignText(headline, context),
      body: renderCampaignText(body, context),
    }
  }, [headline, body])

  const usedVariables = useMemo(() => {
    const text = `${headline} ${body}`
    return CAMPAIGN_VARIABLES.filter((name) =>
      new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'i').test(text),
    )
  }, [headline, body])

  const canSend =
    headline.trim().length >= 2 &&
    body.trim().length >= 2 &&
    (when === 'now' || scheduledAt !== '') &&
    (reach?.size ?? 0) > 0 &&
    remainingThisMonth !== 0

  async function send() {
    setWorking(true)
    setError(null)
    try {
      const created = await api.post<{ id: string }>('/v1/messages', {
        headline: headline.trim(),
        body: body.trim(),
        audience,
        scheduledAt: null,
      })
      await api.post(`/v1/messages/${created.id}/send`, {
        scheduledAt: when === 'later' ? new Date(scheduledAt).toISOString() : null,
      })
      router.push('/messages')
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.isPlanLimit
            ? 'Llegaste al máximo de mensajes de este mes.'
            : caught.message
          : 'No pudimos enviar el mensaje.',
      )
      setWorking(false)
    }
  }

  const modes: Array<{ id: Mode; label: string }> = [
    ...(picked.length > 0 ? [{ id: 'picked' as const, label: 'Clientes elegidos' }] : []),
    { id: 'suggested', label: 'Segmento sugerido' },
    ...(segments.length > 0 ? [{ id: 'custom' as const, label: 'Tu segmento' }] : []),
    { id: 'community', label: 'Comunidad' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {remainingThisMonth === 0 ? (
        <p className="rounded-[9px] bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-warning)]">
          Ya usaste todos los mensajes de este mes. El contador vuelve a cero el día 1.
        </p>
      ) : null}

      <Panel title="¿A quién?">
        {picked.length > 0 ? (
          <p className="mb-3 rounded-[9px] bg-[var(--color-primary-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-primary)]">
            Este mensaje irá solo a los {picked.length} clientes que elegiste en la lista.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5" aria-label="Tipo de audiencia">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
              className={[
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                mode === item.id
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'border border-[var(--color-line)] bg-white text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'suggested' ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {suggested.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setSuggestedKey(item.key)}
                  aria-pressed={suggestedKey === item.key}
                  className={[
                    'flex h-full w-full items-start justify-between gap-2 rounded-[10px] border p-3 text-left transition-colors',
                    suggestedKey === item.key
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]',
                  ].join(' ')}
                >
                  <span className="text-[14px] font-semibold">{item.name}</span>
                  <span className="tabular text-[12px] text-[var(--color-ink-muted)]">
                    {item.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {mode === 'custom' ? (
          <label className="mt-3 flex flex-col gap-1.5 text-[13px] font-medium">
            Segmento
            <select
              value={segmentId}
              onChange={(event) => setSegmentId(event.target.value)}
              className={field}
            >
              {segments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === 'community' ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CUSTOMER_SEGMENTS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setCommunity(id)}
                aria-pressed={community === id}
                className={[
                  'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                  community === id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-line)] bg-white text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]',
                ].join(' ')}
              >
                {segmentName(id)}
              </button>
            ))}
          </div>
        ) : null}

        <p className="tabular mt-3 text-[14px] text-[var(--color-ink-muted)]" aria-live="polite">
          {reach === null
            ? 'Calculando a cuántas personas llega'
            : reach.size === 0
              ? 'Nadie encaja ahora mismo, o nadie de este grupo aceptó promociones.'
              : `Llega a ${reach.size} ${reach.size === 1 ? 'cliente' : 'clientes'}, ${reach.withWallet} con la tarjeta en el móvil.`}
        </p>
        {reach !== null && reach.size > 0 && reach.withWallet === 0 ? (
          <p className="mt-1 text-[13px] text-[var(--color-warning)]">
            Nadie de este grupo tiene la tarjeta en el móvil todavía: el mensaje quedará en su
            tarjeta, pero no les sonará el teléfono.
          </p>
        ) : null}
      </Panel>

      <Panel title="¿Qué les dices?">
        <div className="flex flex-wrap gap-1.5">
          {templates.map((template) => (
            <button
              key={template.headline}
              type="button"
              onClick={() => {
                setHeadline(template.headline)
                setBody(template.body)
              }}
              className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"
            >
              {template.headline}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            <span className="flex justify-between">
              Título
              <span className="tabular font-normal text-[var(--color-ink-muted)]">
                {headline.length}/60
              </span>
            </span>
            <input
              value={headline}
              onChange={(event) => setHeadline(event.target.value.slice(0, 60))}
              placeholder="Te extrañamos, {{name}}"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            <span className="flex justify-between">
              Mensaje
              <span className="tabular font-normal text-[var(--color-ink-muted)]">
                {body.length}/240
              </span>
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 240))}
              rows={3}
              placeholder="Hace rato no te vemos por {{business}}. Pásate esta semana."
              className={field}
            />
          </label>
        </div>

        <p className="mt-2 text-[13px] leading-snug text-[var(--color-ink-muted)]">
          Puedes escribir {CAMPAIGN_VARIABLES.map((name) => `{{${name}}}`).join(', ')} y cada
          cliente verá lo suyo
          {usedVariables.length > 0
            ? `: ${usedVariables.map((name) => VARIABLE_HELP[name] ?? name).join(', ')}`
            : ''}
          .
        </p>

        {headline || body ? (
          <div className="mt-4 rounded-[10px] border border-[var(--color-line)] p-4">
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Así lo verá tu cliente
            </p>
            <div className="mt-2.5 rounded-[9px] bg-[var(--color-ink)] p-3.5 text-white">
              <p className="text-[15px] font-semibold">{preview.headline || 'Título'}</p>
              <p className="mt-1 text-[14px] leading-snug opacity-80">
                {preview.body || 'Mensaje'}
              </p>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="¿Cuándo?">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="radio"
              name="when"
              checked={when === 'now'}
              onChange={() => setWhen('now')}
              className="accent-[var(--color-primary)]"
            />
            Ahora
          </label>
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="radio"
              name="when"
              checked={when === 'later'}
              onChange={() => setWhen('later')}
              className="accent-[var(--color-primary)]"
            />
            Programar
          </label>
          {when === 'later' ? (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
              aria-label="Fecha y hora de envío"
              className={`${field} max-w-[260px]`}
            />
          ) : null}
        </div>
      </Panel>

      {error ? (
        <p
          role="alert"
          className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={send}
          disabled={working || !canSend}
          className={buttonClass('primary')}
        >
          {working ? 'Enviando' : when === 'later' ? 'Programar envío' : 'Enviar ahora'}
        </button>
      </div>
    </div>
  )
}
