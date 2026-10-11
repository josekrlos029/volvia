import { describe, expect, it } from 'vitest'
import {
  type PassLocation,
  passLinksFor,
  pinsOf,
  primaryPlaceOf,
} from '../src/modules/wallet/pass-details'

const branch = (overrides: Partial<PassLocation> = {}): PassLocation => ({
  address: null,
  city: null,
  phone: null,
  latitude: null,
  longitude: null,
  hours: [],
  ...overrides,
})

describe('primaryPlaceOf', () => {
  it('picks the oldest branch with an address', () => {
    const rows = [
      branch({ phone: '3001'.padEnd(10, '0') }),
      branch({ address: 'Calle 1' }),
      branch({ address: 'Calle 2' }),
    ]
    expect(primaryPlaceOf(rows)).toBe(rows[1])
  })

  it('falls back to one with hours or a phone, then to the first, then to nothing', () => {
    const withHours = branch({ hours: [{ day: 1, opens: '09:00', closes: '18:00' }] })
    expect(primaryPlaceOf([branch(), withHours])).toBe(withHours)
    const bare = branch()
    expect(primaryPlaceOf([bare])).toBe(bare)
    expect(primaryPlaceOf([])).toBeNull()
  })
})

describe('pinsOf', () => {
  it('keeps only whole pins, at most ten, oldest first', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      branch({ latitude: index + 1, longitude: -(index + 1) }),
    )
    rows.splice(1, 0, branch({ latitude: 5 }))
    const pins = pinsOf(rows)
    expect(pins).toHaveLength(10)
    expect(pins[0]).toEqual({ latitude: 1, longitude: -1 })
    expect(pins[1]).toEqual({ latitude: 2, longitude: -2 })
  })
})

describe('passLinksFor', () => {
  const base = {
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com/burgertrain' },
      { platform: 'menu', url: 'https://burgertrain.co/carta', label: 'Carta de temporada' },
    ],
    contactPhone: '+57 300 123 4567',
    contactEmail: 'hola@burgertrain.co',
    place: branch({
      address: 'Calle 12 #4-56',
      city: 'Valledupar',
      latitude: 10.46,
      longitude: -73.25,
    }),
    locale: 'es' as const,
  }

  it("keeps the business's order, then directions, phone and email", () => {
    const links = passLinksFor(base)
    expect(links.map((link) => link.id)).toEqual([
      'instagram-0',
      'menu-1',
      'maps',
      'phone',
      'email',
    ])
    expect(links[0]).toMatchObject({ label: 'Instagram', kind: 'web' })
    expect(links[1]!.label).toBe('Carta de temporada')
    expect(links[2]).toEqual({
      id: 'maps',
      label: 'Cómo llegar',
      url: 'https://maps.google.com/?q=10.46,-73.25',
      kind: 'maps',
    })
    expect(links[3]).toEqual({
      id: 'phone',
      label: 'Teléfono',
      url: 'tel:+573001234567',
      kind: 'phone',
    })
    expect(links[4]).toEqual({
      id: 'email',
      label: 'Correo',
      url: 'mailto:hola@burgertrain.co',
      kind: 'email',
    })
  })

  it('points directions at the address when the branch has no pin', () => {
    const links = passLinksFor({
      ...base,
      place: branch({ address: 'Calle 12 #4-56', city: 'Valledupar' }),
    })
    expect(links.find((link) => link.id === 'maps')!.url).toBe(
      'https://maps.google.com/?q=Calle%2012%20%234-56%2C%20Valledupar',
    )
  })

  it("prefers the branch's phone, and drops a number too short to dial", () => {
    const branchPhone = passLinksFor({ ...base, place: branch({ phone: '(605) 574 1234' }) })
    expect(branchPhone.find((link) => link.id === 'phone')!.url).toBe('tel:6055741234')
    const short = passLinksFor({ ...base, place: null, contactPhone: '12' })
    expect(short.find((link) => link.id === 'phone')).toBeUndefined()
  })

  it('speaks the customer language and caps the list at eight', () => {
    const many = passLinksFor({
      ...base,
      locale: 'en',
      socialLinks: Array.from({ length: 9 }, (_, index) => ({
        platform: 'website',
        url: `https://site${index}.co`,
      })),
    })
    expect(many).toHaveLength(8)
    expect(many[0]!.label).toBe('Website')
    expect(many.some((link) => link.kind === 'phone')).toBe(false)
  })

  it('is empty when the business set nothing up', () => {
    expect(
      passLinksFor({
        socialLinks: [],
        contactPhone: null,
        contactEmail: null,
        place: null,
        locale: 'es',
      }),
    ).toEqual([])
  })
})
