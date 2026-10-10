/** Shapes stored inside jsonb columns. Kept structural so Drizzle stays decoupled from zod. */
import type { CardDesign, CardMessages, SegmentDefinition, StampRules } from '@volvia/shared'

export type SocialLink = { platform: string; url: string; label?: string }
export type { CardDesign, CardMessages, StampRules }

export type CampaignOffer =
  | { kind: 'bonus_stamps'; amount: number }
  | { kind: 'multiplier'; factor: number }
  | { kind: 'instant_reward'; title: string }
  | { kind: 'message_only' }

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
}
