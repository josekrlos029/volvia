import { describe, expect, it } from 'vitest'
import { GOOGLE_IMAGE_SIZES, imageVersion, renderGoogleImage } from '../src/images'
import { fillsSquare, renderPng } from '../src/render/raster'
import { lockupSvg, stripSvg, tileSvg } from '../src/render/svg'
import type { PassContent } from '../src/types'

const content: PassContent = {
  serial: 'abc123def456ghi789',
  organizationName: 'Café Raíces',
  cardName: 'Tarjeta Raíces',
  stampsCount: 4,
  stampsRequired: 10,
  rewardTitle: 'Café gratis',
  rewardDescription: 'Cualquier bebida de la carta',
  pendingRewardCount: 0,
  rewardPositions: [10],
  nextRewardAt: 10,
  cycleIndex: 1,
  lastStampAt: null,
  headline: 'Tu décimo café va por la casa',
  terms: '',
  logoUrl: null,
  bannerUrl: null,
  backgroundColor: '#2B1D14',
  foregroundColor: '#FFFFFF',
  labelColor: '#D9A566',
  emptyStampColor: '#3A3A3A',
  stampIcon: { kind: 'preset', value: 'coffee' },
  stampStyle: 'circle',
  cardUrl: 'http://localhost:3002/c/abc123def456ghi789',
  places: [],
  offer: null,
  nearbyMessage: null,
  latestMessage: null,
  customerName: '',
  about: '',
  links: [],
  place: null,
  promoImageUrl: null,
  locale: 'es',
  updatedAt: new Date('2026-10-10T15:00:00Z'),
}

/** A text-only offer, as a campaign with no visual override produces. */
const offerOf = (message: string): NonNullable<PassContent['offer']> => ({
  message,
  headerLabel: null,
  text: null,
  banner: null,
  hideStamps: false,
  endsAt: null,
})

const pngSize = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)]

describe('strip', () => {
  it('draws one slot per stamp, filled ones on the accent with a readable mark', () => {
    const svg = stripSvg(content, 375, 123)
    expect(svg.match(/<rect[^>]*fill="#D9A566"/g)).toHaveLength(4)
    // The coffee mark on pale gold is drawn in the card's dark background, not white.
    expect(svg).toContain('stroke="#2B1D14"')
    // The five plain empties keep the mark faintly; the tenth is the reward slot.
    expect(svg.match(/stroke-opacity="0.18"/g)).toHaveLength(5)
  })

  it('marks the reward slot with a gift until it is reached, then fills it like the rest', () => {
    const waiting = stripSvg(content, 375, 123)
    expect(waiting).toContain('stroke-dasharray')

    const reached = stripSvg({ ...content, stampsCount: 10 }, 375, 123)
    expect(reached).not.toContain('stroke-dasharray')
    expect(reached.match(/<rect[^>]*fill="#D9A566"/g)).toHaveLength(10)
  })

  it('never writes text, so no font has to ship with the renderer', () => {
    for (const svg of [
      stripSvg(content, 375, 123),
      lockupSvg(content, 135, 50),
      tileSvg(content, 29),
    ]) {
      expect(svg).not.toContain('<text')
    }
  })

  it('falls back to a drawn preset for emoji icons, which would need an emoji font', () => {
    const svg = stripSvg({ ...content, stampIcon: { kind: 'emoji', value: '☕' } }, 375, 123)
    expect(svg).toContain('<path d="M12 2l3.09') // the star
  })
})

describe('lockup', () => {
  it('carries the Volvia mark and the business side by side on a transparent ground', () => {
    const svg = lockupSvg(content, 135, 50)
    expect(svg).toContain('fill="#1E3A8A"')
    expect(svg).toContain('data:image/png;base64,')
    expect(svg).not.toMatch(/<rect width="135" height="50"/)
  })

  it('uses the uploaded logo when there is one, and the stamp icon on the accent when not', () => {
    const plain = lockupSvg(content, 135, 50)
    expect(plain).toContain('fill="#D9A566"')

    const logo = { mime: 'image/png' as const, dataUri: 'data:image/png;base64,AAAA' }
    const branded = lockupSvg(content, 135, 50, { logo, stampIcon: null, banner: null })
    expect(branded).toContain('href="data:image/png;base64,AAAA"')
  })

  it('lets a badge-shaped logo fill its tile instead of framing it a second time', () => {
    const png = (w: number, h: number, body: string) =>
      `data:image/png;base64,${renderPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`, w).toString('base64')}`
    const badge = png(100, 100, '<rect width="100" height="100" rx="18" fill="#111"/>')
    const floating = png(100, 100, '<circle cx="50" cy="50" r="30" fill="#111"/>')
    const wide = png(300, 100, '<rect width="300" height="100" fill="#111"/>')
    expect(fillsSquare(badge)).toBe(true)
    expect(fillsSquare(floating)).toBe(false)
    expect(fillsSquare(wide)).toBe(false)

    const logo = { mime: 'image/png' as const, dataUri: badge, fillsFrame: true }
    const svg = lockupSvg(content, 135, 50, { logo, stampIcon: null, banner: null })
    expect(svg).toContain('<clipPath')
    expect(svg).not.toContain('fill-opacity="0.1"')
  })
})

describe('google images', () => {
  it('renders each kind at the size Google documents', () => {
    expect(pngSize(renderGoogleImage('hero', content))).toEqual([1032, 336])
    expect(pngSize(renderGoogleImage('lockup', content))).toEqual([1032, 336])
    expect(pngSize(renderGoogleImage('logo', content))).toEqual([660, 660])
    expect(GOOGLE_IMAGE_SIZES.hero.width / GOOGLE_IMAGE_SIZES.hero.height).toBeCloseTo(3.07, 1)
  })

  it('changes the image version on every stamp and on a design change, and only then', () => {
    const base = imageVersion(content)
    expect(imageVersion({ ...content, stampsCount: 5 })).not.toBe(base)
    expect(imageVersion({ ...content, labelColor: '#E4572E' })).not.toBe(base)
    expect(imageVersion({ ...content, offer: offerOf('Hoy sellos dobles') })).toBe(base)
    expect(imageVersion({ ...content, updatedAt: new Date() })).toBe(base)
    // What the back of the pass says is text, not pixels: it must not roll the URLs.
    expect(
      imageVersion({
        ...content,
        customerName: 'Laura',
        about: 'Café de origen',
        links: [{ id: 'website-0', label: 'Sitio web', url: 'https://raices.co', kind: 'web' }],
        promoImageUrl: 'https://cdn.example/cover.jpg',
      }),
    ).toBe(base)
  })
})
