import { z } from 'zod'
import {
  DEFAULT_DAILY_STAMP_CAP,
  DEFAULT_STAMPS_REQUIRED,
  DEFAULT_STAMP_COOLDOWN_MINUTES,
  MAX_DAILY_STAMP_CAP,
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

export const cardDesignSchema = z.object({
  layout: z.enum(CARD_LAYOUTS).default('classic'),
  backgroundColor: hexColorSchema.default('#14171A'),
  foregroundColor: hexColorSchema.default('#FFFFFF'),
  accentColor: hexColorSchema.default('#E9A23B'),
  stampIcon: stampIconSchema.default({ kind: 'preset', value: 'star' }),
  /** Colour of a slot that has not been earned yet. */
  emptyStampColor: hexColorSchema.default('#31363A'),
  logoUrl: z.string().url().max(500).nullable().default(null),
  bannerUrl: z.string().url().max(500).nullable().default(null),
  headline: z.string().trim().max(60).default(''),
  subheadline: z.string().trim().max(120).default(''),
})
export type CardDesign = z.infer<typeof cardDesignSchema>

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
  status: z.enum(CARD_STATUSES).optional(),
})
export type UpdateCardInput = z.infer<typeof updateCardSchema>
