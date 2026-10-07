import { formatNumber } from '@/lib/format'
import { COMMUNITY_LABELS, FREQUENCY_LABELS } from '@/lib/segments'
import { COMMUNITY_SEGMENTS, type VisitFrequency } from '@volvia/shared'
import Link from 'next/link'

/**
 * The community, in five numbers.
 *
 * Reads left to right from healthiest to furthest gone, so the shape of the bar is the
 * answer: a business with a wide "se alejan" block has a retention problem it can act
 * on today, which is more useful than a single churn percentage.
 */
export function CommunityHealth({
  counts,
  total,
  frequency,
  active,
  query,
}: {
  counts: Record<string, number>
  total: number
  frequency: VisitFrequency
  active: string
  query: URLSearchParams
}) {
  if (total === 0) return null

  const href = (segment: string) => {
    const next = new URLSearchParams(query)
    next.set('segment', segment)
    next.delete('page')
    return `/customers?${next}`
  }

  return (
    <section
      aria-labelledby="community-heading"
      className="rounded-[12px] border border-[var(--color-line)] bg-white p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="community-heading" className="text-[14px] font-semibold">
          Tu comunidad
        </h2>
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          Contando que un buen cliente vuelve {FREQUENCY_LABELS[frequency]}.{' '}
          <Link href="/settings" className="underline underline-offset-2">
            Cambiar
          </Link>
        </p>
      </header>

      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {COMMUNITY_SEGMENTS.map((segment) => {
          const value = counts[segment] ?? 0
          const share = total > 0 ? Math.round((value / total) * 100) : 0
          const isActive = active === segment
          const meta = COMMUNITY_LABELS[segment]

          return (
            <Link
              key={segment}
              href={href(segment)}
              aria-current={isActive ? 'page' : undefined}
              title={meta.help}
              className={[
                'rounded-[10px] border p-3 transition-colors',
                isActive
                  ? 'border-[var(--color-ink)] bg-[var(--color-surface-muted)]'
                  : 'border-[var(--color-line)] hover:bg-[var(--color-surface-muted)]',
              ].join(' ')}
            >
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${meta.tone}`}
              >
                {meta.label}
              </span>
              <p className="tabular mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]">
                {formatNumber(value)}
              </p>
              <p className="tabular mt-1 text-[12px] text-[var(--color-ink-muted)]">{share}%</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
