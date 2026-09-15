import { DateTime } from 'luxon'

/**
 * Every "day" in Volvia is a calendar day in the *organisation's* timezone — a café in
 * Bogotá closing at 1am must see that stamp on the previous business day's chart.
 */
export function orgDay(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toISODate() ?? ''
}

export function orgHour(instant: Date, timezone: string): number {
  return DateTime.fromJSDate(instant, { zone: timezone }).hour
}

export function orgWeekday(instant: Date, timezone: string): number {
  // Luxon: 1 = Monday … 7 = Sunday. We store 0 = Sunday … 6 = Saturday.
  return DateTime.fromJSDate(instant, { zone: timezone }).weekday % 7
}

export function startOfOrgDay(instant: Date, timezone: string): Date {
  return DateTime.fromJSDate(instant, { zone: timezone }).startOf('day').toJSDate()
}

export function endOfOrgDay(instant: Date, timezone: string): Date {
  return DateTime.fromJSDate(instant, { zone: timezone }).endOf('day').toJSDate()
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return DateTime.fromJSDate(from).minus({ days }).toJSDate()
}

export function addDays(date: Date, days: number): Date {
  return DateTime.fromJSDate(date).plus({ days }).toJSDate()
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(DateTime.fromJSDate(b).diff(DateTime.fromJSDate(a), 'days').days)
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid
}

/** Local date parts for birthday matching, evaluated in the org's timezone. */
export function birthdayTodayIn(timezone: string): { month: number; day: number } {
  const now = DateTime.now().setZone(timezone)
  return { month: now.month, day: now.day }
}

export function isWithinActiveHours(
  instant: Date,
  timezone: string,
  weekdays: number[],
  hours: { from: string; to: string } | null,
): boolean {
  const local = DateTime.fromJSDate(instant, { zone: timezone })
  if (weekdays.length > 0 && !weekdays.includes(local.weekday % 7)) return false
  if (!hours) return true
  const minutes = local.hour * 60 + local.minute
  const [fromH = 0, fromM = 0] = hours.from.split(':').map(Number)
  const [toH = 0, toM = 0] = hours.to.split(':').map(Number)
  const from = fromH * 60 + fromM
  const to = toH * 60 + toM
  // A window that wraps past midnight (22:00 → 02:00) is still one window.
  return from <= to ? minutes >= from && minutes <= to : minutes >= from || minutes <= to
}
