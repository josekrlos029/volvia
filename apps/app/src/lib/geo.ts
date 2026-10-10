/**
 * Turns whatever a business owner pastes about where their shop is into a coordinate
 * pair: a Google Maps link in any of its shapes, or the numbers themselves.
 *
 * No geocoding service is involved, so an address alone cannot be resolved here; the
 * screen offers the browser's own position for that case.
 */
export type ParsedCoordinates =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: 'short_link' | 'invalid' }

/** Google's shortened links only resolve server-side; the browser cannot follow them. */
const SHORT_LINK_HOSTS = ['goo.gl', 'g.co']

const DECIMAL = '(-?\\d{1,3}(?:\\.\\d+)?)'
/** `lat,lng` with optional spaces, the form every query parameter uses. */
const PAIR = new RegExp(`${DECIMAL}\\s*,\\s*${DECIMAL}`)
/** `!3dLAT!4dLNG`: the pinned place inside a long "share" link, more exact than `@`. */
const PLACE_DATA = new RegExp(`!3d${DECIMAL}!4d${DECIMAL}`)
/** `@LAT,LNG,17z`: the centre of the map view. */
const VIEWPORT = new RegExp(`@${DECIMAL},${DECIMAL}`)
/** The bare numbers, pasted by hand: `4.6097, -74.0817`, with or without degree signs. */
const PLAIN = new RegExp(`^${DECIMAL}°?\\s*(?:,|\\s)\\s*${DECIMAL}°?$`)

const COORDINATE_PARAMS = ['q', 'll', 'query', 'destination', 'center']

export function parseCoordinates(raw: string): ParsedCoordinates {
  const input = raw.trim()
  if (!input) return { ok: false, reason: 'invalid' }

  const url = asUrl(input)
  if (url) {
    if (
      SHORT_LINK_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    ) {
      return { ok: false, reason: 'short_link' }
    }

    const href = safeDecode(url.href)
    const fromPlace = PLACE_DATA.exec(href) ?? VIEWPORT.exec(href)
    if (fromPlace) return finish(fromPlace[1]!, fromPlace[2]!)

    for (const key of COORDINATE_PARAMS) {
      const value = url.searchParams.get(key)
      if (!value) continue
      const match = PAIR.exec(value.replace(/^loc:/i, ''))
      if (match) return finish(match[1]!, match[2]!)
    }
    return { ok: false, reason: 'invalid' }
  }

  const plain = PLAIN.exec(input)
  if (plain) return finish(plain[1]!, plain[2]!)
  return { ok: false, reason: 'invalid' }
}

function asUrl(input: string): URL | null {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
  const looksLikeHost = /^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(input)
  if (!hasScheme && !looksLikeHost) return null
  try {
    return new URL(hasScheme ? input : `https://${input}`)
  } catch {
    return null
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function finish(latitudeText: string, longitudeText: string): ParsedCoordinates {
  const latitude = Number(latitudeText)
  const longitude = Number(longitudeText)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, reason: 'invalid' }
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) }
}

/** Six decimals is about a tenth of a metre: more than any phone can tell apart. */
export function roundCoordinate(value: number): number {
  // `|| 0` folds the negative zero a tiny southern value would otherwise round to.
  return Math.round(value * 1_000_000) / 1_000_000 || 0
}

export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}
