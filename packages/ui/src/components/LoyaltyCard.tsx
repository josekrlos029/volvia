import type { BannerPattern, CardBanner, StampIcon, StampStyle } from '@volvia/shared'
import { presetBannerDataUri, readableOn } from '@volvia/shared'
import type { CSSProperties } from 'react'
import { bannerBackground, hexWithAlpha, patternLayer } from '../card-surface'
import { StampGrid } from './StampGrid'

/** What a live campaign or birthday changes on the card, as the API describes it. */
export interface LoyaltyCardOffer {
  headerLabel: string | null
  bannerPreset: string | null
  bannerUrl: string | null
  hideStamps: boolean
  stampStyle: string | null
  /** The campaign's line under the stamps; only the dashboard preview sets it. */
  message?: string | null
}

export interface LoyaltyCardDesign {
  backgroundColor: string
  foregroundColor: string
  accentColor: string
  emptyStampColor: string
  stampStyle?: StampStyle
  stampIcon?: StampIcon
  banner?: CardBanner
  bannerPattern?: BannerPattern
  bannerPatternOpacity?: number
  headline: string
  subheadline: string
  logoUrl?: string | null
}

export interface LoyaltyCardLabels {
  /** "Te faltan 3 para Café gratis". */
  remaining: (count: number, reward: string | null) => string
  ready: string
  stamps: (filled: number, total: number) => string
}

export const LOYALTY_CARD_LABELS_ES: LoyaltyCardLabels = {
  remaining: (count, reward) => {
    const stamps = count === 1 ? 'Te falta 1 sello' : `Te faltan ${count} sellos`
    return reward ? `${stamps} para ${reward}` : stamps
  },
  ready: 'Recompensa lista para canjear',
  stamps: (filled, total) => `${filled} de ${total} sellos`,
}

export const LOYALTY_CARD_LABELS_EN: LoyaltyCardLabels = {
  remaining: (count, reward) => {
    const stamps = count === 1 ? '1 stamp to go' : `${count} stamps to go`
    return reward ? `${stamps} for ${reward}` : stamps
  },
  ready: 'Reward ready to claim',
  stamps: (filled, total) => `${filled} of ${total} stamps`,
}

interface LoyaltyCardProps {
  businessName: string
  cardName: string
  design: LoyaltyCardDesign
  filled: number
  total: number
  rewardPositions: number[]
  /** The reward the customer is working towards; drives the "te faltan" line. */
  nextReward?: { atStamp: number; title: string } | null
  cycleLabel?: string | null
  animateLast?: boolean
  /** The line the business wants read on this visit, if there is one. */
  message?: string | null
  /** The campaign dressing the card right now, if any. */
  offer?: LoyaltyCardOffer | null
  /** A reward waiting beats a campaign header, same as on the wallet pass. */
  hasPendingReward?: boolean
  /** A smaller card for lists: no subheadline, message or slot numbers. */
  compact?: boolean
  /** The customer's page makes the card title its h1; everywhere else it is an h2. */
  titleAs?: 'h1' | 'h2' | 'h3'
  labels?: LoyaltyCardLabels
}

/**
 * The card, as the customer sees it and as the business previews it.
 *
 * One component for every web surface — the customer's page, the business page, the
 * join page, the editor preview and the card list — so the preview is the card and not
 * an approximation of it. Painted in the business's own colours, taken as data.
 */
