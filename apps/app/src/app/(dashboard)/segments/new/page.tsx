import { SegmentEditor } from '@/components/SegmentEditor'
import { EmptyState, Panel } from '@/components/ui'
import { apiFetch } from '@/lib/session'
import { SUGGESTED_SEGMENTS, type SuggestedSegmentKey } from '@volvia/shared'

export default async function NewSegmentPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const org = await apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org')
  if (!org.entitlements.features.custom_segments) {
    return (
      <Panel>
        <EmptyState
          title="Los segmentos propios llegan con el plan Negocio"
          body="Mientras tanto puedes usar los segmentos sugeridos tal cual: ya cuentan a tus clientes y sirven para campañas y mensajes."
        />
      </Panel>
    )
  }

  const { from } = await searchParams
  const seed = from ? SUGGESTED_SEGMENTS[from as SuggestedSegmentKey] : undefined

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Nuevo segmento</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Un punto de partida y los filtros que lo afinan. El conteo se actualiza mientras escribes.
        </p>
      </header>
      <SegmentEditor
        initial={
          seed
            ? { name: seed.name, description: seed.description, definition: seed.definition }
            : undefined
        }
      />
    </div>
  )
}
