import {
  type SQL,
  and,
  customers,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from '@volvia/db'
import {
  type CustomerSegment,
  DEFAULT_VISIT_FREQUENCY,
  type VisitFrequency,
  communityWindows,
  isVisitFrequency,
} from '@volvia/shared'
import { daysAgo } from './time'

/**
 * The community segments, in SQL.
 *
 * `classifyCustomer` in the shared package is the definition; this is the same rules
 * expressed so Postgres can apply them to a hundred thousand rows. They are used by the
 * customer list, by the campaign audience preview and by the worker that actually
 * sends — one function, because a campaign that previews "340 regulars" and then mails
 * everyone is worse than having no segments at all.
 */

/** A customer who never earned a stamp is measured from the day they joined. */
const lastSeen = sql`coalesce(${customers.lastStampAt}, ${customers.joinedAt})`

/**
 * A timestamp written into the statement rather than bound as a parameter.
 *
 * These conditions are composed with `not (...)`, and a raw fragment loses the column
 * type the driver needs to encode a `Date`. An ISO string with an explicit cast is
 * unambiguous to Postgres and survives being nested.
 */
const at = (date: Date) => sql`${date.toISOString()}::timestamptz`

export function visitFrequencyOf(settings: unknown): VisitFrequency {
  const value = (settings as { visitFrequency?: unknown } | null)?.visitFrequency
  return isVisitFrequency(value) ? value : DEFAULT_VISIT_FREQUENCY
}

export function segmentCondition(
  segment: CustomerSegment,
  frequency: VisitFrequency,
  now: Date = new Date(),
): SQL | undefined {
  const windows = communityWindows(frequency)
  const since = (days: number) => at(daysAgo(days, now))

  // Joined recently and has barely used the card. Checked first, and excluded from
  // every other bucket, so the five of them partition the list exactly once.
  const isNew = sql`(${customers.joinedAt} >= ${since(windows.newWithinDays)} and ${customers.totalStamps} <= 1)`
  const isRegular = sql`(${lastSeen} >= ${since(windows.cycleDays)} and ${customers.totalStamps} >= ${windows.regularMinVisits})`

  switch (segment) {
    case 'new':
      return isNew
    case 'regulars':
      return sql`(not ${isNew} and ${isRegular})`
    case 'returning':
      return sql`(not ${isNew} and not ${isRegular} and ${lastSeen} >= ${since(windows.missingAfterDays)})`
    case 'missing':
      return sql`(not ${isNew} and ${lastSeen} < ${since(windows.missingAfterDays)} and ${lastSeen} >= ${since(windows.lostAfterDays)})`
    case 'lost':
      return sql`(not ${isNew} and ${lastSeen} < ${since(windows.lostAfterDays)})`
    case 'birthday_month':
      return eq(customers.birthdayMonth, now.getMonth() + 1)
    case 'never_visited':
      return or(isNull(customers.lastStampAt), eq(customers.totalStamps, 0))
    default:
      return undefined
  }
}

/** Filters that narrow a list without redefining what a segment means. */
export function filterConditions(query: {
  search?: string
  hasConsent?: boolean
  minStamps?: number
  maxStamps?: number
  minRewards?: number
  joinedAfter?: Date
  joinedBefore?: Date
  lastVisitAfter?: Date
  lastVisitBefore?: Date
  birthdayMonth?: number
  hasBirthday?: boolean
  hasRedeemed?: boolean
}): SQL[] {
  const conditions: SQL[] = []

  if (query.hasConsent !== undefined) {
    conditions.push(eq(customers.marketingConsent, query.hasConsent))
  }
  if (query.minStamps !== undefined) conditions.push(gte(customers.totalStamps, query.minStamps))
  if (query.maxStamps !== undefined) conditions.push(lte(customers.totalStamps, query.maxStamps))
  if (query.minRewards !== undefined) {
    conditions.push(gte(customers.totalRewards, query.minRewards))
  }
  if (query.joinedAfter) conditions.push(gte(customers.joinedAt, query.joinedAfter))
  if (query.joinedBefore) conditions.push(lte(customers.joinedAt, query.joinedBefore))
  if (query.lastVisitAfter) conditions.push(gte(customers.lastStampAt, query.lastVisitAfter))
  if (query.lastVisitBefore) conditions.push(lte(customers.lastStampAt, query.lastVisitBefore))
  if (query.birthdayMonth !== undefined) {
    conditions.push(eq(customers.birthdayMonth, query.birthdayMonth))
  }
  if (query.hasBirthday !== undefined) {
    conditions.push(
      query.hasBirthday ? isNotNull(customers.birthdayMonth) : isNull(customers.birthdayMonth),
    )
  }
  if (query.hasRedeemed !== undefined) {
    conditions.push(
      query.hasRedeemed ? gt(customers.totalRewards, 0) : eq(customers.totalRewards, 0),
    )
  }

  return conditions
}
