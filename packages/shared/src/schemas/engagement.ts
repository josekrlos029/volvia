import { z } from 'zod'
import { MAX_SURVEY_QUESTIONS } from '../constants'
import { CUSTOMER_SEGMENTS } from './customer'

/**
 * Campaign templates. Each seeds sensible defaults in the UI, but every field
 * stays editable — the template is a starting point, not a constraint.
 */
export const CAMPAIGN_TEMPLATES = [
  'slow_day',
  'happy_hour',
  'win_back',
  'double_stamps',
  'spend_and_get',
  'new_offer',
  'vip_thanks',
  'last_chance',
  'special_deal',
  'custom',
] as const
export type CampaignTemplate = (typeof CAMPAIGN_TEMPLATES)[number]

/**
 * Placeholders a business can drop into a campaign's wording.
 *
 * Resolved for each customer at the moment they open their card, so "quedan 2 sellos"
 * is their number and not an average. Anything unknown is replaced with an empty
 * string: a message reading "Hola {{name}}" to someone whose name we never asked for
 * is worse than one that simply reads "Hola".
 */
export const CAMPAIGN_VARIABLES = ['name', 'business', 'stamps', 'remaining', 'hour'] as const
export type CampaignVariable = (typeof CAMPAIGN_VARIABLES)[number]

export interface CampaignTextContext {
  name?: string | null
  business?: string | null
  stamps?: number | null
  remaining?: number | null
  /** The hour where the business is, not where the server is. */
  hour?: number | null
}

export function renderCampaignText(text: string, context: CampaignTextContext): string {
  return text.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (match, rawName: string) => {
    const name = rawName.toLowerCase() as CampaignVariable
    if (!(CAMPAIGN_VARIABLES as readonly string[]).includes(name)) return match

    const value = context[name]
    if (value === null || value === undefined) return ''
    if (name === 'hour' && typeof value === 'number') {
      return `${String(value).padStart(2, '0')}:00`
    }
    return String(value)
  })
}

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'running', 'finished', 'cancelled'] as const

export const audienceSchema = z.object({
  segment: z.enum(CUSTOMER_SEGMENTS).default('all'),
  cardIds: z.array(z.string().uuid()).max(20).default([]),
  customerIds: z.array(z.string().uuid()).max(2000).default([]),
  /** Only customers who opted in to marketing; forced true for promotional sends. */
  consentOnly: z.boolean().default(true),
})
export type Audience = z.infer<typeof audienceSchema>

/** What the campaign actually does to the card while it runs. */
export const campaignOfferSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bonus_stamps'), amount: z.number().int().min(1).max(5) }),
  z.object({ kind: z.literal('multiplier'), factor: z.number().int().min(2).max(3) }),
  z.object({ kind: z.literal('instant_reward'), title: z.string().trim().min(1).max(80) }),
  z.object({ kind: z.literal('message_only') }),
])

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    template: z.enum(CAMPAIGN_TEMPLATES).default('custom'),
    headline: z.string().trim().min(2).max(60),
    body: z.string().trim().min(2).max(240),
    offer: campaignOfferSchema,
    audience: audienceSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    /** Push the message to wallet passes when the campaign starts. */
    sendPush: z.boolean().default(true),
    /** Restrict to certain weekdays / hours, for slow-day and happy-hour style offers. */
    activeWeekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    activeHours: z
      .object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) })
      .nullable()
      .default(null),
  })
  .refine((c) => c.endsAt > c.startsAt, { message: 'end_before_start', path: ['endsAt'] })
export type CampaignInput = z.infer<typeof campaignSchema>

/** A one-off push to wallet passes, with no card-side effect. */
export const messageSchema = z.object({
  headline: z.string().trim().min(2).max(60),
  body: z.string().trim().min(2).max(240),
  audience: audienceSchema,
  scheduledAt: z.coerce.date().nullable().default(null),
})

export const SURVEY_TRIGGERS = ['after_reward', 'after_join', 'after_nth_stamp', 'manual'] as const

export const surveyQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rating'),
    prompt: z.string().trim().min(3).max(140),
    scale: z.literal(5),
  }),
  z.object({
    type: z.literal('text'),
    prompt: z.string().trim().min(3).max(140),
    maxLength: z.number().int().max(500).default(280),
  }),
  z.object({
    type: z.literal('choice'),
    prompt: z.string().trim().min(3).max(140),
    options: z.array(z.string().trim().min(1).max(60)).min(2).max(6),
    allowMultiple: z.boolean().default(false),
  }),
])

export const surveySchema = z.object({
  name: z.string().trim().min(2).max(80),
  trigger: z.enum(SURVEY_TRIGGERS).default('after_reward'),
  triggerStamp: z.number().int().min(1).max(20).nullable().default(null),
  cardIds: z.array(z.string().uuid()).max(20).default([]),
  questions: z.array(surveyQuestionSchema).min(1).max(MAX_SURVEY_QUESTIONS),
  isAnonymous: z.boolean().default(false),
  /** Route happy responses to a Google review request, unhappy ones to private feedback. */
  routeToReviewFromRating: z.number().int().min(1).max(5).nullable().default(4),
  isActive: z.boolean().default(true),
})
export type SurveyInput = z.infer<typeof surveySchema>

export const surveyResponseSchema = z.object({
  answers: z.array(
    z.object({
      questionIndex: z.number().int().min(0).max(20),
      rating: z.number().int().min(1).max(5).optional(),
      text: z.string().trim().max(500).optional(),
      choices: z.array(z.string().max(60)).max(6).optional(),
    }),
  ),
})

export const AUTOMATION_TYPES = [
  'birthday',
  'welcome',
  'inactivity_winback',
  'reward_expiry_reminder',
] as const
export type AutomationType = (typeof AUTOMATION_TYPES)[number]

export const automationSchema = z.object({
  type: z.enum(AUTOMATION_TYPES),
  isActive: z.boolean().default(true),
  /** Days before/after the trigger date the message fires. */
  offsetDays: z.number().int().min(-30).max(30).default(0),
  headline: z.string().trim().min(2).max(60),
  body: z.string().trim().min(2).max(240),
  offer: z
    .object({
      kind: z.enum(['bonus_stamps', 'instant_reward', 'none']).default('none'),
      amount: z.number().int().min(1).max(5).nullable().default(null),
      title: z.string().trim().max(80).nullable().default(null),
      validForDays: z.number().int().min(1).max(60).default(14),
    })
    .default({ kind: 'none', amount: null, title: null, validForDays: 14 }),
  sendEmail: z.boolean().default(false),
  sendPush: z.boolean().default(true),
})
export type AutomationInput = z.infer<typeof automationSchema>
