import { ReviewPauseToggle } from '@/components/ReviewSettings'
import { EmptyState, Metric, Panel, buttonClass } from '@/components/ui'
import { formatNumber, formatPercent } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface ReviewStats {
  connected: boolean
  paused: boolean
  shown: number
  opened: number
  shownLast30: number
  openedLast30: number
}

export default async function ReviewsPage() {
  const [stats, surveys] = await Promise.all([
    apiFetch<ReviewStats>('/v1/reviews'),
    apiFetch<Array<{ id: string; name: string; routeToReviewFromRating: number | null }>>(
      '/v1/surveys',
    ),
  ])

  const rate = (opened: number, shown: number) => (shown === 0 ? null : (opened / shown) * 100)
  const routed = surveys.filter((survey) => survey.routeToReviewFromRating !== null)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Reseñas de Google</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          A un cliente que acaba de decirte que le fue bien, le ofrecemos dejar una reseña. A quien
          te dijo que algo falló, nunca.
        </p>
      </header>

      {!stats.connected ? (
        <Panel>
          <EmptyState
            title="Conecta tu ficha de Google"
            body="Con el identificador de tu ficha podemos llevar a tus clientes contentos directo a escribir la reseña. Sin eso, no se le pide a nadie."
            action={
              <Link href="/settings" className={buttonClass('primary')}>
                Ir a ajustes
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Veces que se pidió" value={formatNumber(stats.shown)} />
            <Metric
              label="Fueron a Google"
              value={formatNumber(stats.opened)}
              hint={
                rate(stats.opened, stats.shown) === null
                  ? 'Sin datos todavía'
                  : `${formatPercent(rate(stats.opened, stats.shown))} de las veces`
              }
            />
            <Metric label="Pedidas en 30 días" value={formatNumber(stats.shownLast30)} />
            <Metric
              label="Abiertas en 30 días"
              value={formatNumber(stats.openedLast30)}
              hint={
                rate(stats.openedLast30, stats.shownLast30) === null
                  ? 'Sin datos todavía'
                  : formatPercent(rate(stats.openedLast30, stats.shownLast30))
              }
            />
          </div>

          <Panel title="Cuándo se pide">
            {routed.length === 0 ? (
              <EmptyState
                title="Ninguna encuesta lleva a Google"
                body="La reseña se ofrece después de una encuesta con buena puntuación. Crea una y elige desde qué nota se ofrece."
                action={
                  <Link href="/surveys" className={buttonClass('primary')}>
                    Ver encuestas
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-line)]">
                {routed.map((survey) => (
                  <li
                    key={survey.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                  >
                    <span className="text-[14px] font-medium">{survey.name}</span>
                    <span className="tabular text-[13px] text-[var(--color-ink-muted)]">
                      Desde {survey.routeToReviewFromRating} de 5
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Control">
            <ReviewPauseToggle paused={stats.paused} />
          </Panel>
        </>
      )}
    </div>
  )
}
