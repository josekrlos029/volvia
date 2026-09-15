import { Badge, EmptyState, Panel, buttonClass } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface CardRow {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  stampsRequired: number
  holders: number
  joinUrl: string
  rewards: Array<{ atStamp: number; title: string }>
  design: { backgroundColor: string; accentColor: string }
}

export default async function CardsPage() {
  const cards = await apiFetch<CardRow[]>('/v1/cards')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Tarjetas</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Cada tarjeta tiene su propio QR y sus recompensas.
          </p>
        </div>
        <Link href="/cards/new" className={buttonClass('primary', 'sm')}>
          Nueva tarjeta
        </Link>
      </header>

      {cards.length === 0 ? (
        <Panel>
          <EmptyState
            title="Todavía no tienes tarjetas"
            body="Crea una, publícala y pega el QR en el mostrador. Tus clientes se unen escaneándolo."
            action={
              <Link href="/cards/new" className={buttonClass('primary')}>
                Crear tarjeta
              </Link>
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

                {/* A miniature of the real card, so the list is scannable by look. */}
                <div
                  className="flex items-center gap-1.5 rounded-[9px] p-3"
                  style={{ background: card.design.backgroundColor }}
                  aria-hidden="true"
                >
                  {Array.from({ length: Math.min(card.stampsRequired, 10) }, (_, index) => (
                    <span
                      key={`slot-${index + 1}`}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: index < 3 ? card.design.accentColor : 'rgba(255,255,255,0.16)',
                      }}
                    />
                  ))}
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
