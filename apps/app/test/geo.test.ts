import { describe, expect, it } from 'vitest'
import { mapsUrl, parseCoordinates, roundCoordinate } from '../src/lib/geo'

const BOGOTA = { ok: true, latitude: 4.6097, longitude: -74.0817 }

/**
 * Whatever an owner copies out of Google Maps has to land as a pin. These are the
 * shapes the app actually produces today, plus the numbers typed by hand.
 */
describe('parseCoordinates', () => {
  it('reads the pinned place out of a long share link, preferring it over the viewport', () => {
    const link =
      'https://www.google.com/maps/place/Caf%C3%A9+Luna/@4.60000,-74.00000,17z/data=!3m1!4b1!4m6!3m5!1s0x8e3f9a0:0x1!8m2!3d4.6097!4d-74.0817!16s%2Fg%2F1'
    expect(parseCoordinates(link)).toEqual(BOGOTA)
  })

  it('falls back to the map centre when the link has no pinned place', () => {
    expect(parseCoordinates('https://www.google.com/maps/@4.6097,-74.0817,17z')).toEqual(BOGOTA)
  })

  it.each([
    'https://www.google.com/maps?q=4.6097,-74.0817',
    'https://www.google.com/maps?q=loc:4.6097,-74.0817',
    'https://maps.google.com/?ll=4.6097,-74.0817&z=17',
    'https://www.google.com/maps/search/?api=1&query=4.6097%2C-74.0817',
    'https://www.google.com/maps/dir/?api=1&destination=4.6097,-74.0817',
    'https://www.google.com/maps/@?api=1&map_action=map&center=4.6097,-74.0817',
  ])('reads coordinates from the query string: %s', (link) => {
    expect(parseCoordinates(link)).toEqual(BOGOTA)
  })

  it.each(['4.6097, -74.0817', '4.6097,-74.0817', '4.6097 -74.0817', '  4.6097°, -74.0817°  '])(
    'accepts the bare numbers: %s',
    (text) => {
      expect(parseCoordinates(text)).toEqual(BOGOTA)
    },
  )

  it('accepts a link pasted without its scheme', () => {
    expect(parseCoordinates('www.google.com/maps?q=4.6097,-74.0817')).toEqual(BOGOTA)
  })

  it.each([
    'https://maps.app.goo.gl/AbCdEfGh123',
    'https://goo.gl/maps/AbCdEfGh123',
    'maps.app.goo.gl/AbCdEfGh123',
    'https://g.co/kgs/abc',
  ])('recognises a short link it cannot expand: %s', (link) => {
    expect(parseCoordinates(link)).toEqual({ ok: false, reason: 'short_link' })
  })

  it.each([
    '',
    'Calle 85 # 12-34, Bogotá',
    'https://www.google.com/maps/place/Caf%C3%A9+Luna',
    'https://example.com/?q=hello',
    '4.6097',
  ])('rejects text with no coordinates in it: %j', (text) => {
    expect(parseCoordinates(text)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects coordinates off the globe', () => {
    expect(parseCoordinates('91, 0')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseCoordinates('0, 181')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseCoordinates('https://www.google.com/maps?q=95,10')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('keeps six decimals, which is finer than any phone can measure', () => {
    expect(parseCoordinates('4.60971234567, -74.08175678901')).toEqual({
      ok: true,
      latitude: 4.609712,
      longitude: -74.081757,
    })
    expect(roundCoordinate(-0.0000004)).toBe(0)
  })
})

describe('mapsUrl', () => {
  it('opens the pin in Google Maps so the owner can check it', () => {
    expect(mapsUrl(4.6097, -74.0817)).toBe('https://www.google.com/maps?q=4.6097,-74.0817')
  })
})
