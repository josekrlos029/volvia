'use client'

import type { BannerPattern, CardBanner, StampStyle } from '@volvia/shared'
import { presetBannerDataUri } from '@volvia/shared'
import { STAMP_RADIUS, bannerBackground, hexWithAlpha, patternLayer } from '@volvia/ui'
import type { CSSProperties } from 'react'

/** What a campaign changes on the card while it runs, as the preview needs it. */
export interface PreviewOffer {
  headerLabel: string | null
  bannerPreset: string | null
  bannerUrl: string | null
  hideStamps: boolean
  stampStyle: StampStyle | null
  message: string | null
}

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
  offer = null,
}: {
  design: PreviewDesign
  businessName: string
  cardName: string
  stampsRequired: number
  rewardPositions: number[]
  initialStamps?: number
  message?: string | null
  /** A live campaign laid over the card: header, banner, hidden or restyled stamps. */
  offer?: PreviewOffer | null
}) {
  const filled = Math.max(initialStamps, Math.floor(stampsRequired / 2))
  const columns = balancedColumns(stampsRequired)
  const banner = bannerBackground(design.banner, design.backgroundColor)
  const pattern = patternLayer(
    design.bannerPattern,
    design.foregroundColor,
    design.bannerPatternOpacity,
  )
  const stampStyle = offer?.stampStyle ?? design.stampStyle
  const offerBackground = offer?.bannerUrl
    ? `url("${offer.bannerUrl}")`
    : offer?.bannerPreset
      ? presetBannerDataUri(offer.bannerPreset, 375, 123, {
          accent: design.accentColor,
          foreground: design.foregroundColor,
          background: design.backgroundColor,
        })
      : null

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
          {offer?.headerLabel || businessName}
        </p>
        <h3 className="mt-1 text-[20px] font-semibold leading-tight">
          {design.headline || cardName || 'Tu tarjeta'}
        </h3>
        {design.subheadline ? (
          <p className="mt-1 text-[13px] leading-snug opacity-75">{design.subheadline}</p>
        ) : null}

        <div
          className="relative mt-4 overflow-hidden rounded-[12px]"
          style={
            offerBackground
              ? {
                  backgroundImage: offerBackground,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {offerBackground && !offer?.hideStamps ? (
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: design.backgroundColor, opacity: 0.35 }}
            />
          ) : null}
          {offer?.hideStamps ? (
            <div className="flex h-[96px] items-end justify-end p-2">
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5"
                style={{ background: hexWithAlpha(design.backgroundColor, 0.85) }}
              >
                {Array.from({ length: Math.min(stampsRequired, 20) }, (_, index) => (
                  <span
                    key={`dot-${index + 1}`}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: index < filled ? design.accentColor : design.foregroundColor,
                      opacity: index < filled ? 1 : 0.3,
                    }}
                  />
                ))}
              </span>
            </div>
          ) : (
            <div
              className={`relative grid gap-2 ${offerBackground ? 'p-2' : ''}`}
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: stampsRequired }, (_, index) => {
                const position = index + 1
                const isFilled = position <= filled
                const isReward = rewardPositions.includes(position)
                const rings = [
                  stampStyle === 'badge'
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
                      borderRadius: STAMP_RADIUS[stampStyle],
                      boxShadow: rings.length > 0 ? rings.join(', ') : undefined,
                    }}
                  >
                    {isFilled ? '✓' : position}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {offer?.message ? (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium leading-snug">
            <span style={{ color: design.accentColor }}>★</span>
            {offer.message}
          </p>
        ) : null}

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
