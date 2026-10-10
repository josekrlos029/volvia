import { MessageComposer } from '@/components/MessageComposer'
import { EmptyState, Panel } from '@/components/ui'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface SegmentList {
  segments: Array<{ id: string; name: string; count: number }>
  suggested: Array<{ key: string; name: string; count: number }>
}

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ suggested?: string; segmentId?: string; customers?: string }>
}) {
  const org = await apiFetch<{
    timezone: string
    settings: { notificationHours: { from: string; to: string } | null }
    entitlements: { features: Record<string, boolean> }
  }>('/v1/org')
  if (!org.entitlements.features.customer_messages) {
    return (
      <Panel>
        <EmptyState
          title="Los mensajes llegan con el plan Negocio"
          body="Un aviso corto en el teléfono de quienes llevan tu tarjeta en la wallet."
        />
      </Panel>
    )
  }

  const [segmentList, list, query] = await Promise.all([
    apiFetch<SegmentList>('/v1/segments'),
    apiFetch<{ thisMonth: { used: number; limit: number | null } }>('/v1/messages'),
    searchParams,
  ])
  const { used, limit } = list.thisMonth
  const picked = query.customers
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/messages"
          className="text-[13px] text-[var(--color-ink-muted)] underline underline-offset-2"
        >
          Mensajes
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Nuevo mensaje</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Elige a quién, escribe poco, y mira a cuántos les llega antes de enviar.
        </p>
      </header>
      <MessageComposer
        suggested={segmentList.suggested}
        segments={segmentList.segments}
        initialSuggested={query.suggested}
        initialSegmentId={query.segmentId}
        selectedCustomerIds={picked}
        remainingThisMonth={limit === null ? null : Math.max(0, limit - used)}
        timezone={org.timezone}
        notificationHours={org.settings.notificationHours}
      />
    </div>
  )
}
