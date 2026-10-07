import {
  type Database,
  analyticsDaily,
  and,
  count,
  customerCards,
  customers,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  or,
  organizations,
  rewardGrants,
  sql,
  stampCards,
  stampEvents,
} from '@volvia/db'
import type { AnalyticsRange, Overview } from '@volvia/shared'
import { DateTime } from 'luxon'
import { startOfOrgDay } from '../../lib/time'

/** Resolves a preset or explicit range into org-local calendar dates. */
export function resolveRange(range: AnalyticsRange, timezone: string) {
  const now = DateTime.now().setZone(timezone)

  if (range.preset === 'custom' && range.from && range.to) {
    return {
      from: DateTime.fromJSDate(range.from, { zone: timezone }).startOf('day'),
      to: DateTime.fromJSDate(range.to, { zone: timezone }).endOf('day'),
    }
  }

  const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }
  // `custom` without an explicit range falls back to the default window.
  const span = days[range.preset] ?? 30
  return { from: now.minus({ days: span - 1 }).startOf('day'), to: now.endOf('day') }
}

function pctChange(current: number, previous: number): number | null {
  // A jump from zero has no meaningful percentage; the UI shows "nuevo" instead.
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Dashboard headline numbers.
 *
 * Everything reads from the daily rollups rather than the event ledger, so the query
 * cost stays flat as a business grows. Only the "distinct customers" style metrics
 * touch the base tables, and those are indexed for it.
 */
export async function loadOverview(
  db: Database,
  orgId: string,
  range: AnalyticsRange,
): Promise<Overview> {
  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const timezone = org?.timezone ?? 'UTC'
  const { from, to } = resolveRange(range, timezone)
  const spanDays = Math.max(1, Math.round(to.diff(from, 'days').days))
  const previousFrom = from.minus({ days: spanDays })

  const conditions = [eq(analyticsDaily.orgId, orgId)]
  if (range.cardId) conditions.push(eq(analyticsDaily.cardId, range.cardId))
  if (range.locationId) conditions.push(eq(analyticsDaily.locationId, range.locationId))

  const sums = {
    joins: sql<number>`coalesce(sum(${analyticsDaily.joins}), 0)::int`,
    stamps: sql<number>`coalesce(sum(${analyticsDaily.stamps}), 0)::int`,
    unlocked: sql<number>`coalesce(sum(${analyticsDaily.rewardsUnlocked}), 0)::int`,
    redeemed: sql<number>`coalesce(sum(${analyticsDaily.rewardsRedeemed}), 0)::int`,
  }

  const [[current], [previous], [totals], [repeat], [activeCards], [cadence]] = await Promise.all([
    db
      .select(sums)
      .from(analyticsDaily)
      .where(
        and(
          ...conditions,
          gte(analyticsDaily.day, from.toISODate()!),
          lte(analyticsDaily.day, to.toISODate()!),
        ),
      ),
    db
      .select(sums)
      .from(analyticsDaily)
      .where(
        and(
          ...conditions,
          gte(analyticsDaily.day, previousFrom.toISODate()!),
          lte(analyticsDaily.day, from.minus({ days: 1 }).toISODate()!),
        ),
      ),
    db
      .select({ value: count() })
      .from(customers)
      .where(and(eq(customers.orgId, orgId), sql`${customers.deletedAt} is null`)),
    // Repeat rate: the share of customers who came back at least once.
    db
      .select({
        repeat: sql<number>`count(*) filter (where ${customers.totalStamps} > 1)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(customers)
      .where(and(eq(customers.orgId, orgId), sql`${customers.deletedAt} is null`)),
    db
      .select({ value: count() })
      .from(stampCards)
      .where(and(eq(stampCards.orgId, orgId), eq(stampCards.status, 'active'))),
    // Median gap between consecutive visits — the clearest signal of loyalty health.
    db.execute(sql`
      select percentile_cont(0.5) within group (order by gap)::float as median
      from (
        select extract(epoch from (
          ${stampEvents.occurredAt} - lag(${stampEvents.occurredAt}) over (
            partition by ${stampEvents.customerCardId} order by ${stampEvents.occurredAt}
          )
        )) / 86400 as gap
        from ${stampEvents}
        where ${stampEvents.orgId} = ${orgId}
          and ${stampEvents.occurredAt} >= ${from.toISO()}::timestamptz
      ) gaps
      where gap is not null
    `),
  ])

  const customersTotal = totals?.value ?? 0
  const repeatTotal = repeat?.total ?? 0
  const unlocked = current?.unlocked ?? 0
  const redeemed = current?.redeemed ?? 0
  const medianRow = (cadence as unknown as Array<{ median: number | null }>)[0]

  return {
    customers: {
      total: customersTotal,
      new: current?.joins ?? 0,
      changePct: pctChange(current?.joins ?? 0, previous?.joins ?? 0),
    },
    stamps: {
      total: current?.stamps ?? 0,
      changePct: pctChange(current?.stamps ?? 0, previous?.stamps ?? 0),
    },
    rewards: {
      unlocked,
      redeemed,
      redemptionRate: unlocked === 0 ? 0 : Math.round((redeemed / unlocked) * 1000) / 10,
    },
    repeatRate:
      repeatTotal === 0 ? 0 : Math.round(((repeat?.repeat ?? 0) / repeatTotal) * 1000) / 10,
    averageVisitsPerCustomer:
      customersTotal === 0 ? 0 : Math.round(((current?.stamps ?? 0) / customersTotal) * 10) / 10,
    medianDaysBetweenVisits: medianRow?.median ? Math.round(medianRow.median * 10) / 10 : null,
    activeCards: activeCards?.value ?? 0,
  }
}

/** Daily series for the dashboard chart, with empty days filled in. */
export async function loadTimeseries(db: Database, orgId: string, range: AnalyticsRange) {
  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const timezone = org?.timezone ?? 'UTC'
  const { from, to } = resolveRange(range, timezone)

  const conditions = [
    eq(analyticsDaily.orgId, orgId),
    gte(analyticsDaily.day, from.toISODate()!),
    lte(analyticsDaily.day, to.toISODate()!),
  ]
  if (range.cardId) conditions.push(eq(analyticsDaily.cardId, range.cardId))

  const rows = await db
    .select({
      date: analyticsDaily.day,
      stamps: sql<number>`sum(${analyticsDaily.stamps})::int`,
      joins: sql<number>`sum(${analyticsDaily.joins})::int`,
      rewardsUnlocked: sql<number>`sum(${analyticsDaily.rewardsUnlocked})::int`,
      rewardsRedeemed: sql<number>`sum(${analyticsDaily.rewardsRedeemed})::int`,
    })
    .from(analyticsDaily)
    .where(and(...conditions))
    .groupBy(analyticsDaily.day)
    .orderBy(analyticsDaily.day)

  // A gap in the chart should read as "no visits", not as missing data.
  const byDate = new Map(rows.map((row) => [row.date, row]))
  const series: Array<{
    date: string
    stamps: number
    joins: number
    rewardsUnlocked: number
    rewardsRedeemed: number
  }> = []

  for (let cursor = from; cursor <= to; cursor = cursor.plus({ days: 1 })) {
    const key = cursor.toISODate()!
    const row = byDate.get(key)
    series.push({
      date: key,
      stamps: row?.stamps ?? 0,
      joins: row?.joins ?? 0,
      rewardsUnlocked: row?.rewardsUnlocked ?? 0,
      rewardsRedeemed: row?.rewardsRedeemed ?? 0,
    })
  }

  return series
}

/** When the shop is busy, by weekday and by hour, in the organisation's timezone. */
export async function loadBusiest(db: Database, orgId: string, range: AnalyticsRange) {
  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const timezone = org?.timezone ?? 'UTC'
  const { from, to } = resolveRange(range, timezone)

  const rows = await db
    .select({
      day: analyticsDaily.day,
      stamps: analyticsDaily.stamps,
      hourly: analyticsDaily.hourly,
    })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.orgId, orgId),
        gte(analyticsDaily.day, from.toISODate()!),
        lte(analyticsDaily.day, to.toISODate()!),
      ),
    )

  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, stamps: 0 }))
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, stamps: 0 }))

  for (const row of rows) {
    const weekday = DateTime.fromISO(row.day, { zone: timezone }).weekday % 7
    byWeekday[weekday]!.stamps += row.stamps
    row.hourly.forEach((value, hour) => {
      if (byHour[hour]) byHour[hour].stamps += value
    })
  }

  return { byWeekday, byHour }
}

/** Monthly cohort retention: the share of each intake still stamping months later. */
/**
 * What is happening in the business right now.
 *
 * The owner opens the dashboard between customers, so the first thing on it should be
 * today, not a thirty-day average: visits so far, who just joined, and whose birthday
 * is coming up while there is still time to do something about it.
 */
export async function loadPulse(
  db: Database,
  orgId: string,
  timezone: string,
): Promise<{
  today: { stamps: number; joins: number; rewards: number }
  activity: Array<{
    kind: 'stamp' | 'join' | 'reward'
    customerId: string
    firstName: string
    at: Date
    count: number
  }>
  birthdays: Array<{ customerId: string; firstName: string; month: number; day: number }>
}> {
  const startOfToday = startOfOrgDay(new Date(), timezone)

  const [[todayStamps], [todayJoins], [todayRewards], recentStamps, recentJoins, upcoming] =
    await Promise.all([
      db
        .select({ value: sql<number>`coalesce(sum(${stampEvents.delta}), 0)::int` })
        .from(stampEvents)
        .where(and(eq(stampEvents.orgId, orgId), gte(stampEvents.occurredAt, startOfToday))),
      db
        .select({ value: count() })
        .from(customers)
        .where(and(eq(customers.orgId, orgId), gte(customers.joinedAt, startOfToday))),
      db
        .select({ value: count() })
        .from(rewardGrants)
        .where(and(eq(rewardGrants.orgId, orgId), gte(rewardGrants.redeemedAt, startOfToday))),
      db
        .select({
          customerId: customers.id,
          firstName: customers.firstName,
          at: stampEvents.occurredAt,
          count: stampEvents.delta,
        })
        .from(stampEvents)
        .innerJoin(customerCards, eq(customerCards.id, stampEvents.customerCardId))
        .innerJoin(customers, eq(customers.id, customerCards.customerId))
        .where(eq(stampEvents.orgId, orgId))
        .orderBy(desc(stampEvents.occurredAt))
        .limit(8),
      db
        .select({
          customerId: customers.id,
          firstName: customers.firstName,
          at: customers.joinedAt,
        })
        .from(customers)
        .where(and(eq(customers.orgId, orgId), isNull(customers.deletedAt)))
        .orderBy(desc(customers.joinedAt))
        .limit(5),
      upcomingBirthdays(db, orgId),
    ])

  const activity = [
    ...recentStamps.map((row) => ({ kind: 'stamp' as const, ...row })),
    ...recentJoins.map((row) => ({ kind: 'join' as const, ...row, count: 0 })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8)

  return {
    today: {
      stamps: todayStamps?.value ?? 0,
      joins: todayJoins?.value ?? 0,
      rewards: todayRewards?.value ?? 0,
    },
    activity,
    birthdays: upcoming,
  }
}

/**
 * Birthdays in the next two weeks.
 *
 * Stored as month and day without a year, so the comparison wraps around December
 * rather than ordering by a date that does not exist.
 */
async function upcomingBirthdays(db: Database, orgId: string) {
  const today = new Date()
  const window: Array<{ month: number; day: number }> = []
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(today.getTime() + offset * 86_400_000)
    window.push({ month: date.getUTCMonth() + 1, day: date.getUTCDate() })
  }

  const rows = await db
    .select({
      customerId: customers.id,
      firstName: customers.firstName,
      month: customers.birthdayMonth,
      day: customers.birthdayDay,
    })
    .from(customers)
    .where(
      and(
        eq(customers.orgId, orgId),
        isNull(customers.deletedAt),
        isNotNull(customers.birthdayMonth),
        or(
          ...window.map((entry) =>
            and(eq(customers.birthdayMonth, entry.month), eq(customers.birthdayDay, entry.day)),
          ),
        ),
      ),
    )
    .limit(12)

  const position = (month: number, day: number) =>
    window.findIndex((entry) => entry.month === month && entry.day === day)

  return rows
    .filter(
      (row): row is typeof row & { month: number; day: number } =>
        row.month !== null && row.day !== null,
    )
    .sort((a, b) => position(a.month, a.day) - position(b.month, b.day))
}

export async function loadRetention(db: Database, orgId: string, months = 6) {
  const result = await db.execute(sql`
    with cohorts as (
      select
        ${customerCards.id} as card_id,
        date_trunc('month', ${customerCards.joinedAt}) as cohort
      from ${customerCards}
      where ${customerCards.orgId} = ${orgId}
        and ${customerCards.joinedAt} >= date_trunc('month', now()) - (${months} * interval '1 month')
    ),
    activity as (
      select
        c.cohort,
        c.card_id,
        floor(extract(epoch from (date_trunc('month', e.occurred_at) - c.cohort)) / 2629746)::int as month_offset
      from cohorts c
      join stamp_events e on e.customer_card_id = c.card_id
    )
    select
      to_char(cohort, 'YYYY-MM') as cohort,
      count(distinct card_id) filter (where month_offset = 0) as size,
      month_offset,
      count(distinct card_id) as active
    from activity
    group by cohort, month_offset
    order by cohort, month_offset
  `)

  const rows = result as unknown as Array<{
    cohort: string
    size: number
    month_offset: number
    active: number
  }>

  const grouped = new Map<string, { size: number; values: Array<number | null> }>()
  for (const row of rows) {
    const entry = grouped.get(row.cohort) ?? { size: 0, values: Array(months).fill(null) }
    if (row.month_offset === 0) entry.size = Number(row.active)
    if (row.month_offset < months) {
      entry.values[row.month_offset] = Number(row.active)
    }
    grouped.set(row.cohort, entry)
  }

  return {
    cohorts: [...grouped.entries()].map(([cohort, entry]) => ({
      cohort,
      size: entry.size,
      // Express each month as a percentage of the cohort's original size.
      values: entry.values.map((value) =>
        value === null || entry.size === 0 ? null : Math.round((value / entry.size) * 1000) / 10,
      ),
    })),
  }
}
