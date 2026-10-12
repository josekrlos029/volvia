import { type Database, eq, organizations } from '@volvia/db'
import { type NotificationHours, orgSettingsSchema } from '@volvia/shared'
import { DateTime } from 'luxon'
import { isWithinActiveHours } from './time'

/**
 * The first instant at or after `instant` that falls inside the business's
 * notification window. Inside the window it is `instant` itself; outside, the next
 * opening, today or tomorrow in the business's timezone.
 */
export function nextNotificationSlot(
  instant: Date,
  timezone: string,
  hours: NotificationHours,
): Date {
  if (!hours || isWithinActiveHours(instant, timezone, [], hours)) return instant

  const [hour = 0, minute = 0] = hours.from.split(':').map(Number)
  const local = DateTime.fromJSDate(instant, { zone: timezone })
  let opening = local.set({ hour, minute, second: 0, millisecond: 0 })
  if (opening <= local) opening = opening.plus({ days: 1 })
  return opening.toJSDate()
}

/**
 * Same, for an organisation by id. Reads the timezone and the setting fresh each time:
 * a business that just widened its hours should see the next message go out now.
 */
export async function deferToNotificationHours(
  db: Database,
  orgId: string,
  instant: Date,
): Promise<Date> {
  const [org] = await db
    .select({ timezone: organizations.timezone, settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  if (!org) return instant

  const settings = orgSettingsSchema.parse(org.settings ?? {})
  return nextNotificationSlot(instant, org.timezone, settings.notificationHours)
}

/** Birthday mail goes out mid-morning: early enough to plan the day, late enough to be read. */
export const BIRTHDAY_EMAIL_WINDOW = { from: '08:00', to: '10:00' } as const

/**
 * When a birthday email should leave, for a run at `now`. Inside 08:00–10:00 local it
 * goes now; before that, at a minute of this morning's window chosen from `seed` so a
 * busy café's greetings are spread out instead of landing in one burst; after 10:00
 * (a late cron, a retry) it goes now rather than tomorrow, when it would be wrong.
 */
export function birthdayEmailSlot(now: Date, timezone: string, seed: string): Date {
  const local = DateTime.fromJSDate(now, { zone: timezone })
  const [fromH = 8] = BIRTHDAY_EMAIL_WINDOW.from.split(':').map(Number)
  const [toH = 10] = BIRTHDAY_EMAIL_WINDOW.to.split(':').map(Number)
  const opening = local.set({ hour: fromH, minute: 0, second: 0, millisecond: 0 })
  const closing = local.set({ hour: toH, minute: 0, second: 0, millisecond: 0 })
  if (local >= opening) return now

  // Deterministic jitter: the same customer always gets the same minute, so a retry
  // never reschedules them.
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const span = Math.max(1, closing.diff(opening, 'minutes').minutes - 10)
  return opening.plus({ minutes: hash % span }).toJSDate()
}
