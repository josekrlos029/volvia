/**
 * Community health.
 *
 * A loyalty programme is not a mailing list: what matters is whether someone is still
 * coming back, and "still coming back" means something different for a coffee shop than
 * for a barber. So every window here is a multiple of one number the business sets —
 * how often it expects a good customer to visit — and the five buckets are measured
 * against that instead of against fixed calendar months.
 */

export const VISIT_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly'] as const
export type VisitFrequency = (typeof VISIT_FREQUENCIES)[number]

export const VISIT_FREQUENCY_DAYS: Record<VisitFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
}

export const DEFAULT_VISIT_FREQUENCY: VisitFrequency = 'monthly'

export function isVisitFrequency(value: unknown): value is VisitFrequency {
  return (VISIT_FREQUENCIES as readonly unknown[]).includes(value)
}

/**
 * The five buckets every customer falls into, exactly one each.
 *
 * Ordered from healthiest to furthest gone, which is also the order the dashboard
 * shows them in: a business should read its community left to right and see where
 * people are leaking out.
 */
export const COMMUNITY_SEGMENTS = ['regulars', 'returning', 'new', 'missing', 'lost'] as const
export type CommunitySegment = (typeof COMMUNITY_SEGMENTS)[number]

/**
 * Two buckets read together. "Cold" is everyone drifting or gone; "recurring" is
 * everyone still coming back. They are not community segments — those five stay a
 * partition — but they are what a business means when it says "the ones we're losing".
 */
export const COMPOSITE_SEGMENTS = {
  cold: ['missing', 'lost'],
  recurring: ['regulars', 'returning'],
} as const satisfies Record<string, readonly CommunitySegment[]>
export type CompositeSegment = keyof typeof COMPOSITE_SEGMENTS

/**
 * The segments Volvia proposes on its own. Keys only: the definitions and the copy
 * live in `suggested-segments.ts`, which depends on the schemas and so cannot be
 * imported from here.
 */
export const SUGGESTED_SEGMENT_KEYS = [
  'cold',
  'recurring',
  'vip',
  'one_stamp_away',
  'never_redeemed',
  'birthday_this_month',
  'new_no_second_visit',
  'dormant_with_reward',
] as const
export type SuggestedSegmentKey = (typeof SUGGESTED_SEGMENT_KEYS)[number]

/** Visits that make someone a regular rather than a repeat visitor. */
export const REGULAR_MIN_VISITS = 3

export interface CommunityWindows {
  /** One expected visit cycle, in days. */
  cycleDays: number
  /** Joined this recently and barely used the card: still finding their feet. */
  newWithinDays: number
  /** Not seen for this long: drifting. */
  missingAfterDays: number
  /** Not seen for this long: gone, unless something brings them back. */
  lostAfterDays: number
  regularMinVisits: number
}

export function communityWindows(frequency: VisitFrequency): CommunityWindows {
  const cycleDays = VISIT_FREQUENCY_DAYS[frequency]
  return {
    cycleDays,
    newWithinDays: cycleDays,
    missingAfterDays: cycleDays * 2,
    lostAfterDays: cycleDays * 4,
    regularMinVisits: REGULAR_MIN_VISITS,
  }
}

export interface CustomerHistory {
  joinedAt: Date
  lastStampAt: Date | null
  totalStamps: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The definition every other layer has to agree with.
 *
 * The API runs the same rules in SQL so it can count thousands of rows without loading
 * them; this function is what that SQL is tested against, and what the dashboard uses
 * to explain a single customer's badge.
 */
export function classifyCustomer(
  history: CustomerHistory,
  frequency: VisitFrequency,
  now: Date = new Date(),
): CommunitySegment {
  const windows = communityWindows(frequency)
  const daysSince = (date: Date) => (now.getTime() - date.getTime()) / DAY_MS

  // Someone who never got a stamp is judged from the day they joined: the card is as
  // old to them as their signup, and pretending they are "missing" a visit they never
  // made would be wrong.
  const lastSeen = history.lastStampAt ?? history.joinedAt
  const sinceSeen = daysSince(lastSeen)

  if (daysSince(history.joinedAt) <= windows.newWithinDays && history.totalStamps <= 1) {
    return 'new'
  }
  if (sinceSeen <= windows.cycleDays && history.totalStamps >= windows.regularMinVisits) {
    return 'regulars'
  }
  if (sinceSeen <= windows.missingAfterDays) return 'returning'
  if (sinceSeen <= windows.lostAfterDays) return 'missing'
  return 'lost'
}