export function LoyaltyCard({
  businessName,
  cardName,
  design,
  filled,
  total,
  rewardPositions,
  nextReward = null,
  cycleLabel = null,
  animateLast = false,
  message = null,
  offer = null,
  hasPendingReward = false,
  compact = false,
  titleAs: Title = 'h2',
  labels = LOYALTY_CARD_LABELS_ES,
}: LoyaltyCardProps) {
  const stampStyle = (
    offer?.stampStyle && offer.stampStyle !== 'hidden' ? offer.stampStyle : design.stampStyle
  ) as StampStyle | undefined
  const offerBackground = offer?.bannerUrl
    ? `url("${offer.bannerUrl}")`
    : offer?.bannerPreset
      ? presetBannerDataUri(offer.bannerPreset, 375, 123, {
          accent: design.accentColor,
          foreground: design.foregroundColor,
          background: design.backgroundColor,
        })
      : null
  const headerLabel = offer?.headerLabel && !hasPendingReward ? offer.headerLabel : businessName
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

  const clamped = Math.min(Math.max(filled, 0), total)
  const target = nextReward && nextReward.atStamp > clamped ? nextReward.atStamp : total
  const remaining = Math.max(target - clamped, 0)
  const ready = hasPendingReward || remaining === 0
  const progressLine = ready ? labels.ready : labels.remaining(remaining, nextReward?.title || null)
  const initial = businessName.slice(0, 1).toUpperCase()

  return (
    <article
      style={style}
      className={[
        'overflow-hidden shadow-[0_12px_40px_-12px_rgba(15,23,42,0.45)]',
        compact ? 'rounded-[14px]' : 'rounded-[20px]',
      ].join(' ')}
    >
      <div className={compact ? 'relative p-3.5' : 'relative p-5'} style={banner as CSSProperties}>
        {pattern ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={pattern as CSSProperties}
          />
        ) : null}
        <div className="relative">
          <header
            className={['flex items-start justify-between gap-4', compact ? 'mb-3' : 'mb-5'].join(
              ' ',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
                {headerLabel}
              </p>
              <Title
                className={[
                  'mt-1 font-semibold leading-tight',
                  compact ? 'truncate' : 'line-clamp-2',
                  compact ? 'text-[16px]' : 'text-[22px]',
                ].join(' ')}
              >
                {design.headline || cardName || 'Tu tarjeta'}
              </Title>
              {design.subheadline && !compact ? (
                <p className="mt-1 text-[13px] leading-snug opacity-75">{design.subheadline}</p>
              ) : null}
            </div>

            {design.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.logoUrl}
                alt=""
                className={[
                  'shrink-0 rounded-full bg-white object-cover',
                  compact ? 'h-8 w-8' : 'h-11 w-11',
                ].join(' ')}
              />
            ) : (
              <div
                aria-hidden="true"
                className={[
                  'grid shrink-0 place-items-center rounded-full font-semibold',
                  compact ? 'h-8 w-8 text-[13px]' : 'h-11 w-11 text-[15px]',
                ].join(' ')}
                style={{
                  background: design.accentColor,
                  color: readableOn(design.accentColor, [
                    design.backgroundColor,
                    design.foregroundColor,
                  ]),
                }}
              >
                {initial}
              </div>
            )}
          </header>

          <div
            className={offerBackground ? 'relative overflow-hidden rounded-[12px]' : undefined}
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
              <div
                className={[
                  'flex items-end justify-end p-2',
                  compact ? 'h-[72px]' : 'h-[108px]',
                ].join(' ')}
              >
                <span
                  aria-label={labels.stamps(clamped, total)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5"
                  style={{ background: hexWithAlpha(design.backgroundColor, 0.85) }}
                >
                  {Array.from({ length: Math.min(total, 20) }, (_, index) => (
                    <span
                      key={`dot-${index + 1}`}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: index < clamped ? design.accentColor : design.foregroundColor,
                        opacity: index < clamped ? 1 : 0.3,
                      }}
                    />
                  ))}
                </span>
              </div>
            ) : (
              <div className={offerBackground ? 'relative p-2' : undefined}>
                <StampGrid
                  filled={clamped}
                  total={total}
                  rewardPositions={rewardPositions}
                  backgroundColor={design.backgroundColor}
                  accentColor={design.accentColor}
                  emptyColor={design.emptyStampColor}
                  foregroundColor={design.foregroundColor}
                  stampStyle={stampStyle}
                  stampIcon={design.stampIcon}
                  animateLast={animateLast}
                  dense={compact}
                />
              </div>
            )}
          </div>

          {offer?.message && !compact ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium leading-snug">
              <span style={{ color: design.accentColor }}>★</span>
              {offer.message}
            </p>
          ) : null}

          {message && !compact ? (
            <p className="mt-4 text-center text-[14px] leading-snug opacity-85">{message}</p>
          ) : null}

          <footer className={compact ? 'mt-3' : 'mt-5'}>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: hexWithAlpha(design.foregroundColor, 0.18) }}
              // The line under it says the same in words; the grid carries the count.
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${total > 0 ? (clamped / total) * 100 : 0}%`,
                  background: design.accentColor,
                }}
              />
            </div>
            <div
              className={[
                'mt-2 flex items-baseline justify-between gap-3',
                compact ? 'text-[12px]' : 'text-[13px]',
              ].join(' ')}
            >
              <span className="min-w-0 truncate font-medium">{progressLine}</span>
              <span className="shrink-0 tabular-nums opacity-75">
                {clamped}/{total}
                {cycleLabel ? ` · ${cycleLabel}` : ''}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </article>
  )
}
