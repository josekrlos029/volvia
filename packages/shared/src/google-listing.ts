/**
 * What a business pastes to point us at its Google listing.
 *
 * Owners rarely know a Place ID. What they do have is the "Pedir reseñas" link from
 * their Business Profile (g.page/r/…/review) or a Maps share link, so both are kept
 * as typed. The one thing we refuse is a bare number: that is the profile ID (or CID)
 * Google shows in the profile settings, and writereview answers it with a 404.
 */
export type GoogleListing = { kind: 'placeId'; value: string } | { kind: 'link'; value: string }

export type GoogleListingProblem = 'numericId' | 'unrecognised'

const PLACE_ID = /^(ChI|GhI|Ei)[A-Za-z0-9_-]{10,}$/
const GOOGLE_LINK =
  /^https?:\/\/(g\.page\/|maps\.app\.goo\.gl\/|goo\.gl\/maps|(www\.|maps\.)?google\.[a-z.]+\/maps|search\.google\.com\/local\/writereview)/i

export function parseGoogleListing(
  input: string | null | undefined,
): { listing: GoogleListing } | { problem: GoogleListingProblem } | null {
  const value = input?.trim() ?? ''
  if (!value) return null

  if (PLACE_ID.test(value)) return { listing: { kind: 'placeId', value } }
  if (/^\d+$/.test(value)) return { problem: 'numericId' }

  if (GOOGLE_LINK.test(value)) {
    const placeId = value.match(/place_?id[:=]([A-Za-z0-9_-]+)/i)?.[1]
    if (placeId && PLACE_ID.test(placeId)) return { listing: { kind: 'placeId', value: placeId } }
    return { listing: { kind: 'link', value } }
  }

  return { problem: 'unrecognised' }
}

function listingOf(stored: string | null | undefined): GoogleListing | null {
  const parsed = parseGoogleListing(stored)
  return parsed && 'listing' in parsed ? parsed.listing : null
}

/** Where a happy customer goes to leave a review, or null when the listing is unusable. */
export function googleReviewUrl(stored: string | null | undefined): string | null {
  const listing = listingOf(stored)
  if (!listing) return null
  return listing.kind === 'placeId'
    ? `https://search.google.com/local/writereview?placeid=${listing.value}`
    : listing.value
}

/** The listing on Google Maps. A review link is not a map, so it gives nothing. */
export function googleMapsUrl(stored: string | null | undefined): string | null {
  const listing = listingOf(stored)
  if (!listing) return null
  if (listing.kind === 'placeId') {
    return `https://www.google.com/maps/place/?q=place_id:${listing.value}`
  }
  return /\/review\b|writereview/i.test(listing.value) ? null : listing.value
}
