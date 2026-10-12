import { Badge, EmptyState, Panel, buttonClass } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { apiFetch, getSession } from '@/lib/session'
import { roleAtLeast } from '@volvia/shared'
import { LoyaltyCard, type LoyaltyCardDesign } from '@volvia/ui/components/LoyaltyCard'
import Link from 'next/link'

interface CardRow {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  stampsRequired: number
  holders: number
  joinUrl: string
  rewards: Array<{ atStamp: number; title: string }>
  design: LoyaltyCardDesign
}

export default async function CardsPage() {
  const [cards, session, org] = await Promise.all([
    apiFetch<CardRow[]>('/v1/cards'),
    getSession(),
    apiFetch<{ name: string; logoUrl: string | null }>('/v1/org'),
  ])
  const isAdmin = session ? roleAtLeast(session.role, 'admin') : false

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Tarjetas</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Cada tarjeta tiene su propio QR y sus recompensas.
          </p>
        </div>
        {isAdmin ? (
          <Link href="/cards/new" className={buttonClass('primary', 'sm')}>
            Nueva tarjeta
          </Link>
        ) : null}
      </header>

      {cards.length === 0 ? (
        <Panel>
          <EmptyState
            title="Todavía no tienes tarjetas"
            body={
              isAdmin
                ? 'Crea una, publícala y pega el QR en el mostrador. Tus clientes se unen escaneándolo.'
                : 'Cuando el dueño o un administrador publique una, aquí verás su QR.'
            }
            action={
              isAdmin ? (
                <Link href="/cards/new" className={buttonClass('primary')}>
                  Crear tarjeta
                </Link>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/cards/${card.id}`}
                className="flex h-full flex-col gap-3 rounded-[12px] border border-[var(--color-line)] bg-white p-4 transition-colors hover:border-[var(--color-primary)]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-semibold">{card.name}</h2>
                    <p className="tabular mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
                      {card.stampsRequired} sellos · {formatNumber(card.holders)} clientes
                    </p>
                  </div>
                  <Badge
                    tone={
                      card.status === 'active'
                        ? 'success'
                        : card.status === 'draft'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {card.status === 'active'
                      ? 'Activa'
                      : card.status === 'draft'
                        ? 'Borrador'
                        : 'Archivada'}
                  </Badge>
                </div>

                {/* The real card, reduced and a third full, so the list is scannable by look. */}
                <div aria-hidden="true" className="pointer-events-none w-full max-w-[280px]">
                  <LoyaltyCard
                    compact
                    titleAs="h3"
                    businessName={org.name}
                    cardName={card.name}
                    design={{ ...card.design, logoUrl: card.design.logoUrl ?? org.logoUrl }}
                    filled={Math.ceil(card.stampsRequired / 3)}
                    total={card.stampsRequired}
                    rewardPositions={card.rewards.map((reward) => reward.atStamp)}
                    nextReward={
                      card.rewards.find(
                        (reward) => reward.atStamp > Math.ceil(card.stampsRequired / 3),
                      ) ?? null
                    }
                  />
                </div>

                <ul className="flex flex-col gap-1 text-[13px] text-[var(--color-ink-muted)]">
                  {card.rewards.map((reward) => (
                    <li key={reward.atStamp} className="tabular">
                      Sello {reward.atStamp}: {reward.title}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
