import { EmptyState, Panel, PlanLock, buttonClass } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface SegmentList {
  segments: Array<{
    id: string
    name: string
    description: string | null
    count: number
  }>
  suggested: Array<{ key: string; name: string; description: string; count: number }>
  canCreate: boolean
}

export default async function SegmentsPage() {
  const [list, org] = await Promise.all([
    apiFetch<SegmentList>('/v1/segments'),
    apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org'),
  ])
  const canMessage = org.entitlements.features.customer_messages ?? false

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Segmentos</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Grupos de clientes a los que vale la pena hablarles distinto. Se calculan al momento,
            así que nunca se quedan viejos.
          </p>
        </div>
        {list.canCreate ? (
          <Link href="/segments/new" className={buttonClass('primary', 'sm')}>
            Nuevo segmento
          </Link>
        ) : null}
      </header>

      <Panel title="Sugeridos por Volvia">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {list.suggested.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-2 rounded-[10px] border border-[var(--color-line)] p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-semibold">{item.name}</p>
                <span className="tabular shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--color-ink-muted)]">
                  {formatNumber(item.count)}
                </span>
              </div>
              <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
                {item.description}
              </p>
              <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[13px] font-medium">
                <Link
                  href={`/customers?suggested=${item.key}`}
                  className="underline underline-offset-2"
                >
                  Ver clientes
                </Link>
                {canMessage ? (
                  <Link
                    href={`/messages/new?suggested=${item.key}`}
                    className="underline underline-offset-2"
                  >
                    Enviar mensaje
                  </Link>
                ) : null}
                {list.canCreate ? (
                  <Link
                    href={`/segments/new?from=${item.key}`}
                    className="text-[var(--color-ink-muted)] underline underline-offset-2"
                  >
                    Guardar como propio
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Tus segmentos">
        {!list.canCreate ? (
          <div className="flex flex-col gap-4">
            <PlanLock feature="Guardar segmentos propios" upgradeTo="Negocio" />
            <p className="text-[14px] text-[var(--color-ink-muted)]">
              Con el plan Negocio puedes partir de un segmento sugerido, afinarlo con tus propios
              filtros y guardarlo con nombre para usarlo en campañas y mensajes.
            </p>
          </div>
        ) : list.segments.length === 0 ? (
          <EmptyState
            title="Todavía no tienes segmentos propios"
            body="Empieza desde uno sugerido y afínalo, o crea uno desde cero con los filtros que te importan."
            action={
              <Link href="/segments/new" className={buttonClass('secondary')}>
                Crear el primero
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {list.segments.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{item.name}</p>
                  {item.description ? (
                    <p className="mt-0.5 truncate text-[13px] text-[var(--color-ink-muted)]">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <span className="tabular text-[13px] text-[var(--color-ink-muted)]">
                  {formatNumber(item.count)} {item.count === 1 ? 'cliente' : 'clientes'}
                </span>
                <div className="flex flex-wrap gap-x-3 text-[13px] font-medium">
                  <Link
                    href={`/customers?segmentId=${item.id}`}
                    className="underline underline-offset-2"
                  >
                    Ver clientes
                  </Link>
                  {canMessage ? (
                    <Link
                      href={`/messages/new?segmentId=${item.id}`}
                      className="underline underline-offset-2"
                    >
                      Enviar mensaje
                    </Link>
                  ) : null}
                  <Link href={`/segments/${item.id}`} className="underline underline-offset-2">
                    Editar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
