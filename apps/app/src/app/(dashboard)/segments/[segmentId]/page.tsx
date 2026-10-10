import { SegmentEditor } from '@/components/SegmentEditor'
import { EmptyState, Panel } from '@/components/ui'
import { apiFetch } from '@/lib/session'
import type { SegmentDefinition } from '@volvia/shared'

interface Segment {
  id: string
  name: string
  description: string | null
  definition: SegmentDefinition
  count: number
}

export default async function EditSegmentPage({
  params,
}: {
  params: Promise<{ segmentId: string }>
}) {
  const org = await apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org')
  if (!org.entitlements.features.custom_segments) {
    return (
      <Panel>
        <EmptyState
          title="Los segmentos propios llegan con el plan Negocio"
          body="Este segmento sigue guardado; con el plan Negocio vuelves a poder editarlo."
        />
      </Panel>
    )
  }

  const { segmentId } = await params
  const segment = await apiFetch<Segment>(`/v1/segments/${segmentId}`)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{segment.name}</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Cambia la regla y el conteo se actualiza. Las campañas y mensajes ya programados usan la
          regla tal como esté al momento de salir.
        </p>
      </header>
      <SegmentEditor
        segmentId={segment.id}
        initial={{
          name: segment.name,
          description: segment.description ?? '',
          definition: segment.definition,
        }}
      />
    </div>
  )
}
