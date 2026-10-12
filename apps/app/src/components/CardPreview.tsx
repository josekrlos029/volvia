'use client'

import type { BannerPattern, CardBanner, StampIcon, StampStyle } from '@volvia/shared'
import { LoyaltyCard } from '@volvia/ui/components/LoyaltyCard'

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
  stampIcon?: StampIcon
  banner: CardBanner
  bannerPattern: BannerPattern
  bannerPatternOpacity: number
  headline: string
  subheadline: string
  logoUrl?: string | null
}

/**
 * The live preview beside the card editor: the same component the customer sees.
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
  rewards = [],
  initialStamps = 0,
  message,
  offer = null,
}: {
  design: PreviewDesign
  businessName: string
  cardName: string
  stampsRequired: number
  rewardPositions: number[]
  /** Titles for the "te faltan" line; positions alone still draw the reward slots. */
  rewards?: Array<{ atStamp: number; title: string }>
  initialStamps?: number
  message?: string | null
  /** A live campaign laid over the card: header, banner, hidden or restyled stamps. */
  offer?: PreviewOffer | null
}) {
  const filled = Math.min(Math.max(initialStamps, Math.floor(stampsRequired / 2)), stampsRequired)
  const nextReward =
    [...rewards].sort((a, b) => a.atStamp - b.atStamp).find((reward) => reward.atStamp > filled) ??
    null

  return (
    <LoyaltyCard
      businessName={businessName}
      cardName={cardName}
      design={design}
      filled={filled}
      total={stampsRequired}
      rewardPositions={rewardPositions}
      nextReward={nextReward}
      message={message}
      offer={offer}
    />
  )
}
