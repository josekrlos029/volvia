import { describe, expect, it } from 'vitest'
import { resolveEntitlements } from '../src/entitlements'
import { PLANS, PREMIUM_TRIAL_CUSTOMER_LIMIT } from '../src/plans'
import { orgSettingsSchema } from '../src/schemas/org'
import { pageItemSchema, replacePageModuleSchema } from '../src/schemas/page'

describe('public page content', () => {
  it('accepts a menu with sections and priced items, and fills the rest with nulls', () => {
    const parsed = replacePageModuleSchema.parse({
      sections: [
        { title: 'Entradas', items: [{ title: 'Empanadas', priceAmount: 350000 }] },
        {
          title: 'Bebidas',
          items: [{ title: 'Limonada', description: 'De coco', priceAmount: 800000 }],
        },
      ],
    })
    expect(parsed.sections).toHaveLength(2)
    expect(parsed.sections[0]!.items[0]).toMatchObject({
      title: 'Empanadas',
      priceAmount: 350000,
      imageUrl: null,
      askVia: null,
      isActive: true,
    })
  })

  it('refuses what the page cannot show: an empty title, a bad link, a negative price', () => {
    expect(() => pageItemSchema.parse({ title: '' })).toThrow()
    expect(() => pageItemSchema.parse({ title: 'x', buttonUrl: 'not a url' })).toThrow()
    expect(() => pageItemSchema.parse({ title: 'x', priceAmount: -1 })).toThrow()
    expect(() => pageItemSchema.parse({ title: 'x', askVia: 'carrier pigeon' })).toThrow()
  })

  it('keeps old settings rows valid and defaults the page extras', () => {
    const settings = orgSettingsSchema.parse({})
    expect(settings.pageAccentColor).toBeNull()
    expect(settings.guestWifi).toBeNull()
    expect(settings.reservationsUrl).toBe('')
    expect(settings.pageShowReviews).toBe(true)
    expect(
      orgSettingsSchema.parse({ guestWifi: { ssid: 'Cafe Raices', password: 'tinto2026' } })
        .guestWifi,
    ).toEqual({ ssid: 'Cafe Raices', password: 'tinto2026' })
    expect(() => orgSettingsSchema.parse({ reservationsUrl: 'reservas' })).toThrow()
  })

  it('gates the catalogue at Business, open during the trial', () => {
    expect(PLANS.pro.features).not.toContain('page_catalogue')
    expect(PLANS.business.features).toContain('page_catalogue')
    const trial = resolveEntitlements({
      plan: 'free',
      subscriptionActive: false,
      totalCustomers: 3,
      extraLocations: 0,
    })
    expect(trial.has('page_catalogue')).toBe(true)
    const past = resolveEntitlements({
      plan: 'free',
      subscriptionActive: false,
      totalCustomers: PREMIUM_TRIAL_CUSTOMER_LIMIT,
      extraLocations: 0,
    })
    expect(past.has('page_catalogue')).toBe(false)
    expect(past.upgradeForFeature('page_catalogue')).toBe('business')
  })
})
