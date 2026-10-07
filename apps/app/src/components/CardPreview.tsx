'use client'

import type { BannerPattern, CardBanner, StampStyle } from '@volvia/shared'
import { STAMP_RADIUS, bannerBackground, hexWithAlpha, patternLayer } from '@volvia/ui'
import type { CSSProperties } from 'react'

export interface PreviewDesign {
  backgroundColor: string
  foregroundColor: string
  accentColor: string
  emptyStampColor: string
  stampStyle: StampStyle
  banner: CardBanner
  bannerPattern: BannerPattern
  bannerPatternOpacity: number
  headline: string
  subheadline: string
}

/**
 * The live preview beside the card editor.
 *
 * It shows the card half-filled rather than empty, because an empty card hides exactly
 * the contrast problem a business needs to see: whether a stamped slot reads clearly
 * against the background they just picked.
 */
export function CardPreview({
  design,
  businessName,
  cardName,
  stampsRequired,
  rewardPositions,
  initialStamps = 0,
  message,
}: {
  design: PreviewDesign
  businessName: string
  cardName: string
  stampsRequired: number
  rewardPositions: number[]
  initialStamps?: number
  message?: string | null
}) {
  const filled = Math.max(initialStamps, Math.floor(stampsRequired / 2))
  const columns = balancedColumns(stampsRequired)
  const banner = bannerBackground(design.banner, design.backgroundColor)
  const pattern = patternLayer(
    design.bannerPattern,
    design.foregroundColor,
    design.bannerPatternOpacity,
  )

  return (
    <div
      className="relative overflow-hidden rounded-[18px] p-5"
      style={{ ...banner, color: design.foregroundColor } as CSSProperties}
    >
      {pattern ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={pattern as CSSProperties}
        />
      ) : null}
      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
          {businessName}
        </p>
        <h3 className="mt-1 text-[20px] font-semibold leading-tight">
          {design.headline || cardName || 'Tu tarjeta'}
        </h3>
        {design.subheadline ? (
          <p className="mt-1 text-[13px] leading-snug opacity-75">{design.subheadline}</p>
        ) : null}

        <div
          className="mt-4 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: stampsRequired }, (_, index) => {
            const position = index + 1
            const isFilled = position <= filled
            const isReward = rewardPositions.includes(position)
            const rings = [
              design.stampStyle === 'badge'
                ? `0 0 0 2px ${hexWithAlpha(design.accentColor, 0.55)}`
                : null,
              isReward && !isFilled ? `0 0 0 2px ${design.emptyStampColor}` : null,
            ].filter(Boolean)

            return (
              <span
                key={position}
                className="grid aspect-square place-items-center border-2 text-[12px] font-semibold"
                style={{
                  background: isFilled ? design.accentColor : 'transparent',
                  borderColor: isFilled ? design.accentColor : design.emptyStampColor,
                  color: isFilled ? design.backgroundColor : design.emptyStampColor,
                  borderRadius: STAMP_RADIUS[design.stampStyle],
                  boxShadow: rings.length > 0 ? rings.join(', ') : undefined,
                }}
              >
                {isFilled ? '✓' : position}
              </span>
            )
          })}
        </div>

        {message ? (
          <p className="mt-4 text-center text-[14px] leading-snug opacity-85">{message}</p>
        ) : null}

        <p className="tabular mt-4 text-[13px] font-medium">
          {filled} / {stampsRequired}
        </p>
      </div>
    </div>
  )
}

function balancedColumns(total: number): number {
  if (total <= 6) return total
  for (const candidate of [6, 5, 4, 3]) {
    if (total % candidate === 0) return candidate
  }
  return 5
}
