import type { Locale } from './locales'

/** Weekly opening hours as stored on a location: day 0 is Sunday, times are `HH:mm`. */
export type OpeningHours = Array<{ day: number; opens: string; closes: string }>

export const WEEKDAY_SHORT: Record<Locale, readonly string[]> = {
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

/** Monday first: the order a Colombian or Spanish reader expects a week in. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/** `09:00` reads as `9:00`; `14:30` stays. */
const clock = (value: string) => value.replace(/^0/, '')

/**
 * The week as a short, readable schedule: `Lun–Vie 9:00–18:00` on one line, `Sáb
 * 10:00–14:00` on the next. Consecutive days with the same hours collapse into a range,
 * closed days are left out, and a split shift lists both ranges separated by a comma.
 * Empty when the business set no hours. Pure: no dates, no timezone.
 */
export function formatOpeningHours(hours: OpeningHours, locale: Locale, separator = '\n'): string {
  const names = WEEKDAY_SHORT[locale]
  const byDay = new Map<number, string[]>()
  for (const entry of hours) {
    if (entry.day < 0 || entry.day > 6) continue
    const ranges = byDay.get(entry.day) ?? []
    ranges.push(`${clock(entry.opens)}–${clock(entry.closes)}`)
    byDay.set(entry.day, ranges)
  }

  const lines: string[] = []
  let run: { from: number; to: number; text: string } | null = null
  const flush = () => {
    if (!run) return
    const label = run.from === run.to ? names[run.from] : `${names[run.from]}–${names[run.to]}`
    lines.push(`${label} ${run.text}`)
    run = null
  }

  for (const day of WEEK_ORDER) {
    const text = byDay.get(day)?.join(', ')
    if (!text) {
      flush()
      continue
    }
    if (run && run.text === text) {
      run.to = day
    } else {
      flush()
      run = { from: day, to: day, text }
    }
  }
  flush()

  return lines.join(separator)
}
