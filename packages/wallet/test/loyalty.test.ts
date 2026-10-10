import { describe, expect, it } from 'vitest'
import {
  type GoogleWalletConfig,
  buildLoyaltyClass,
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
  rewardPositions: [4, 8],
  nextRewardAt: 8,
  cycleIndex: 0,
  lastStampAt: new Date('2026-09-01T18:30:00Z'),
  headline: 'Club Burger Train',
  terms: '',
  logoUrl: null,
  bannerUrl: null,
  backgroundColor: '#14161B',
  foregroundColor: '#FFFFFF',
  labelColor: '#F5B841',
  emptyStampColor: '#31363A',
  stampIcon: { kind: 'preset', value: 'burger' },
  stampStyle: 'circle',
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

  it('shows the stamps as the balance and the reward as the second one', () => {
    const object = buildLoyaltyObject(config, content, orgId) as {
      loyaltyPoints: { label: string; balance: { string: string } }
      secondaryLoyaltyPoints: { label: string; balance: { string: string } }
      textModulesData: Array<{ id: string; header: string; body: string }>
      heroImage?: unknown
    }
    expect(object.loyaltyPoints.balance.string).toBe('4 / 8')
    expect(object.secondaryLoyaltyPoints).toEqual({
      label: 'Próxima recompensa',
      balance: { string: 'Hamburguesa gratis' },
    })
    expect(object.textModulesData[0]).toEqual({
      id: 'reward',
      header: 'Te faltan',
      body: '4 sellos · Hamburguesa gratis',
    })
    expect(object.heroImage).toBeUndefined()
  })

  it('flips to the reward once it is earned, and names the lap from the second one', () => {
    const earned = buildLoyaltyObject(
      config,
      { ...content, stampsCount: 0, pendingRewardCount: 1, cycleIndex: 1 },
      orgId,
    ) as {
      secondaryLoyaltyPoints: { balance: { string: string } }
      textModulesData: Array<{ body: string }>
    }
    expect(earned.secondaryLoyaltyPoints.balance.string).toBe('¡Listo para reclamar!')
    expect(earned.textModulesData[0]!.body).toBe('Hamburguesa gratis')

    const lap = buildLoyaltyObject(config, { ...content, cycleIndex: 2 }, orgId) as {
      textModulesData: Array<{ body: string }>
    }
    expect(lap.textModulesData[0]!.body).toBe('4 sellos · Hamburguesa gratis · Vuelta 3')
  })

  it('carries the stamp grid as the hero image, on the object because it is per customer', () => {
    const object = buildLoyaltyObject(config, content, orgId, {
      heroImageUrl: 'https://api.example/wallet/google/images/abc/hero.png?v=1',
    }) as { heroImage: { sourceUri: { uri: string } } }
    expect(object.heroImage.sourceUri.uri).toContain('/hero.png')
  })

  it('puts the lockup in the class as the wide logo, which replaces the round one in the header', () => {
    const loyaltyClass = buildLoyaltyClass(config, {
      orgId,
      organizationName: 'Burger Train',
      backgroundColor: '#14161B',
      images: {
        wideProgramLogoUrl: 'https://api.example/lockup.png?v=1',
        programLogoUrl: 'https://api.example/logo.png?v=1',
      },
    }) as {
      wideProgramLogo: { sourceUri: { uri: string } }
      programLogo: { sourceUri: { uri: string } }
    }
    expect(loyaltyClass.wideProgramLogo.sourceUri.uri).toContain('lockup.png')
    expect(loyaltyClass.programLogo.sourceUri.uri).toContain('logo.png')
  })
})
