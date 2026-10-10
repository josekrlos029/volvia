import { CommunityHealth } from '@/components/CommunityHealth'
import { CustomerFilters } from '@/components/CustomerFilters'
import { type CustomerRow, CustomerSelection } from '@/components/CustomerSelection'
import { EmptyState, Panel, buttonClass } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { COMMUNITY_LABELS, EXTRA_SEGMENT_LABELS, segmentLabel } from '@/lib/segments'
import { apiFetch } from '@/lib/session'
import { COMMUNITY_SEGMENTS, SUGGESTED_SEGMENT_LIST, type VisitFrequency } from '@volvia/shared'
import Link from 'next/link'

interface SegmentList {
  segments: Array<{ id: string; name: string; count: number }>
  suggested: Array<{ key: string; name: string; label?: string; count: number }>
}

function chipClass(current: boolean): string {
  return [
    'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
    current
      ? 'bg-[var(--color-ink)] text-white'
      : 'border border-[var(--color-line)] bg-white text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]',
  ].join(' ')
}

interface CustomerPage {
  items: CustomerRow[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  masked: boolean
}

interface SegmentCounts {
  total: number
  frequency: VisitFrequency
  segments: Record<string, number>
}

/** Query keys that come from the filter form rather than from navigation. */
const FILTER_KEYS = [
  'search',
  'cardId',
  'hasConsent',
  'minStamps',
  'maxStamps',
  'minRewards',
  'joinedAfter',
  'joinedBefore',
  'lastVisitAfter',
  'lastVisitBefore',
  'birthdayMonth',
  'hasBirthday',
  'hasRedeemed',
  'sortBy',
] as const

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single) values[key] = single
  }

  const segment = values.segment ?? 'all'
  // A saved or suggested segment replaces the bucket as the base of the list.
  const segmentId = values.segmentId
  const suggested = SUGGESTED_SEGMENT_LIST.some((item) => item.key === values.suggested)
    ? values.suggested
    : undefined
  const page = Math.max(1, Number(values.page ?? 1) || 1)

  // The filter query, without the parts that are navigation rather than filtering.
  const filters = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    if (values[key]) filters.set(key, values[key])
  }
  const activeCount = [...filters.keys()].filter((key) => key !== 'sortBy').length

  const scope = new URLSearchParams(filters)
  if (segmentId) scope.set('segmentId', segmentId)
  if (suggested) scope.set('suggested', suggested)

  const listQuery = new URLSearchParams(scope)
  listQuery.set('segment', segment)
  listQuery.set('page', String(page))
  listQuery.set('pageSize', '25')

  const [customers, counts, org, cards, segmentList] = await Promise.all([
    apiFetch<CustomerPage>(`/v1/customers?${listQuery}`),
    apiFetch<SegmentCounts>(`/v1/customers/segments?${scope}`),
    apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org'),
    apiFetch<Array<{ id: string; name: string }>>('/v1/cards'),
    apiFetch<SegmentList>('/v1/segments'),
  ])

  const canExport = org.entitlements.features.csv_export ?? false
  const canMessage = org.entitlements.features.customer_messages ?? false
  const activeSaved = segmentId
    ? segmentList.segments.find((item) => item.id === segmentId)
    : undefined
  const activeSuggested = suggested
    ? segmentList.suggested.find((item) => item.key === suggested)
    : undefined
  const scopeLabel = activeSaved?.name ?? activeSuggested?.name ?? segmentLabel(segment)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

  const pageLink = (target: number) => {
    const next = new URLSearchParams(listQuery)
    next.set('page', String(target))
    return `/customers?${next}`
  }

  const chips = [
    { id: 'all', label: EXTRA_SEGMENT_LABELS.all },
    ...COMMUNITY_SEGMENTS.map((id) => ({ id, label: COMMUNITY_LABELS[id].label })),
    { id: 'birthday_month', label: EXTRA_SEGMENT_LABELS.birthday_month },
    { id: 'never_visited', label: EXTRA_SEGMENT_LABELS.never_visited },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Clientes</h1>
          <p className="tabular mt-1 text-[14px] text-[var(--color-ink-muted)]">
            {formatNumber(customers.total)}{' '}
            {segment === 'all' && activeCount === 0 && !activeSaved && !activeSuggested
              ? 'en total'
              : `en ${scopeLabel.toLowerCase()}`}
          </p>
        </div>
        {canExport ? (
          <a
            href={`${apiUrl}/v1/customers/export.csv?${listQuery}`}
            className={buttonClass('secondary', 'sm')}
          >
            Exportar CSV
          </a>
        ) : null}
      </header>

      <CommunityHealth
        counts={counts.segments}
        total={counts.total}
        frequency={counts.frequency}
        active={segment}
        query={scope}
      />

      <nav aria-label="Segmentos" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {chips.map((item) => {
          const href = new URLSearchParams(filters)
          href.set('segment', item.id)
          const current = !activeSaved && !activeSuggested && segment === item.id
          return (
            <Link
              key={item.id}
              href={`/customers?${href}`}
              aria-current={current ? 'page' : undefined}
              className={chipClass(current)}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {segmentList.suggested.length > 0 || segmentList.segments.length > 0 ? (
        <nav aria-label="Segmentos guardados" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {segmentList.suggested.map((item) => {
            const href = new URLSearchParams(filters)
            href.set('suggested', item.key)
            const current = suggested === item.key
            return (
              <Link
                key={item.key}
                href={`/customers?${href}`}
                aria-current={current ? 'page' : undefined}
                className={chipClass(current)}
              >
                {item.label ?? item.name}
                <span className="tabular ml-1.5 opacity-70">{formatNumber(item.count)}</span>
              </Link>
            )
          })}
          {segmentList.segments.map((item) => {
            const href = new URLSearchParams(filters)
            href.set('segmentId', item.id)
            const current = segmentId === item.id
            return (
              <Link
                key={item.id}
                href={`/customers?${href}`}
                aria-current={current ? 'page' : undefined}
                className={chipClass(current)}
              >
                {item.name}
                <span className="tabular ml-1.5 opacity-70">{formatNumber(item.count)}</span>
              </Link>
            )
          })}
          <Link href="/segments" className={chipClass(false)}>
            Gestionar segmentos
          </Link>
        </nav>
      ) : null}

      <CustomerFilters
        values={{
          ...values,
          segment,
          ...(segmentId ? { segmentId } : {}),
          ...(suggested ? { suggested } : {}),
        }}
        cards={cards}
        activeCount={activeCount}
      />

      {customers.masked ? (
        <p className="rounded-[9px] bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-warning)]">
          Los correos se muestran ocultos en el plan Gratis. Con el plan Pro ves los datos
          completos.
        </p>
      ) : null}

      {customers.items.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nadie encaja con esta búsqueda"
            body="Prueba con otro segmento o quita algún filtro. Si aún no tienes clientes, comparte el QR de tu tarjeta para que empiecen a unirse."
            action={
              activeCount > 0 ? (
                <Link
                  href={`/customers?${new URLSearchParams({ segment, ...(segmentId ? { segmentId } : {}), ...(suggested ? { suggested } : {}) })}`}
                  className={buttonClass('secondary')}
                >
                  Quitar filtros
                </Link>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <>
          <CustomerSelection
            rows={customers.items}
            apiUrl={apiUrl}
            canExport={canExport}
            canMessage={canMessage}
          />

          {customers.total > customers.pageSize ? (
            <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
              <Link
                href={pageLink(page - 1)}
                aria-disabled={page <= 1}
                className={`${buttonClass('secondary', 'sm')} ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
              >
                Anterior
              </Link>
              <span className="tabular text-[13px] text-[var(--color-ink-muted)]">
                Página {page} de {Math.ceil(customers.total / customers.pageSize)}
              </span>
              <Link
                href={pageLink(page + 1)}
                aria-disabled={!customers.hasMore}
                className={`${buttonClass('secondary', 'sm')} ${!customers.hasMore ? 'pointer-events-none opacity-50' : ''}`}
              >
                Siguiente
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}
