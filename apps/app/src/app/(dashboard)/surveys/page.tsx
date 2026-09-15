import { EmptyState, Metric, Panel } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { apiFetch } from '@/lib/session'

interface Survey {
  id: string
  name: string
  trigger: string
  isActive: boolean
  routeToReviewFromRating: number | null
  questions: Array<{ type: string; prompt: string }>
  responses: number
  averageRating: number | null
}

const TRIGGERS: Record<string, string> = {
  after_reward: 'Después de canjear una recompensa',
  after_join: 'Al unirse a la tarjeta',
  after_nth_stamp: 'Al llegar a cierto sello',
  manual: 'Solo cuando la envías',
}

export default async function SurveysPage() {
  const org = await apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org')

  if (!org.entitlements.features.surveys) {
    return (
      <Panel>
        <EmptyState
          title="Las encuestas llegan con el plan Negocio"
          body="Pregunta justo después de una buena experiencia, y manda a los clientes contentos a dejarte una reseña en Google."
        />
      </Panel>
    )
  }

  const surveys = await apiFetch<Survey[]>('/v1/surveys')
  const totalResponses = surveys.reduce((sum, survey) => sum + survey.responses, 0)
  const rated = surveys.filter((survey) => survey.averageRating !== null)
  const overallRating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((sum, s) => sum + (s.averageRating ?? 0), 0) / rated.length) * 10,
        ) / 10
      : null

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Encuestas</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Una pregunta corta en el mejor momento vale más que un formulario largo.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Respuestas" value={formatNumber(totalResponses)} />
        <Metric
          label="Calificación media"
          value={overallRating === null ? 'Sin datos' : `${overallRating} de 5`}
        />
      </div>

      {surveys.length === 0 ? (
        <Panel>
          <EmptyState
            title="Todavía sin encuestas"
            body="Crea una que se dispare al canjear una recompensa: es cuando el cliente está más contento."
          />
        </Panel>
      ) : (
        <Panel title="Tus encuestas">
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {surveys.map((survey) => (
              <li key={survey.id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{survey.name}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
                      {TRIGGERS[survey.trigger] ?? survey.trigger}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-[13px] text-[var(--color-ink-muted)]">
                    {formatNumber(survey.responses)} respuestas
                  </span>
                </div>

                {survey.routeToReviewFromRating ? (
                  <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
                    A quienes califican {survey.routeToReviewFromRating} o más les proponemos dejar
                    una reseña en Google. El resto va a comentarios privados.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
