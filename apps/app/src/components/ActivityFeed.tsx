import { formatRelative } from '@/lib/format'
import Link from 'next/link'
import { EmptyState } from './ui'

export interface ActivityItem {
  kind: 'stamp' | 'join' | 'reward'
  customerId: string
  firstName: string
  at: string
  count: number
}

const VERB: Record<ActivityItem['kind'], (item: ActivityItem) => string> = {
  stamp: (item) => (item.count > 1 ? `sumó ${item.count} sellos` : 'sumó un sello'),
  join: () => 'se unió a tu tarjeta',
  reward: () => 'canjeó una recompensa',
}

/** The last few things that happened, in the words a person would use. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Todavía sin movimiento"
        body="Cuando alguien se una o sumes el primer sello, lo verás aquí."
      />
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--color-line)]">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.customerId}-${item.at}`}
          className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <p className="min-w-0 text-[14px]">
            <Link href={`/customers/${item.customerId}`} className="font-medium">
              {item.firstName}
            </Link>{' '}
            <span className="text-[var(--color-ink-muted)]">{VERB[item.kind](item)}</span>
          </p>
          <span className="shrink-0 text-[13px] text-[var(--color-ink-muted)]">
            {formatRelative(item.at)}
          </span>
        </li>
      ))}
    </ul>
  )
}
