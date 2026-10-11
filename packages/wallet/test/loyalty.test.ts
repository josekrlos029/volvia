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
  customerName: 'Laura',
  about: 'Hamburguesas a la parrilla desde 2014.',
  links: [
    {
      id: 'instagram-0',
      label: 'Instagram',
      url: 'https://instagram.com/burgertrain',
      kind: 'web',
    },
    {
      id: 'maps',
      label: 'Cómo llegar',
      url: 'https://maps.google.com/?q=10.46,-73.25',
      kind: 'maps',
    },
    { id: 'phone', label: 'Teléfono', url: 'tel:+573001234567', kind: 'phone' },
  ],
  place: {
    address: 'Calle 12 #4-56',
    city: 'Valledupar',
    hours: [
      { day: 1, opens: '09:00', closes: '18:00' },
      { day: 2, opens: '09:00', closes: '18:00' },
      { day: 6, opens: '10:00', closes: '14:00' },
    ],
  },
  promoImageUrl: null,
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

  it('names the customer as the account holder, and the business when the name is unknown', () => {
    expect(buildLoyaltyObject(config, content, orgId).accountName).toBe('Laura')
    expect(buildLoyaltyObject(config, { ...content, customerName: '' }, orgId).accountName).toBe(
      'Burger Train',
    )
  })

  it("lists the business's links before the Volvia card link, each with an id", () => {
    const object = buildLoyaltyObject(config, content, orgId) as {
      linksModuleData: { uris: Array<{ id: string; uri: string; description: string }> }
    }
    expect(object.linksModuleData.uris.map((uri) => uri.id)).toEqual([
      'instagram-0',
      'maps',
      'phone',
      'card',
    ])
    expect(object.linksModuleData.uris[2]).toEqual({
      id: 'phone',
      uri: 'tel:+573001234567',
      description: 'Teléfono',
    })
    expect(object.linksModuleData.uris[3]!.uri).toBe(content.cardUrl)
  })

  it('adds hours, about and terms as text modules, clipped to what Google shows', () => {
    const object = buildLoyaltyObject(
      config,
      { ...content, terms: 'Una recompensa por visita.' },
      orgId,
    ) as { textModulesData: Array<{ id: string; header: string; body: string }> }
    expect(object.textModulesData.map((module) => module.id)).toEqual([
      'reward',
      'hours',
      'about',
      'terms',
    ])
    expect(object.textModulesData[1]).toEqual({
      id: 'hours',
      header: 'Horario',
      body: 'Lun–Mar 9:00–18:00\nSáb 10:00–14:00',
    })
    expect(object.textModulesData[2]!.header).toBe('Burger Train')

    const long = buildLoyaltyObject(config, { ...content, about: 'x'.repeat(600) }, orgId) as {
      textModulesData: Array<{ id: string; body: string }>
    }
    const about = long.textModulesData.find((module) => module.id === 'about')!
    expect(about.body).toHaveLength(500)
    expect(about.body.endsWith('…')).toBe(true)

    const bare = buildLoyaltyObject(config, { ...content, about: '', place: null }, orgId) as {
      textModulesData: Array<{ id: string }>
    }
    expect(bare.textModulesData.map((module) => module.id)).toEqual(['reward'])
  })

  it('carries the promotional picture as an image module, and an empty list without one', () => {
    const withCover = buildLoyaltyObject(
      config,
      { ...content, promoImageUrl: 'https://cdn.example/cover.jpg' },
      orgId,
    ) as { imageModulesData: Array<{ id: string; mainImage: { sourceUri: { uri: string } } }> }
    expect(withCover.imageModulesData[0]!.id).toBe('promo')
    expect(withCover.imageModulesData[0]!.mainImage.sourceUri.uri).toBe(
      'https://cdn.example/cover.jpg',
    )
    expect(buildLoyaltyObject(config, content, orgId).imageModulesData).toEqual([])
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
