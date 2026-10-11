import type { Locale } from '@volvia/shared'
import { socialLinkLabel } from '@volvia/shared'
import type { PassLink } from '@volvia/wallet'

/**
 * What a branch contributes to a pass, beyond its pin. Shaped after the `locations`
 * row so the service can hand rows straight in.
 */
export interface PassLocation {
  address: string | null
  city: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
  hours: Array<{ day: number; opens: string; closes: string }>
}

/** Both wallets cap relevance points at ten; with more branches the oldest ten win. */
export const MAX_PASS_PINS = 10
/** Enough for every social link a business may store (nine) without crowding the back. */
export const MAX_PASS_LINKS = 8

const STRINGS = {
  es: { directions: 'Cómo llegar', phone: 'Teléfono', email: 'Correo' },
  en: { directions: 'Directions', phone: 'Phone', email: 'Email' },
} as const

/** The pins that make the pass surface when the customer walks up to the shop. */
export function pinsOf(rows: PassLocation[]): Array<{ latitude: number; longitude: number }> {
  return rows
    .flatMap((row) =>
      row.latitude !== null && row.longitude !== null
        ? [{ latitude: row.latitude, longitude: row.longitude }]
        : [],
    )
    .slice(0, MAX_PASS_PINS)
}

/**
 * The branch the back of the pass describes: the oldest active one with an address,
 * falling back to one that at least has hours or a phone, so a shop that never typed
 * its street still shows what it did fill in.
 */
export function primaryPlaceOf<T extends PassLocation>(rows: T[]): T | null {
  return (
    rows.find((row) => row.address) ??
    rows.find((row) => row.hours.length > 0 || row.phone) ??
    rows[0] ??
    null
  )
}

/** `tel:` wants digits; a leading `+` is the only other thing worth keeping. */
function telUrl(phone: string): string | null {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/[^\d]/g, '')
  if (digits.length < 5) return null
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`
}

function mapsUrl(place: PassLocation): string | null {
  if (place.latitude !== null && place.longitude !== null) {
    return `https://maps.google.com/?q=${place.latitude},${place.longitude}`
  }
  const query = [place.address, place.city].filter(Boolean).join(', ')
  return query ? `https://maps.google.com/?q=${encodeURIComponent(query)}` : null
}

/**
 * Everything on the pass the customer can tap, in the order the business would list
 * it: their own links as configured, then directions, phone and email. Labels are
 * resolved here, in the customer's language, so both wallets render the same words.
 */
export function passLinksFor(input: {
  socialLinks: Array<{ platform: string; url: string; label?: string | null }>
  contactPhone: string | null
  contactEmail: string | null
  place: PassLocation | null
  locale: Locale
}): PassLink[] {
  const strings = STRINGS[input.locale]
  const links: PassLink[] = input.socialLinks.map((link, index) => ({
    id: `${link.platform}-${index}`,
    label: socialLinkLabel(link, input.locale),
    url: link.url,
    kind: 'web',
  }))

  const maps = input.place ? mapsUrl(input.place) : null
  if (maps) links.push({ id: 'maps', label: strings.directions, url: maps, kind: 'maps' })

  const phone = input.place?.phone || input.contactPhone
  const tel = phone ? telUrl(phone) : null
  if (tel) links.push({ id: 'phone', label: strings.phone, url: tel, kind: 'phone' })

  const email = input.contactEmail?.trim()
  if (email)
    links.push({ id: 'email', label: strings.email, url: `mailto:${email}`, kind: 'email' })

  return links.slice(0, MAX_PASS_LINKS)
}
