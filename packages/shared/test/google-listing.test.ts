import { describe, expect, it } from 'vitest'
import { googleMapsUrl, googleReviewUrl, parseGoogleListing } from '../src/google-listing'
import { updateOrgSchema } from '../src/schemas/org'

const PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4'

describe('parseGoogleListing', () => {
  it('rejects the numeric profile ID that Google shows in the profile settings', () => {
    expect(parseGoogleListing('5711072861332373611')).toEqual({ problem: 'numericId' })
  })

  it('treats empty as no listing', () => {
    expect(parseGoogleListing('')).toBeNull()
    expect(parseGoogleListing('  ')).toBeNull()
    expect(parseGoogleListing(null)).toBeNull()
  })

  it('rejects text that is not Google', () => {
    expect(parseGoogleListing('https://example.com/review')).toEqual({ problem: 'unrecognised' })
  })

  it('pulls the Place ID out of a Maps link when it is there', () => {
    expect(parseGoogleListing(`https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`)).toEqual(
      { listing: { kind: 'placeId', value: PLACE_ID } },
    )
  })
})

describe('googleReviewUrl', () => {
  it('sends a Place ID to the review form', () => {
    expect(googleReviewUrl(PLACE_ID)).toBe(
      `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
    )
  })

  it('keeps the Business Profile review link as typed', () => {
    expect(googleReviewUrl(' https://g.page/r/CQx1abc_DEF/review ')).toBe(
      'https://g.page/r/CQx1abc_DEF/review',
    )
    expect(googleReviewUrl('https://maps.app.goo.gl/AbCdEf123')).toBe(
      'https://maps.app.goo.gl/AbCdEf123',
    )
  })

  it('gives nothing for a broken listing instead of a Google 404', () => {
    expect(googleReviewUrl('5711072861332373611')).toBeNull()
  })
})

describe('googleMapsUrl', () => {
  it('only maps what is a map', () => {
    expect(googleMapsUrl(PLACE_ID)).toBe(
      `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
    )
    expect(googleMapsUrl('https://maps.app.goo.gl/AbCdEf123')).toBe(
      'https://maps.app.goo.gl/AbCdEf123',
    )
    expect(googleMapsUrl('https://g.page/r/CQx1abc_DEF/review')).toBeNull()
  })
})

describe('updateOrgSchema googlePlaceId', () => {
  it('refuses the numeric profile ID and accepts the review link', () => {
    expect(updateOrgSchema.safeParse({ googlePlaceId: '5711072861332373611' }).success).toBe(false)
    expect(
      updateOrgSchema.safeParse({ googlePlaceId: 'https://g.page/r/CQx1abc_DEF/review' }).success,
    ).toBe(true)
    expect(updateOrgSchema.safeParse({ googlePlaceId: null }).success).toBe(true)
  })
})
