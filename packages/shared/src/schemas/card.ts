import { z } from 'zod'
import {
  DEFAULT_DAILY_STAMP_CAP,
  DEFAULT_STAMPS_REQUIRED,
  DEFAULT_STAMP_COOLDOWN_MINUTES,
  MAX_CARD_MESSAGE_VARIANTS,
  MAX_DAILY_STAMP_CAP,
  MAX_INITIAL_STAMPS,
  MAX_REWARDS_PER_CARD,
  MAX_STAMPS_PER_SCAN,
  MAX_STAMPS_REQUIRED,
  MAX_STAMP_COOLDOWN_MINUTES,
  MIN_STAMPS_REQUIRED,
} from '../constants'
import { hexColorSchema } from './common'

/** Built-in stamp glyphs, so a business gets a decent card without uploading art. */
export const STAMP_PRESETS = [
  'coffee',
  'burger',
  'pizza',
  'ice-cream',
  'scissors',
  'nail',
  'dumbbell',
  'paw',
  'car',
  'heart',
  'star',
  'leaf',
] as const
export type StampPreset = (typeof STAMP_PRESETS)[number]

export const stampIconSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), value: z.enum(STAMP_PRESETS) }),
  z.object({ kind: z.literal('emoji'), value: z.string().min(1).max(8) }),
  // Custom uploads are gated by the `custom_stamp_icons` feature.
  z.object({ kind: z.literal('image'), value: z.string().url().max(500) }),
])
export type StampIcon = z.infer<typeof stampIconSchema>

export const CARD_LAYOUTS = ['classic', 'compact', 'grid'] as const

/** How a single stamp slot is drawn. Four shapes cover every trade we have seen. */
export const STAMP_STYLES = ['circle', 'rounded', 'square', 'badge'] as const
export type StampStyle = (typeof STAMP_STYLES)[number]

/**
 * Overlay textures for the card header.
 *
 * Drawn in CSS from the card's own colours rather than shipped as images, so a business
 * can change its palette and the texture follows without re-uploading anything.
 */
export const BANNER_PATTERNS = [
  'none',
  'dots',
  'grid',
  'diagonal',
  'chevron',
  'waves',
  'confetti',
  'cross',
  'circles',
  'triangles',
  'stripes',
  'zigzag',
  'scales',
  'noise',
] as const
export type BannerPattern = (typeof BANNER_PATTERNS)[number]

export const bannerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('solid') }),
  z.object({
    kind: z.literal('gradient'),
    from: hexColorSchema,
    to: hexColorSchema,
    angle: z.number().int().min(0).max(360).default(160),
  }),
  z.object({ kind: z.literal('image'), url: z.string().url().max(500) }),
])
export type CardBanner = z.infer<typeof bannerSchema>

export const cardDesignSchema = z.object({
  layout: z.enum(CARD_LAYOUTS).default('classic'),
  backgroundColor: hexColorSchema.default('#14171A'),
  foregroundColor: hexColorSchema.default('#FFFFFF'),
  accentColor: hexColorSchema.default('#E9A23B'),
  stampIcon: stampIconSchema.default({ kind: 'preset', value: 'star' }),
  stampStyle: z.enum(STAMP_STYLES).default('circle'),
  /** Colour of a slot that has not been earned yet. */
  emptyStampColor: hexColorSchema.default('#31363A'),
  logoUrl: z.string().url().max(500).nullable().default(null),
  bannerUrl: z.string().url().max(500).nullable().default(null),
  banner: bannerSchema.default({ kind: 'solid' }),
  bannerPattern: z.enum(BANNER_PATTERNS).default('none'),
  /** 0–100. Low values are texture, high values are decoration. */
  bannerPatternOpacity: z.number().int().min(0).max(100).default(12),
  headline: z.string().trim().max(60).default(''),
  subheadline: z.string().trim().max(120).default(''),
})
export type CardDesign = z.infer<typeof cardDesignSchema>

/**
 * What the card says to the customer, beyond the stamps themselves.
 *
 * A card that always reads the same stops being read. Variants rotate so the message
 * changes between visits, and an exact-stamp line takes over at the moments that
 * matter — the first stamp, and the one before the reward.
 */
export const cardMessagesSchema = z.object({
  /** Shown under the stamps; one variant per visit, picked from this list. */
  variants: z.array(z.string().trim().min(1).max(90)).max(MAX_CARD_MESSAGE_VARIANTS).default([]),
  /** Keyed by stamp count: `{"0": "...", "5": "¡Una más!"}`. Beats the rotation. */
  perStamp: z.record(z.string().regex(/^\d{1,2}$/), z.string().trim().min(1).max(90)).default({}),
})
export type CardMessages = z.infer<typeof cardMessagesSchema>

export const DEFAULT_CARD_MESSAGES: CardMessages = cardMessagesSchema.parse({})

/**
 * The line to show on a card at a given moment.
 *
 * An exact-stamp line always wins — those are written for the moments that matter.
 * Otherwise the variants rotate with the stamp count, so the card reads differently on
 * the next visit without anything random, which keeps the response cacheable.
 */
export function pickCardMessage(messages: CardMessages, stampsCount: number): string | null {
  const exact = messages.perStamp[String(stampsCount)]
  if (exact) return exact

  if (messages.variants.length === 0) return null
  return messages.variants[stampsCount % messages.variants.length] ?? null
}

