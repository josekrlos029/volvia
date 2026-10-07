import { CardEditor } from '@/components/CardEditor'
import type { PreviewDesign } from '@/components/CardPreview'
import { CardQr } from '@/components/CardQr'
import { PublishButton } from '@/components/PublishButton'
import type { ProfileQuestion } from '@/components/SignupFormEditor'
import { Badge, Panel } from '@/components/ui'
import { apiFetch } from '@/lib/session'
import type { CardMessages } from '@volvia/shared'
import Link from 'next/link'

interface CardDetail {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  stampsRequired: number
  design: PreviewDesign
  rules: { cooldownMinutes: number; dailyCap: number; kioskEnabled: boolean }
  terms: string
  collectBirthday: boolean
  initialStamps: number
  signupQuestionIds: string[]
  messages: CardMessages
  joinUrl: string
  rewards: Array<{ atStamp: number; title: string; description: string }>
}

interface Org {
  name: string
  entitlements: { features: Record<string, boolean> }
}

export default async function CardDetailPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params
  const [card, org, cards, profileQuestions] = await Promise.all([
    apiFetch<CardDetail>(`/v1/cards/${cardId}`),
    apiFetch<Org>('/v1/org'),
    apiFetch<Array<{ id: string; holders: number }>>('/v1/cards'),
    apiFetch<ProfileQuestion[]>('/v1/org/profile-questions'),
  ])

  const holders = cards.find((row) => row.id === cardId)?.holders ?? 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/cards"
            className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            Tarjetas
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{card.name}</h1>
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
          <p className="tabular mt-1 text-[14px] text-[var(--color-ink-muted)]">
            {holders} clientes en esta tarjeta
          </p>
        </div>

        {card.status !== 'active' ? <PublishButton cardId={card.id} /> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <CardEditor
          cardId={card.id}
          businessName={org.name}
          canCustomiseBranding={org.entitlements.features.custom_branding ?? false}
          canUseKiosk={org.entitlements.features.kiosk_mode ?? false}
          profileQuestions={profileQuestions}
          lengthLocked={card.status === 'active' && holders > 0}
          initial={{
            name: card.name,
            stampsRequired: card.stampsRequired,
            design: card.design,
            rewards: card.rewards.map((reward) => ({
              atStamp: reward.atStamp,
              title: reward.title,
              description: reward.description,
            })),
            terms: card.terms,
            collectBirthday: card.collectBirthday,
            signupQuestionIds: card.signupQuestionIds,
            initialStamps: card.initialStamps,
            messages: card.messages,
            rules: card.rules,
          }}
        />

        <aside className="lg:sticky lg:top-8">
          <Panel title="Código para el mostrador">
            {card.status === 'active' ? (
              <CardQr cardId={card.id} joinUrl={card.joinUrl} cardName={card.name} />
            ) : (
              <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
                Publica la tarjeta para generar su código QR.
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
