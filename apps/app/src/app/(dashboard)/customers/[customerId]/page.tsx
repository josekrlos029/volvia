import { Badge, EmptyState, Metric, Panel } from '@/components/ui'
import { formatDate, formatRelative } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface CustomerDetail {
  customer: {
    id: string
    firstName: string
    email: string
    birthdayMonth: number | null
    birthdayDay: number | null
    marketingConsent: boolean
    totalStamps: number
    totalRewards: number
    joinedAt: string
    lastStampAt: string | null
    notes: string
  }
  cards: Array<{
    id: string
    token: string
    cardName: string
    stampsCount: number
    stampsRequired: number
    cycleIndex: number
    lifetimeStamps: number
    lastStampAt: string | null
  }>
  rewards: Array<{
    id: string
    title: string
    code: string
    status: string
    grantedAt: string
    redeemedAt: string | null
  }>
  answers: Array<{ questionId: string; prompt: string; value: string | string[] }>
  activity: Array<{
    id: string
    delta: number
    source: string
    occurredAt: string
    resultingCount: number
  }>
  masked: boolean
}

const SOURCE_LABELS: Record<string, string> = {
  staff_scan: 'Escaneo en mostrador',
  kiosk: 'Kiosko',
  manual: 'Ajuste manual',
  import: 'Importación',
  campaign: 'Campaña',
  signup_bonus: 'Bono de bienvenida',
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const detail = await apiFetch<CustomerDetail>(`/v1/customers/${customerId}`)
  const { customer } = detail

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/customers"
          className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          Clientes
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">{customer.firstName}</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          {customer.email} · Cliente desde {formatDate(customer.joinedAt, 'long')}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Sellos" value={String(customer.totalStamps)} />
        <Metric label="Recompensas" value={String(customer.totalRewards)} />
        <Metric label="Última visita" value={formatRelative(customer.lastStampAt)} />
        <Metric
          label="Cumpleaños"
          value={
            customer.birthdayMonth && customer.birthdayDay
              ? `${customer.birthdayDay} ${MONTHS[customer.birthdayMonth - 1]}`
              : 'Sin dato'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tarjetas">
          <ul className="flex flex-col gap-3">
            {detail.cards.map((card) => (
              <li key={card.id} className="rounded-[10px] border border-[var(--color-line)] p-3.5">
                <p className="text-[14px] font-medium">{card.cardName}</p>
                <p className="tabular mt-1 text-[13px] text-[var(--color-ink-muted)]">
                  {card.stampsCount} de {card.stampsRequired} sellos · {card.lifetimeStamps} en
                  total
                  {card.cycleIndex > 0 ? ` · ${card.cycleIndex} vueltas completas` : ''}
                </p>
                <div
                  className="mt-2.5 flex gap-1"
                  role="img"
                  aria-label={`${card.stampsCount} de ${card.stampsRequired} sellos`}
                >
                  {Array.from({ length: card.stampsRequired }, (_, index) => (
                    <span
                      key={`stamp-${index + 1}`}
                      className={[
                        'h-1.5 flex-1 rounded-full',
                        index < card.stampsCount
                          ? 'bg-[var(--color-primary)]'
                          : 'bg-[var(--color-line)]',
                      ].join(' ')}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recompensas">
          {detail.rewards.length === 0 ? (
            <EmptyState
              title="Todavía sin recompensas"
              body="Aparecerán aquí en cuanto complete los sellos necesarios."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-line)]">
              {detail.rewards.slice(0, 8).map((reward) => (
                <li
                  key={reward.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{reward.title}</p>
                    <p className="text-[13px] text-[var(--color-ink-muted)]">
                      {reward.redeemedAt
                        ? `Canjeada ${formatRelative(reward.redeemedAt)}`
                        : `Ganada ${formatRelative(reward.grantedAt)}`}
                    </p>
                  </div>
                  <Badge
                    tone={
                      reward.status === 'redeemed'
                        ? 'success'
                        : reward.status === 'pending'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {reward.status === 'redeemed'
                      ? 'Canjeada'
                      : reward.status === 'pending'
                        ? 'Pendiente'
                        : 'Vencida'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {detail.answers.length > 0 ? (
        <Panel title="Lo que sabemos">
          <dl className="grid gap-3 sm:grid-cols-2">
            {detail.answers.map((answer) => (
              <div key={answer.questionId}>
                <dt className="text-[13px] text-[var(--color-ink-muted)]">{answer.prompt}</dt>
                <dd className="mt-0.5 text-[14px] font-medium">
                  {Array.isArray(answer.value) ? answer.value.join(', ') : answer.value}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      <Panel title="Actividad">
        {detail.activity.length === 0 ? (
          <EmptyState title="Sin movimientos" body="Aquí verás cada sello y cada canje." />
        ) : (
          <ol className="flex flex-col divide-y divide-[var(--color-line)]">
            {detail.activity.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <div>
                  <p className="text-[14px]">
                    {event.delta > 0 ? `+${event.delta}` : event.delta} sello
                    {Math.abs(event.delta) === 1 ? '' : 's'}
                  </p>
                  <p className="text-[13px] text-[var(--color-ink-muted)]">
                    {SOURCE_LABELS[event.source] ?? event.source}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[13px] text-[var(--color-ink-muted)]">
                  {formatDate(event.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}
