import { describe, expect, it } from 'vitest'
import {
  type GoogleWalletConfig,
  buildLoyaltyObject,
  classId,
  objectId,
} from '../src/google/loyalty'
import type { PassContent } from '../src/types'

const config: GoogleWalletConfig = {
  issuerId: '3388000000000000000',
  serviceAccountEmail: 'wallet@example.iam.gserviceaccount.com',
  privateKey: 'unused in these tests',
  classPrefix: 'volvia_test',
  origins: ['http://localhost:3002'],
}

const orgId = '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b'

const content: PassContent = {
  serial: 'abc123def456ghi789',
  organizationName: 'Burger Train',
  cardName: 'Club BT',
  stampsCount: 4,
  stampsRequired: 8,
  rewardTitle: 'Hamburguesa gratis',
  rewardDescription: 'La que quieras del menú',
  pendingRewardCount: 0,
  terms: '',
  logoUrl: null,
  bannerUrl: null,
  backgroundColor: '#14161B',
  foregroundColor: '#FFFFFF',
  labelColor: '#F5B841',
  cardUrl: 'http://localhost:3002/c/abc123def456ghi789',
  places: [
    { latitude: 10.46, longitude: -73.25 },
    { latitude: 4.6097, longitude: -74.0817 },
  ],
  offerMessage: null,
  latestMessage: null,
  locale: 'es',
  updatedAt: new Date('2026-09-02T15:00:00Z'),
}

describe('google loyalty object', () => {
  it('derives ids Google accepts: one class per business, one object per serial', () => {
    expect(classId(config, orgId)).toBe(
      '3388000000000000000.volvia_test_0f1e2d3c4b5a69788a9b0c1d2e3f4a5b',
    )
    expect(objectId(config, 'ab c/1!2')).toBe('3388000000000000000.abc12')
  })

  it('pins the branches as merchantLocations, the field that still triggers nearby alerts', () => {
    const object = buildLoyaltyObject(config, content, orgId)
    expect(object.merchantLocations).toEqual([
      { latitude: 10.46, longitude: -73.25 },
      { latitude: 4.6097, longitude: -74.0817 },
    ])
    // The old key is deprecated and silently ignored for geofencing; it must not creep back.
    expect(object).not.toHaveProperty('locations')
  })

  it('sends an empty list when the business has no pins, so a removed pin clears on patch', () => {
    const object = buildLoyaltyObject(config, { ...content, places: [] }, orgId)
    expect(object.merchantLocations).toEqual([])
  })
})