export const STAMP_MODES = ['per_visit', 'per_purchase', 'min_spend'] as const
export type StampMode = (typeof STAMP_MODES)[number]

export const stampRulesBaseSchema = z.object({
  mode: z.enum(STAMP_MODES).default('per_visit'),
  /** Required when mode is `min_spend`; minor units of the org currency. */
  minSpendAmount: z.number().int().min(0).nullable().default(null),
  cooldownMinutes: z
    .number()
    .int()
    .min(0)
    .max(MAX_STAMP_COOLDOWN_MINUTES)
    .default(DEFAULT_STAMP_COOLDOWN_MINUTES),
  dailyCap: z.number().int().min(1).max(MAX_DAILY_STAMP_CAP).default(DEFAULT_DAILY_STAMP_CAP),
  maxStampsPerScan: z.number().int().min(1).max(MAX_STAMPS_PER_SCAN).default(1),
  /** Kiosk mode lets customers stamp themselves; stricter limits apply. */
  kioskEnabled: z.boolean().default(false),
  kioskDailyCap: z.number().int().min(1).max(MAX_DAILY_STAMP_CAP).default(1),
})

/** `min_spend` mode is meaningless without a threshold, so the two travel together. */
export const stampRulesSchema = stampRulesBaseSchema.refine(
  (rules) => rules.mode !== 'min_spend' || rules.minSpendAmount !== null,
  { message: 'min_spend_amount_required', path: ['minSpendAmount'] },
)
export type StampRules = z.infer<typeof stampRulesSchema>

export const REWARD_KINDS = ['free_item', 'discount', 'custom'] as const

export const rewardInputSchema = z.object({
  /** Which stamp unlocks it (1-based). Must be <= the card's stampsRequired. */
  atStamp: z.number().int().min(1).max(MAX_STAMPS_REQUIRED),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).default(''),
  kind: z.enum(REWARD_KINDS).default('free_item'),
  /** Repeating rewards fire again on every later cycle. */
  isRepeating: z.boolean().default(true),
  /** Days the customer has to claim it once unlocked; null = never expires. */
  expiresInDays: z.number().int().min(1).max(365).nullable().default(null),
})
export type RewardInput = z.infer<typeof rewardInputSchema>

export const CARD_STATUSES = ['draft', 'active', 'archived'] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

export const createCardSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    stampsRequired: z
      .number()
      .int()
      .min(MIN_STAMPS_REQUIRED)
      .max(MAX_STAMPS_REQUIRED)
      .default(DEFAULT_STAMPS_REQUIRED),
    design: cardDesignSchema.partial().optional(),
    rules: stampRulesBaseSchema.partial().optional(),
    rewards: z.array(rewardInputSchema).min(1).max(MAX_REWARDS_PER_CARD),
    terms: z.string().trim().max(2000).default(''),
    /** Cards can expire a customer's progress after inactivity; null = never. */
    inactivityExpiryDays: z.number().int().min(30).max(1095).nullable().default(null),
    /** Extra questions asked at signup, beyond name/email/birthday. */
    signupQuestionIds: z.array(z.string().uuid()).max(5).default([]),
    collectBirthday: z.boolean().default(true),
    /**
     * Stamps granted the moment someone joins. A card that starts at zero feels like a
     * chore; one that starts with two feels like something already begun.
     */
    initialStamps: z.number().int().min(0).max(MAX_INITIAL_STAMPS).default(0),
    messages: cardMessagesSchema.partial().optional(),
  })
  .superRefine((card, ctx) => {
    for (const [index, reward] of card.rewards.entries()) {
      if (reward.atStamp > card.stampsRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'reward_beyond_card_length',
          path: ['rewards', index, 'atStamp'],
        })
      }
    }
    const positions = card.rewards.map((r) => r.atStamp)
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'duplicate_reward_position',
        path: ['rewards'],
      })
    }
    if (card.initialStamps >= card.stampsRequired) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'initial_stamps_complete_card',
        path: ['initialStamps'],
      })
    }
    if (!positions.includes(card.stampsRequired)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'final_stamp_needs_reward',
        path: ['rewards'],
      })
    }
  })
export type CreateCardInput = z.infer<typeof createCardSchema>

export const updateCardSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  stampsRequired: z.number().int().min(MIN_STAMPS_REQUIRED).max(MAX_STAMPS_REQUIRED).optional(),
  design: cardDesignSchema.partial().optional(),
  rules: stampRulesBaseSchema.partial().optional(),
  rewards: z.array(rewardInputSchema).min(1).max(MAX_REWARDS_PER_CARD).optional(),
  terms: z.string().trim().max(2000).optional(),
  inactivityExpiryDays: z.number().int().min(30).max(1095).nullable().optional(),
  signupQuestionIds: z.array(z.string().uuid()).max(5).optional(),
  collectBirthday: z.boolean().optional(),
  initialStamps: z.number().int().min(0).max(MAX_INITIAL_STAMPS).optional(),
  messages: cardMessagesSchema.partial().optional(),
  status: z.enum(CARD_STATUSES).optional(),
})
export type UpdateCardInput = z.infer<typeof updateCardSchema>
