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
