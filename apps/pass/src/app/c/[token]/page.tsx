import { LoyaltyCard } from '@/components/LoyaltyCard'
import { RewardBanner } from '@/components/RewardBanner'
import { Shell, VolviaMark } from '@/components/Shell'
import { WalletButtons } from '@/components/WalletButtons'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { notFound } from 'next/navigation'

interface CardState {
  token: string
  business: {
    name: string
    slug: string
    logoUrl: string | null
    locations: Array<{ name: string; address: string | null; mapsUrl: string | null }>
  }
  card: {
    id: string
    name: string
    stampsRequired: number
    design: Record<string, string>
    terms: string
  }
  stampsCount: number
  cycleIndex: number
  nextReward: { atStamp: number; title: string; description: string } | null
  rewards: Array<{ atStamp: number; title: string; description: string }>
  pendingRewards: Array<{
    grantId: string
    title: string
    description: string
    code: string
    expiresAt: string | null
  }>
  activeOffer: { title: string; description: string; endsAt: string } | null
  walletPasses: { appleUrl: string | null; googleUrl: string | null }
  lastStampAt: string | null
}

// The card changes with every stamp, so it is never served from a static cache.
export const dynamic = 'force-dynamic'

async function loadCard(token: string): Promise<CardState | null> {
  try {
    return await api.get<CardState>(`/p/card/${token}`)
  } catch {
    return null
  }
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ welcome?: string; stamped?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const state = await loadCard(token)
  if (!state) notFound()

  // The customer's locale is not in the URL; the business decides it.
  const locale = 'es'
  const copy = t(locale)
  const design = state.card.design as unknown as {
    backgroundColor: string
    foregroundColor: string
    accentColor: string
    emptyStampColor: string
    headline: string
    subheadline: string
    logoUrl: string | null
  }

  const justArrived = query.welcome === '1' || query.stamped === '1'

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <LoyaltyCard
          businessName={state.business.name}
          cardName={state.card.name}
          design={{ ...design, logoUrl: design.logoUrl ?? state.business.logoUrl }}
          filled={state.stampsCount}
          total={state.card.stampsRequired}
          rewardPositions={state.rewards.map((reward) => reward.atStamp)}
          cycleLabel={state.cycleIndex > 0 ? copy.card.cycle(state.cycleIndex) : null}
          animateLast={query.stamped === '1'}
        />

        <RewardBanner
          rewards={state.pendingRewards}
          accentColor={design.accentColor}
          locale={locale}
          celebrate={justArrived}
        />

        {state.activeOffer ? (
          <section className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-accent-soft)] p-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-warning)]">
              {copy.card.offerTitle}
            </h2>
            <p className="mt-1.5 text-[15px] font-medium leading-snug">{state.activeOffer.title}</p>
            <p className="mt-0.5 text-[14px] leading-snug text-[var(--color-ink-muted)]">
              {state.activeOffer.description}
            </p>
          </section>
        ) : null}

        <section className="rounded-[14px] border border-[var(--color-line)] bg-white p-4">
          {state.nextReward ? (
            <>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {copy.card.nextReward}
              </h2>
              <p className="mt-1.5 text-[16px] font-medium leading-snug">
                {state.nextReward.title}
              </p>
              <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
                {copy.card.progress(state.stampsCount, state.nextReward.atStamp)}
              </p>
            </>
          ) : (
            <p className="text-[15px] font-medium">{copy.card.complete}</p>
          )}

          <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-[13px] text-[var(--color-ink-muted)]">
            {state.lastStampAt
              ? copy.card.lastVisit(
                  new Date(state.lastStampAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                  }),
                )
              : copy.card.noVisits}
          </p>
        </section>

        <WalletButtons
          appleUrl={state.walletPasses.appleUrl}
          googleUrl={state.walletPasses.googleUrl}
          locale={locale}
        />
        <p className="text-center text-[13px] text-[var(--color-ink-muted)]">
          {copy.card.saveHint}
        </p>

        {state.business.locations.length > 0 ? (
          <section className="rounded-[14px] border border-[var(--color-line)] bg-white p-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              {copy.card.whereTitle}
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {state.business.locations.map((location) => (
                <li key={location.name}>
                  <p className="text-[15px] font-medium leading-snug">{location.name}</p>
                  {location.address ? (
                    <p className="text-[14px] leading-snug text-[var(--color-ink-muted)]">
                      {location.address}
                    </p>
                  ) : null}
                  {location.mapsUrl ? (
                    <a
                      href={location.mapsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 inline-block text-[14px] font-medium text-[var(--color-primary)] underline underline-offset-2"
                    >
                      Google Maps
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {state.card.terms ? (
          <details className="rounded-[14px] border border-[var(--color-line)] bg-white p-4">
            <summary className="cursor-pointer text-[14px] font-medium">{copy.card.terms}</summary>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
              {state.card.terms}
            </p>
          </details>
        ) : null}
      </div>

      <VolviaMark />
    </Shell>
  )
}
