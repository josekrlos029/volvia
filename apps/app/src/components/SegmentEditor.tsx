'use client'

import { api } from '@/lib/api-client'
import { BASE_SEGMENT_OPTIONS, FILTER_LABELS } from '@/lib/segments'
import type { SegmentDefinition, SegmentFilters } from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Panel, buttonClass } from './ui'

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] font-normal focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const NUMBER_FILTERS = [
  'lastVisitOlderThanDays',
  'lastVisitWithinDays',
  'joinedWithinDays',
  'minStamps',
  'maxStamps',
  'minRewards',
  'stampsToRewardMax',
] as const satisfies ReadonlyArray<keyof SegmentFilters>

const FLAG_FILTERS = [
  'hasConsent',
  'hasRedeemed',
  'hasPendingReward',
  'hasBirthday',
] as const satisfies ReadonlyArray<keyof SegmentFilters>

const DATE_FILTERS = [
  'joinedAfter',
  'joinedBefore',
  'lastVisitAfter',
  'lastVisitBefore',
] as const satisfies ReadonlyArray<keyof SegmentFilters>

/** Every filter as the text in its input; empty means "not set". */
type Draft = Record<keyof SegmentFilters, string>

const EMPTY: Draft = {
  hasConsent: '',
  minStamps: '',
  maxStamps: '',
  minRewards: '',
  joinedAfter: '',
  joinedBefore: '',
  lastVisitAfter: '',
  lastVisitBefore: '',
  birthdayMonth: '',
  hasBirthday: '',
  hasRedeemed: '',
  lastVisitWithinDays: '',
  lastVisitOlderThanDays: '',
  joinedWithinDays: '',
  stampsToRewardMax: '',
  hasPendingReward: '',
}

function toDraft(filters: SegmentFilters): Draft {
  const draft = { ...EMPTY }
  for (const key of Object.keys(EMPTY) as Array<keyof SegmentFilters>) {
    const value = filters[key]
    if (value === undefined || value === null) continue
    draft[key] = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  }
  return draft
}

/** The draft back into what the API accepts: typed values, nothing empty. */
function toFilters(draft: Draft): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  for (const key of NUMBER_FILTERS) if (draft[key] !== '') filters[key] = Number(draft[key])
  for (const key of FLAG_FILTERS) if (draft[key] !== '') filters[key] = draft[key] === 'true'
  for (const key of DATE_FILTERS) if (draft[key] !== '') filters[key] = draft[key]
  if (draft.birthdayMonth !== '') filters.birthdayMonth = Number(draft.birthdayMonth)
  return filters
}

/**
 * The segment editor: a base bucket, the filters on top, and a live count.
 *
 * The count is the whole point. A rule nobody matches, or one that matches everyone,
 * is a rule that needs another look, and the number says so before anything is saved.
 */
export function SegmentEditor({
  segmentId,
  initial,
}: {
  segmentId?: string
  initial?: { name: string; description: string | null; definition: SegmentDefinition }
}) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [base, setBase] = useState<string>(initial?.definition.base ?? 'all')
  const [draft, setDraft] = useState<Draft>(toDraft(initial?.definition.filters ?? {}))
  const [count, setCount] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const definition = useMemo(() => ({ base, filters: toFilters(draft) }), [base, draft])
  const definitionKey = JSON.stringify(definition)

  // Debounced: a number is typed digit by digit, and each digit need not hit the API.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .post<{ count: number }>('/v1/segments/preview', JSON.parse(definitionKey))
        .then((response) => {
          if (!cancelled) setCount(response.count)
        })
        .catch(() => {
          if (!cancelled) setCount(null)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [definitionKey])

  const set = (key: keyof SegmentFilters) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))

  async function save() {
    setStatus('saving')
    setError(null)
    const payload = { name, description: description.trim() || null, definition }
    try {
      if (segmentId) {
        await api.put(`/v1/segments/${segmentId}`, payload)
      } else {
        await api.post('/v1/segments', payload)
      }
      router.push('/segments')
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.code === 'CONFLICT'
            ? 'Ya tienes un segmento con ese nombre.'
            : caught.isPlanLimit
              ? 'Los segmentos propios llegan con el plan Negocio.'
              : caught.message
          : 'No pudimos guardar el segmento.',
      )
      setStatus('idle')
    }
  }

  async function remove() {
    if (!segmentId) return
    setStatus('deleting')
    setError(null)
    try {
      await api.delete(`/v1/segments/${segmentId}`)
      router.push('/segments')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos borrar el segmento.')
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Nombre">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Nombre
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="Fríos con sellos"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Para qué sirve
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={200}
              placeholder="Opcional: una línea para acordarte"
              className={field}
            />
          </label>
        </div>
      </Panel>

      <Panel title="Punto de partida">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {BASE_SEGMENT_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setBase(option.id)}
                aria-pressed={base === option.id}
                className={[
                  'h-full w-full rounded-[10px] border p-3 text-left transition-colors',
                  base === option.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]',
                ].join(' ')}
              >
                <p className="text-[14px] font-semibold">{option.label}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-ink-muted)]">
                  {option.help}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Filtros">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBER_FILTERS.map((key) => (
            <label key={key} className="flex flex-col gap-1.5 text-[13px] font-medium">
              {FILTER_LABELS[key]}
              <input
                type="number"
                min={key === 'stampsToRewardMax' ? 1 : 0}
                value={draft[key]}
                onChange={(event) => set(key)(event.target.value)}
                placeholder="Sin filtro"
                className={field}
              />
            </label>
          ))}

          {FLAG_FILTERS.map((key) => (
            <label key={key} className="flex flex-col gap-1.5 text-[13px] font-medium">
              {FILTER_LABELS[key]}
              <select
                value={draft[key]}
                onChange={(event) => set(key)(event.target.value)}
                className={field}
              >
                <option value="">Da igual</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
          ))}

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            {FILTER_LABELS.birthdayMonth}
            <select
              value={draft.birthdayMonth}
              onChange={(event) => set('birthdayMonth')(event.target.value)}
              className={field}
            >
              <option value="">Cualquier mes</option>
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </label>

          {DATE_FILTERS.map((key) => (
            <label key={key} className="flex flex-col gap-1.5 text-[13px] font-medium">
              {FILTER_LABELS[key]}
              <input
                type="date"
                value={draft[key]}
                onChange={(event) => set(key)(event.target.value)}
                className={field}
              />
            </label>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <p className="tabular text-[14px] text-[var(--color-ink-muted)]" aria-live="polite">
          {count === null
            ? 'Contando'
            : `${count} ${count === 1 ? 'cliente encaja' : 'clientes encajan'} hoy`}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {segmentId ? (
            confirmDelete ? (
              <>
                <span className="text-[13px] text-[var(--color-ink-muted)]">
                  ¿Borrar de verdad?
                </span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={status !== 'idle'}
                  className={buttonClass('danger', 'sm')}
                >
                  {status === 'deleting' ? 'Borrando' : 'Sí, borrar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className={buttonClass('ghost', 'sm')}
                >
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={buttonClass('ghost', 'sm')}
              >
                Borrar
              </button>
            )
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={status !== 'idle' || name.trim().length < 2}
            className={buttonClass('primary')}
          >
            {status === 'saving' ? 'Guardando' : segmentId ? 'Guardar cambios' : 'Guardar segmento'}
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
