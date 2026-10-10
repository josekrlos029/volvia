import { z } from 'zod'
import { CUSTOMER_SEGMENTS } from './customer'

const days = z.coerce.number().int().min(1).max(3650)
const stamps = z.coerce.number().int().min(0).max(100_000)
const dateFilter = z.coerce.date().optional()

/**
 * What a saved segment layers on top of its base bucket.
 *
 * The absolute filters are the same ones the customer list already accepts, so a
 * segment is nothing more than a filter set with a name. The relative ones ("in the
 * last N days") exist because a saved segment has to stay true next month, and a
 * fixed date does not.
 */
export const segmentFiltersSchema = z
  .object({
    hasConsent: z.coerce.boolean().optional(),
    minStamps: stamps.optional(),
    maxStamps: stamps.optional(),
    minRewards: stamps.optional(),
    joinedAfter: dateFilter,
    joinedBefore: dateFilter,
    lastVisitAfter: dateFilter,
    lastVisitBefore: dateFilter,
    birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
    hasBirthday: z.coerce.boolean().optional(),
    hasRedeemed: z.coerce.boolean().optional(),
    /** Earned a stamp this recently. */
    lastVisitWithinDays: days.optional(),
    /** Not seen (stamp, or signup if never stamped) for at least this long. */
    lastVisitOlderThanDays: days.optional(),
    joinedWithinDays: days.optional(),
    /** At most this many stamps away from a reward, on any active card. */
    stampsToRewardMax: z.coerce.number().int().min(1).max(19).optional(),
    /** Holds a reward they have not claimed yet. */
    hasPendingReward: z.coerce.boolean().optional(),
  })
  .strict()
export type SegmentFilters = z.infer<typeof segmentFiltersSchema>

export const segmentDefinitionSchema = z.object({
  base: z.enum(CUSTOMER_SEGMENTS).default('all'),
  filters: segmentFiltersSchema.default({}),
})
export type SegmentDefinition = z.infer<typeof segmentDefinitionSchema>

export const customerSegmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).nullable().default(null),
  definition: segmentDefinitionSchema,
})
export type CustomerSegmentInput = z.infer<typeof customerSegmentSchema>

/** A business can keep this many saved segments. Past that, it needs fewer, not more. */
export const MAX_CUSTOM_SEGMENTS = 50
