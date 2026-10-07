import { ActivityChart } from '@/components/ActivityChart'
import { ActivityFeed, type ActivityItem } from '@/components/ActivityFeed'
import { ShareCard } from '@/components/ShareCard'
import { Badge, EmptyState, Metric, Panel, buttonClass } from '@/components/ui'
import { formatNumber, formatPercent, formatRelative } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface Overview {
  customers: { total: number; new: number; changePct: number | null }
  stamps: { total: number; changePct: number | null }
  rewards: { unlocked: number; redeemed: number; redemptionRate: number }
  repeatRate: number
  averageVisitsPerCustomer: number
  medianDaysBetweenVisits: number | null
  activeCards: number
  limited: boolean
  upgradeTo?: string | null
}

interface CardSummary {
  id: string
  name: string
  status: string
  stampsRequired: number
  holders: number
  joinUrl: string
}

interface CustomerRow {
  id: string
  firstName: string
  totalStamps: number
  lastStampAt: string | null
}

interface Pulse {
  today: { stamps: number; joins: number; rewards: number }
  activity: ActivityItem[]
  birthdays: Array<{ customerId: string; firstName: string; month: number; day: number }>
}

export default async function DashboardHome() {
  const [overview, series, cards, customers, pulse, org] = await Promise.all([
    apiFetch<Overview>('/v1/analytics/overview?preset=30d'),
    apiFetch<Array<{ date: string; stamps: number; joins: number }>>(
      '/v1/analytics/timeseries?preset=30d',
    ),
    apiFetch<CardSummary[]>('/v1/cards'),
    apiFetch<{ items: CustomerRow[] }>('/v1/customers?pageSize=5&sortBy=lastStampAt'),
    apiFetch<Pulse>('/v1/analytics/pulse'),
    apiFetch<{ publicUrl: string }>('/v1/org'),
  ])

  const activeCard = cards.find((card) => card.status === 'active')

  if (cards.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="Crea tu primera tarjeta"
          body="Define cuántos sellos hacen falta y qué se lleva el cliente. En dos minutos tienes el QR listo para el mostrador."
          action={
            <Link href="/cards/new" className={buttonClass('primary')}>
              Crear tarjeta
            </Link>
          }
        />
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Resumen</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">Últimos 30 días</p>
        </div>
        {activeCard ? (
          <Link href={`/cards/${activeCard.id}`} className={buttonClass('secondary', 'sm')}>
            Ver QR de {activeCard.name}
          </Link>
        ) : null}
      </header>

      <Panel title="Hoy">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="tabular text-[26px] font-semibold leading-none tracking-[-0.02em]">
              {formatNumber(pulse.today.stamps)}
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-muted)]">sellos</p>
          </div>
          <div>
            <p className="tabular text-[26px] font-semibold leading-none tracking-[-0.02em]">
              {formatNumber(pulse.today.joins)}
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-muted)]">se unieron</p>
          </div>
          <div>
            <p className="tabular text-[26px] font-semibold leading-none tracking-[-0.02em]">
              {formatNumber(pulse.today.rewards)}
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-muted)]">canjes</p>
          </div>
        </div>

        {activeCard ? (
          <div className="mt-4 border-t border-[var(--color-line)] pt-4">
            <ShareCard
              joinUrl={activeCard.joinUrl}
              publicUrl={org.publicUrl}
              cardId={activeCard.id}
            />
          </div>
        ) : null}
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Clientes"
          value={formatNumber(overview.customers.total)}
          hint={`${formatNumber(overview.customers.new)} nuevos`}
          trend={overview.customers.changePct}
        />
        <Metric
          label="Sellos"
          value={formatNumber(overview.stamps.total)}
          trend={overview.stamps.changePct}
        />
        <Metric
          label="Recompensas canjeadas"
          value={formatNumber(overview.rewards.redeemed)}
          hint={
            overview.limited
              ? 'Con plan superior'
              : `${formatPercent(overview.rewards.redemptionRate)} de las ganadas`
          }
        />
        <Metric
          label="Vuelven"
          value={overview.limited ? 'Plan' : formatPercent(overview.repeatRate)}
          hint={overview.limited ? undefined : 'de tus clientes repiten'}
        />
      </div>

      <Panel title="Actividad diaria">
        {series.some((point) => point.stamps > 0 || point.joins > 0) ? (
          <ActivityChart data={series} />
        ) : (
          <EmptyState
            title="Aún no hay movimiento"
            body="Cuando empieces a sellar tarjetas verás aquí el ritmo de tu negocio día a día."
          />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Lo último">
          <ActivityFeed items={pulse.activity} />
        </Panel>

        <Panel title="Cumpleaños en dos semanas">
          {pulse.birthdays.length === 0 ? (
            <EmptyState
              title="Nadie cumple pronto"
              body="Cuando pidas el cumpleaños al unirse, aquí verás a quién felicitar."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-line)]">
              {pulse.birthdays.map((birthday) => (
                <li
                  key={birthday.customerId}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/customers/${birthday.customerId}`}
                    className="text-[14px] font-medium"
                  >
                    {birthday.firstName}
                  </Link>
                  <span className="tabular text-[13px] text-[var(--color-ink-muted)]">
                    {birthday.day}/{birthday.month}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Tus tarjetas"
          action={
            <Link href="/cards" className="text-[13px] font-medium text-[var(--color-primary)]">
              Ver todas
            </Link>
          }
        >
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {cards.slice(0, 4).map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/cards/${card.id}`}
                    className="block truncate text-[14px] font-medium"
                  >
                    {card.name}
                  </Link>
                  <p className="tabular text-[13px] text-[var(--color-ink-muted)]">
                    {formatNumber(card.holders)} clientes · {card.stampsRequired} sellos
                  </p>
                </div>
                <Badge tone={card.status === 'active' ? 'success' : 'neutral'}>
                  {card.status === 'active'
                    ? 'Activa'
                    : card.status === 'draft'
                      ? 'Borrador'
                      : 'Archivada'}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Últimas visitas"
          action={
            <Link href="/customers" className="text-[13px] font-medium text-[var(--color-primary)]">
              Ver clientes
            </Link>
          }
        >
          {customers.items.length === 0 ? (
            <EmptyState
              title="Todavía sin clientes"
              body="Comparte el QR de tu tarjeta en el mostrador para que empiecen a unirse."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-line)]">
              {customers.items.map((customer) => (
                <li
                  key={customer.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                >
                  <Link
                    href={`/customers/${customer.id}`}
                    className="truncate text-[14px] font-medium"
                  >
                    {customer.firstName}
                  </Link>
                  <span className="tabular shrink-0 text-[13px] text-[var(--color-ink-muted)]">
                    {formatRelative(customer.lastStampAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
