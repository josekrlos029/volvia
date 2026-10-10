import {
  type SQL,
  and,
  customerCards,
  customers,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  rewardGrants,
  sql,
  stampCards,
} from '@volvia/db'
import {
  type CustomerSegment,
  DEFAULT_VISIT_FREQUENCY,
  type SegmentDefinition,
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
    // The composites read two buckets together; they are what a business means by
    // "the ones we're losing" and "the ones who keep coming".
    case 'cold':
      return or(
        segmentCondition('missing', frequency, now)!,
        segmentCondition('lost', frequency, now)!,
      )
    case 'recurring':
      return or(
        segmentCondition('regulars', frequency, now)!,
        segmentCondition('returning', frequency, now)!,
      )
    case 'birthday_month':
      return eq(customers.birthdayMonth, now.getMonth() + 1)
    case 'never_visited':
      return or(isNull(customers.lastStampAt), eq(customers.totalStamps, 0))
    default:
      return undefined
  }
}

/** Filters that narrow a list without redefining what a segment means. */
export function filterConditions(
  query: {
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
    lastVisitWithinDays?: number
    lastVisitOlderThanDays?: number
    joinedWithinDays?: number
    stampsToRewardMax?: number
    hasPendingReward?: boolean
  },
  now: Date = new Date(),
): SQL[] {
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

  // Relative windows: these are what let a saved segment stay true next month.
  if (query.lastVisitWithinDays !== undefined) {
    conditions.push(sql`${customers.lastStampAt} >= ${at(daysAgo(query.lastVisitWithinDays, now))}`)
  }
  if (query.lastVisitOlderThanDays !== undefined) {
    conditions.push(sql`${lastSeen} < ${at(daysAgo(query.lastVisitOlderThanDays, now))}`)
  }
  if (query.joinedWithinDays !== undefined) {
    conditions.push(sql`${customers.joinedAt} >= ${at(daysAgo(query.joinedWithinDays, now))}`)
  }

  // Both subqueries are keyed on the customer, so they work from the customer list and
  // from the audience join alike.
  if (query.stampsToRewardMax !== undefined) {
    conditions.push(
      sql`exists (select 1 from ${customerCards} join ${stampCards} on ${stampCards.id} = ${customerCards.cardId} where ${customerCards.customerId} = ${customers.id} and ${customerCards.status} = 'active' and ${customerCards.stampsCount} > 0 and ${stampCards.stampsRequired} - ${customerCards.stampsCount} <= ${query.stampsToRewardMax})`,
    )
  }
  if (query.hasPendingReward !== undefined) {
    const pending = sql`(select 1 from ${rewardGrants} join ${customerCards} on ${customerCards.id} = ${rewardGrants.customerCardId} where ${customerCards.customerId} = ${customers.id} and ${rewardGrants.status} = 'pending')`
    conditions.push(query.hasPendingReward ? sql`exists ${pending}` : sql`not exists ${pending}`)
  }

  return conditions
}

/**
 * A saved or suggested segment, as SQL: its base bucket plus its filters.
 *
 * The one resolver behind the customer list, the counts, the audience preview and
 * the send, so the number a business sees is the number of people who are reached.
 */
export function segmentDefinitionConditions(
  definition: SegmentDefinition,
  frequency: VisitFrequency,
  now: Date = new Date(),
): SQL[] {
  const base = segmentCondition(definition.base, frequency, now)
  return [...(base ? [base] : []), ...filterConditions(definition.filters, now)]
}
