import { z } from 'zod'
import { MAX_PROFILE_QUESTIONS, MAX_SELECTED_CUSTOMERS } from '../constants'
import { COMMUNITY_SEGMENTS, SUGGESTED_SEGMENT_KEYS } from '../segments'
import {
  birthdaySchema,
  emailSchema,
  localeSchema,
  paginationSchema,
  sortOrderSchema,
} from './common'

/** What a customer fills in when they join a card from the public QR. */
export const joinCardSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  email: emailSchema,
  birthday: birthdaySchema.nullable().default(null),
  marketingConsent: z.boolean().default(false),
  locale: localeSchema.optional(),
  /** Answers to the card's optional signup questions, keyed by question id. */
  answers: z.record(z.string().uuid(), z.string().trim().max(280)).default({}),
  /** Anti-abuse: solved client-side, verified server-side. */
  captchaToken: z.string().max(4000).optional(),
})
export type JoinCardInput = z.infer<typeof joinCardSchema>

export const updateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  email: emailSchema.optional(),
  birthday: birthdaySchema.nullable().optional(),
  marketingConsent: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
})

/**
 * Segments the dashboard and campaign audiences share: the five community buckets,
 * the two composites that read them together, plus the two that answer a question
 * rather than describe a state.
 */
export const CUSTOMER_SEGMENTS = [
  'all',
  ...COMMUNITY_SEGMENTS,
  'cold',
  'recurring',
  'birthday_month',
  'never_visited',
] as const
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]

const dateFilter = z.coerce.date().optional()

export const customerListQuerySchema = paginationSchema.extend({
  cardId: z.string().uuid().optional(),
  segment: z.enum(CUSTOMER_SEGMENTS).default('all'),
  /** A saved segment or a suggested one; either replaces `segment` as the base. */
  segmentId: z.string().uuid().optional(),
  suggested: z.enum(SUGGESTED_SEGMENT_KEYS).optional(),
  search: z.string().trim().max(120).optional(),
  sortBy: z
    .enum(['joinedAt', 'lastStampAt', 'stamps', 'rewards', 'firstName'])
    .default('lastStampAt'),
  sortOrder: sortOrderSchema,
  hasConsent: z.coerce.boolean().optional(),

  /** Everything below narrows the list without changing what a segment means. */
  minStamps: z.coerce.number().int().min(0).max(100000).optional(),
  maxStamps: z.coerce.number().int().min(0).max(100000).optional(),
  minRewards: z.coerce.number().int().min(0).max(100000).optional(),
  joinedAfter: dateFilter,
  joinedBefore: dateFilter,
  lastVisitAfter: dateFilter,
  lastVisitBefore: dateFilter,
  /** Month 1-12, for planning a birthday campaign ahead of time. */
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
  hasBirthday: z.coerce.boolean().optional(),
  hasRedeemed: z.coerce.boolean().optional(),

  /**
   * An explicit selection, as a comma-separated list. Capped because it travels in a
   * URL: beyond this the business is better served by filtering and acting on the
   * whole result.
   */
  ids: z
    .string()
    .max(20_000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((id) => id.trim())
            .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
            .slice(0, MAX_SELECTED_CUSTOMERS)
        : undefined,
    ),
})
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>

/** "Know your regulars": short profile questions a business can turn on. */
export const PROFILE_QUESTION_TYPES = ['text', 'single_choice', 'date'] as const

export const profileQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(140),
  type: z.enum(PROFILE_QUESTION_TYPES).default('text'),
  options: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  isRequired: z.boolean().default(false),
  askOn: z.enum(['signup', 'after_first_reward', 'never']).default('signup'),
})
export type ProfileQuestionInput = z.infer<typeof profileQuestionSchema>

export const profileQuestionListSchema = z.array(profileQuestionSchema).max(MAX_PROFILE_QUESTIONS)

export const customerExportQuerySchema = customerListQuerySchema.omit({
  page: true,
  pageSize: true,
})
