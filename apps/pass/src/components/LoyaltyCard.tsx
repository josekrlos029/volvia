import type { BannerPattern, CardBanner, StampStyle } from '@volvia/shared'
import { bannerBackground, patternLayer } from '@volvia/ui'
import type { CSSProperties } from 'react'
import { StampGrid } from './StampGrid'

export interface CardDesign {
  backgroundColor: string
  foregroundColor: string
  accentColor: string
  emptyStampColor: string
  stampStyle?: StampStyle
  banner?: CardBanner
  bannerPattern?: BannerPattern
  bannerPatternOpacity?: number
  headline: string
  subheadline: string
  logoUrl: string | null
}

interface LoyaltyCardProps {
  businessName: string
  cardName: string
  design: CardDesign
  filled: number
  total: number
  rewardPositions: number[]
  cycleLabel: string | null
  animateLast?: boolean
  /** The line the business wants read on this visit, if there is one. */
  message?: string | null
}

/**
 * The card as the customer sees it. Rendered in the business's own colours, so the
 * component takes them as data rather than reaching for Volvia's palette.
 */
export function LoyaltyCard({
  businessName,
  cardName,
  design,
  filled,
  total,
  rewardPositions,
  cycleLabel,
  animateLast,
  message,
}: LoyaltyCardProps) {
  const style = {
    background: design.backgroundColor,
    color: design.foregroundColor,
    '--card-accent': design.accentColor,
  } as CSSProperties

  const banner = bannerBackground(design.banner ?? { kind: 'solid' }, design.backgroundColor)
  const pattern = patternLayer(
    design.bannerPattern ?? 'none',
    design.foregroundColor,
    design.bannerPatternOpacity ?? 0,
  )

  return (
    <article
      style={style}
      className="overflow-hidden rounded-[20px] shadow-[0_12px_40px_-12px_rgba(16,18,15,0.45)]"
    >
      <div className="relative p-5" style={banner as CSSProperties}>
        {pattern ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={pattern as CSSProperties}
          />
        ) : null}
        <div className="relative">
          <header className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
                {businessName}
              </p>
              <h1 className="mt-1 truncate text-[22px] font-semibold leading-tight">
                {design.headline || cardName}
              </h1>
              {design.subheadline ? (
                <p className="mt-1 text-[13px] leading-snug opacity-75">{design.subheadline}</p>
              ) : null}
            </div>

            {design.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.logoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold"
                style={{ background: design.accentColor, color: design.backgroundColor }}
              >
                {businessName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </header>

          <StampGrid
            filled={filled}
            total={total}
            rewardPositions={rewardPositions}
            accentColor={design.accentColor}
            emptyColor={design.emptyStampColor}
            foregroundColor={design.foregroundColor}
            stampStyle={design.stampStyle}
            animateLast={animateLast}
          />

          {message ? (
            <p className="mt-4 text-center text-[14px] leading-snug opacity-85">{message}</p>
          ) : null}

          <footer className="mt-5 flex items-center justify-between text-[13px]">
            <span className="font-medium tabular-nums">
              {filled} / {total}
            </span>
            {cycleLabel ? <span className="opacity-70">{cycleLabel}</span> : null}
          </footer>
        </div>
      </div>
    </article>
  )
}
