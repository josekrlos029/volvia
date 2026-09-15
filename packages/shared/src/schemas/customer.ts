import { z } from 'zod'
import { MAX_PROFILE_QUESTIONS } from '../constants'
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

/** Segments the dashboard and campaign audiences share. */
export const CUSTOMER_SEGMENTS = [
  'all',
  'regulars',
  'at_risk',
  'inactive',
  'new',
  'birthday_month',
] as const
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]

/** Thresholds that define each segment, in days / visits. */
export const SEGMENT_RULES = {
  regulars: { minStampsLast90Days: 4 },
  at_risk: { inactiveDaysMin: 30, inactiveDaysMax: 59 },
  inactive: { inactiveDaysMin: 60 },
  new: { joinedWithinDays: 14 },
} as const

export const customerListQuerySchema = paginationSchema.extend({
  cardId: z.string().uuid().optional(),
  segment: z.enum(CUSTOMER_SEGMENTS).default('all'),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(['joinedAt', 'lastStampAt', 'stamps', 'rewards']).default('lastStampAt'),
  sortOrder: sortOrderSchema,
  hasConsent: z.coerce.boolean().optional(),
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
