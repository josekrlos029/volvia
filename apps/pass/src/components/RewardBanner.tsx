'use client'

import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'

interface PendingReward {
  grantId: string
  title: string
  description: string
  code: string
  expiresAt: string | null
}

interface RewardBannerProps {
  rewards: PendingReward[]
  accentColor: string
  locale: string
  /** Set right after a customer joins or a stamp lands, to justify the celebration. */
  celebrate: boolean
}

/**
 * The payoff moment.
 *
 * The code is the important thing here: staff read it aloud or type it, so it is set
 * large, in a monospaced face, with generous letter spacing. Everything else defers.
 */
export function RewardBanner({ rewards, accentColor, locale, celebrate }: RewardBannerProps) {
  const copy = t(locale)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (!celebrate || rewards.length === 0) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    setShowConfetti(true)
    const timer = setTimeout(() => setShowConfetti(false), 2_600)
    return () => clearTimeout(timer)
  }, [celebrate, rewards.length])

  if (rewards.length === 0) return null

  return (
    <section
      className="reward-glow relative overflow-hidden rounded-[16px] p-5 text-[#14171A]"
      style={{ background: accentColor, ['--card-accent' as string]: accentColor }}
      aria-live="polite"
    >
      {showConfetti ? <Confetti /> : null}

      <h2 className="text-[18px] font-semibold leading-tight">{copy.card.readyTitle}</h2>
      <p className="mt-1 text-[14px] leading-snug opacity-80">{copy.card.readyBody}</p>

      <ul className="mt-4 flex flex-col gap-3">
        {rewards.map((reward) => (
          <li key={reward.grantId} className="rounded-[12px] bg-white/85 p-3.5">
            <p className="text-[15px] font-semibold leading-snug">{reward.title}</p>
            {reward.description ? (
              <p className="mt-0.5 text-[13px] leading-snug opacity-75">{reward.description}</p>
            ) : null}

            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-65">
                {copy.card.code}
              </span>
              <code className="font-[family-name:var(--font-geist-mono)] text-[24px] font-semibold tracking-[0.18em]">
                {reward.code}
              </code>
            </div>

            {reward.expiresAt ? (
              <p className="mt-2 text-[12px] opacity-70">
                {copy.card.expires(
                  new Date(reward.expiresAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                  }),
                )}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A short, cheap celebration: twelve pieces, one pass, then gone. */
function Confetti() {
  const pieces = Array.from({ length: 12 }, (_, index) => ({
    id: `piece-${index}`,
    left: `${8 + index * 7.5}%`,
    delay: `${(index % 5) * 120}ms`,
    duration: `${1_600 + (index % 4) * 280}ms`,
    color: ['#16624A', '#14171A', '#FFFFFF', '#B3261E'][index % 4]!,
  }))

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 block h-2.5 w-1.5 rounded-[1px]"
          style={{
            left: piece.left,
            background: piece.color,
            animation: `confetti-fall ${piece.duration} ${piece.delay} cubic-bezier(0.3, 0.7, 0.4, 1) forwards`,
          }}
        />
      ))}
    </div>
  )
}
