import { CampaignComposer } from '@/components/CampaignComposer'
import { Badge, EmptyState, Panel } from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/format'
import { apiFetch } from '@/lib/session'

interface Campaign {
  id: string
  name: string
  template: string
  status: 'draft' | 'scheduled' | 'running' | 'finished' | 'cancelled'
  headline: string
  body: string
  startsAt: string
  endsAt: string
  stats: { targeted: number; delivered: number; redeemed: number; stamps: number }
}

const STATUS = {
  draft: { label: 'Borrador', tone: 'neutral' },
  scheduled: { label: 'Programada', tone: 'warning' },
  running: { label: 'En marcha', tone: 'success' },
  finished: { label: 'Terminada', tone: 'neutral' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
} as const

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ customers?: string }>
}) {
  const org = await apiFetch<{
    entitlements: { features: Record<string, boolean> }
  }>('/v1/org')

  if (!org.entitlements.features.campaigns) {
    return (
      <Panel>
        <EmptyState
          title="Las campañas llegan con el plan Negocio"
          body="Con ese plan puedes lanzar promociones que aparecen en la tarjeta de tus clientes y avisarles en su teléfono."
        />
      </Panel>
    )
  }

  const [list, cards] = await Promise.all([
    apiFetch<{ campaigns: Campaign[]; thisMonth: { used: number; limit: number | null } }>(
      '/v1/campaigns',
    ),
    apiFetch<Array<{ id: string; name: string; status: string }>>('/v1/cards'),
  ])
  const campaigns = list.campaigns
  const { used, limit } = list.thisMonth
  const selection = (await searchParams).customers
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Campañas</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Una promoción temporal que aparece en la tarjeta y se retira sola al terminar.
          </p>
        </div>
        {limit !== null ? (
          <p
            className={`tabular rounded-full px-3 py-1.5 text-[13px] font-medium ${
              used >= limit
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-warning)]'
                : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]'
            }`}
          >
            {used} de {limit} este mes
          </p>
        ) : null}
      </header>

      <CampaignComposer
        cards={cards.filter((card) => card.status === 'active')}
        selectedCustomerIds={selection}
        remainingThisMonth={limit === null ? null : Math.max(0, limit - used)}
      />

      {campaigns.length === 0 ? (
        <Panel>
          <EmptyState
            title="Todavía sin campañas"
            body="Empieza con una: un martes flojo, una hora feliz, o un mensaje a quienes hace tiempo no vuelven."
          />
        </Panel>
      ) : (
        <Panel title="Historial">
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{campaign.name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-[var(--color-ink-muted)]">
                      {campaign.headline}
                    </p>
                  </div>
                  <Badge tone={STATUS[campaign.status].tone}>{STATUS[campaign.status].label}</Badge>
                </div>
                <p className="tabular mt-1.5 text-[13px] text-[var(--color-ink-muted)]">
                  {formatDate(campaign.startsAt)} a {formatDate(campaign.endsAt)}
                  {campaign.stats.targeted > 0
                    ? ` · ${formatNumber(campaign.stats.targeted)} clientes`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
