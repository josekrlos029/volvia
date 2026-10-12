/** Shapes stored inside jsonb columns. Kept structural so Drizzle stays decoupled from zod. */
import type { CardDesign, CardMessages, SegmentDefinition, StampRules } from '@volvia/shared'

export type SocialLink = { platform: string; url: string; label?: string }
export type { CardDesign, CardMessages, StampRules }

export type CampaignOffer =
  | { kind: 'bonus_stamps'; amount: number }
  | { kind: 'multiplier'; factor: number }
  | { kind: 'instant_reward'; title: string }
  | { kind: 'message_only' }

/** A banner that takes the strip over while a campaign runs. */
export type CampaignBanner = { kind: 'preset'; value: string } | { kind: 'image'; url: string }

/**
 * How a campaign or an automation changes the look of the pass while it is live.
 * Every field is optional: an empty object means "only the offer line".
 */
export type CampaignPassOverride = {
  /** Replaces the business name in the pass header. Not applied while a reward waits. */
  header?: string | null
  /** Replaces the reward description line on the card. */
  text?: string | null
  banner?: CampaignBanner | null
  /** A stamp style for the duration, or `hidden` to tuck the grid behind the banner. */
  stampStyle?: string | null
  /** The first stamp or redemption ends the offer for that customer. */
  endsOnFirstStamp?: boolean
}

export type PassOfferSource = 'campaign' | 'birthday'
export type PassOfferEndedReason = 'stamp' | 'redeem' | 'expired' | 'campaign_ended' | 'cancelled'

export type CampaignAudience = {
  segment: string
  cardIds: string[]
  customerIds: string[]
  consentOnly: boolean
  /** Optional: rows written before saved segments existed do not carry them. */
  segmentId?: string | null
  suggested?: string | null
}

export type { SegmentDefinition }

export type SurveyQuestion =
  | { type: 'rating'; prompt: string; scale: 5 }
  | { type: 'text'; prompt: string; maxLength: number }
  | { type: 'choice'; prompt: string; options: string[]; allowMultiple: boolean }

export type SurveyAnswer = {
  questionIndex: number
  rating?: number
  text?: string
  choices?: string[]
}

export type AutomationConfig = {
  offsetDays: number
  headline: string
  body: string
  offer: {
    kind: 'bonus_stamps' | 'instant_reward' | 'none'
    amount: number | null
    title: string | null
    validForDays: number
  }
  sendEmail: boolean
  sendPush: boolean
  /** Rows written before the pass could be overridden do not carry it. */
  passOverride?: CampaignPassOverride
}
