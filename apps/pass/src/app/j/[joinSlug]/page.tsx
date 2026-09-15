import { JoinForm } from '@/components/JoinForm'
import { Shell, VolviaMark } from '@/components/Shell'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { notFound } from 'next/navigation'

interface JoinPage {
  business: {
    name: string
    slug: string
    logoUrl: string | null
    tagline: string
    brandColor: string
  }
  card: {
    name: string
    stampsRequired: number
    design: {
      backgroundColor: string
      foregroundColor: string
      accentColor: string
      emptyStampColor: string
      headline: string
      subheadline: string
      logoUrl: string | null
    }
    terms: string
    collectBirthday: boolean
  }
  rewards: Array<{ atStamp: number; title: string; description: string }>
  locale: string
  questions: Array<{
    id: string
    prompt: string
    type: string
    options: string[]
    isRequired: boolean
  }>
}

async function loadJoinPage(joinSlug: string): Promise<JoinPage | null> {
  try {
    return await api.get<JoinPage>(`/p/join/${joinSlug}`, {
      headers: { 'cache-control': 'no-cache' },
    })
  } catch {
    return null
  }
}

export default async function JoinPageRoute({ params }: { params: Promise<{ joinSlug: string }> }) {
  const { joinSlug } = await params
  const page = await loadJoinPage(joinSlug)
  if (!page) notFound()

  const copy = t(page.locale)
  const finalReward = page.rewards.at(-1)

  return (
    <Shell>
      <header className="mb-7">
        {page.business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.business.logoUrl}
            alt=""
            className="mb-4 h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="mb-4 grid h-14 w-14 place-items-center rounded-full text-[20px] font-semibold text-white"
            style={{ background: page.card.design.backgroundColor }}
          >
            {page.business.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.01em]">
          {copy.join.title(page.business.name)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          {copy.join.subtitle(page.card.stampsRequired, finalReward?.title ?? '')}
        </p>
      </header>

      {page.rewards.length > 1 ? (
        <section className="mb-7 rounded-[14px] border border-[var(--color-line)] bg-white p-4">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
            {copy.join.rewardsTitle}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {page.rewards.map((reward) => (
              <li key={reward.atStamp} className="flex items-baseline gap-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums"
                  style={{ background: page.card.design.accentColor, color: '#14171A' }}
                >
                  {reward.atStamp}
                </span>
                <span className="text-[15px] leading-snug">
                  <span className="font-medium">{reward.title}</span>
                  {reward.description ? (
                    <span className="text-[var(--color-ink-muted)]"> {reward.description}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <JoinForm
        joinSlug={joinSlug}
        locale={page.locale}
        collectBirthday={page.card.collectBirthday}
        questions={page.questions}
        accentColor={page.card.design.accentColor}
      />

      <VolviaMark />
    </Shell>
  )
}
