import { describe, expect, it } from 'vitest'
import { birthdayEmailSlot } from '../src/lib/notification-hours'
import { type LiveOffer, multiplierFor } from '../src/modules/engagement/offers'

const bogota = 'America/Bogota'
const at = (iso: string) => new Date(iso)
const localHour = (date: Date, zone: string) =>
  Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: zone }).format(
      date,
    ),
  )

describe('birthdayEmailSlot', () => {
  it('waits for the morning window when the cron runs at dawn', () => {
    const dawn = at('2026-10-11T07:30:00Z') // 02:30 in Bogotá
    const slot = birthdayEmailSlot(dawn, bogota, 'customer-a')
    expect(slot.getTime()).toBeGreaterThan(dawn.getTime())
    expect(localHour(slot, bogota)).toBeGreaterThanOrEqual(8)
    expect(localHour(slot, bogota)).toBeLessThan(10)
  })

  it('spreads customers across the window but never moves one twice', () => {
    const dawn = at('2026-10-11T07:30:00Z')
    const a = birthdayEmailSlot(dawn, bogota, 'customer-a')
    const b = birthdayEmailSlot(dawn, bogota, 'customer-b')
    expect(a).not.toEqual(b)
    expect(birthdayEmailSlot(dawn, bogota, 'customer-a')).toEqual(a)
  })

  it('sends now inside the window', () => {
    const nineThirty = at('2026-10-11T14:30:00Z') // 09:30 in Bogotá
    expect(birthdayEmailSlot(nineThirty, bogota, 'x')).toEqual(nineThirty)
  })

  it('sends now when the run is late rather than greeting a day late', () => {
    const afternoon = at('2026-10-11T19:00:00Z') // 14:00 in Bogotá
    expect(birthdayEmailSlot(afternoon, bogota, 'x')).toEqual(afternoon)
  })

  it('follows the business timezone, not the server clock', () => {
    const instant = at('2026-10-11T05:30:00Z') // 07:30 in Madrid, 00:30 in Bogotá
    const madrid = birthdayEmailSlot(instant, 'Europe/Madrid', 'x')
    expect(localHour(madrid, 'Europe/Madrid')).toBeGreaterThanOrEqual(8)
    expect(localHour(madrid, 'Europe/Madrid')).toBeLessThan(10)
    const bog = birthdayEmailSlot(instant, bogota, 'x')
    expect(localHour(bog, bogota)).toBeGreaterThanOrEqual(8)
  })
})

const offer = (kind: LiveOffer['offer']): LiveOffer => ({
  id: 'o',
  source: 'campaign',
  campaignId: 'c',
  automationId: null,
  offer: kind,
  passOverride: {
    header: null,
    text: null,
    banner: null,
    stampStyle: null,
    endsOnFirstStamp: false,
  },
  headline: 'Hoy doble',
  body: '',
  endsAt: null,
})

describe('multiplierFor', () => {
  it('multiplies only for a multiplier offer', () => {
    expect(multiplierFor(null)).toBe(1)
    expect(multiplierFor(offer({ kind: 'message_only' }))).toBe(1)
    expect(multiplierFor(offer({ kind: 'bonus_stamps', amount: 2 }))).toBe(1)
    expect(multiplierFor(offer({ kind: 'multiplier', factor: 2 }))).toBe(2)
    expect(multiplierFor(offer({ kind: 'multiplier', factor: 3 }))).toBe(3)
  })
})

describe('pageViewKey', () => {
  it('names a visitor by a stable hash, never by the address itself', async () => {
    const { pageViewKey } = await import('../src/modules/page/service')
    const key = pageViewKey('cafe-raices', '181.54.1.9', 'Mozilla/5.0 (iPhone)')
    expect(key).toMatch(/^pageview:cafe-raices:[0-9a-f]{16}$/)
    expect(key).not.toContain('181.54')
    expect(pageViewKey('cafe-raices', '181.54.1.9', 'Mozilla/5.0 (iPhone)')).toBe(key)
    expect(pageViewKey('cafe-raices', '181.54.1.10', 'Mozilla/5.0 (iPhone)')).not.toBe(key)
  })
})
