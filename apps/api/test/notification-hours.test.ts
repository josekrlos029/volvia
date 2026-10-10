import { describe, expect, it } from 'vitest'
import { nextNotificationSlot } from '../src/lib/notification-hours'

/**
 * Quiet hours. A push at 2am is not marketing, it is a reason to delete the pass, so
 * anything due outside the business's window waits for the next opening in the
 * business's own timezone, not the server's.
 */
const bogota = 'America/Bogota'
const hours = { from: '08:00', to: '21:00' }
const at = (iso: string) => new Date(iso)

describe('nextNotificationSlot', () => {
  it('leaves an instant inside the window alone', () => {
    const noon = at('2026-10-10T17:00:00Z') // 12:00 in Bogotá
    expect(nextNotificationSlot(noon, bogota, hours)).toEqual(noon)
  })

  it('moves a late-night send to the next morning', () => {
    const lateNight = at('2026-10-11T04:30:00Z') // 23:30 on the 10th in Bogotá
    expect(nextNotificationSlot(lateNight, bogota, hours)).toEqual(at('2026-10-11T13:00:00Z'))
  })

  it('moves an early-morning send to the same morning', () => {
    const dawn = at('2026-10-11T10:15:00Z') // 05:15 in Bogotá
    expect(nextNotificationSlot(dawn, bogota, hours)).toEqual(at('2026-10-11T13:00:00Z'))
  })

  it('respects the timezone, not the clock of the server', () => {
    const madrid = at('2026-10-11T01:00:00Z') // 03:00 in Madrid, 20:00 in Bogotá
    expect(nextNotificationSlot(madrid, 'Europe/Madrid', hours)).toEqual(at('2026-10-11T06:00:00Z'))
    expect(nextNotificationSlot(madrid, bogota, hours)).toEqual(madrid)
  })

  it('sends at any hour when the business asked for no window', () => {
    const lateNight = at('2026-10-11T04:30:00Z')
    expect(nextNotificationSlot(lateNight, bogota, null)).toEqual(lateNight)
  })
})
