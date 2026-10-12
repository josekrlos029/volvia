import { describe, expect, it } from 'vitest'
import { imageVersion } from '../src/images'
import { EMPTY_ARTWORK, stripSvg } from '../src/render/svg'
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
  cycleIndex: 0,
  lastStampAt: null,
  headline: '',
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
  latestMessage: null,
  customerName: '',
  about: '',
  links: [],
  place: null,
  promoImageUrl: null,
  locale: 'es',
  updatedAt: new Date('2026-10-10T15:00:00Z'),
}

const offer = (overrides: Partial<NonNullable<PassContent['offer']>>) => ({
  message: 'Hoy sellos dobles',
  headerLabel: null,
  text: null,
  banner: null,
  hideStamps: false,
  endsAt: null,
  ...overrides,
})

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

/**
 * A campaign takes the strip over: a preset is drawn in the card's colours, an upload
 * is cropped behind the grid, and "hidden" stamps leave only a progress pill. Through
 * all of it the stamp count stays visible somewhere.
 */
describe('strip with a live offer', () => {
  it('draws a preset banner with paths, under the stamps', () => {
    const plain = stripSvg(content, 375, 123)
    const starry = stripSvg(
      { ...content, offer: offer({ banner: { kind: 'preset', value: 'stars' } }) },
      375,
      123,
    )
    expect(starry).not.toBe(plain)
    expect(starry).toContain('<path')
    expect(starry).not.toContain('url(#dots)')
    // The grid is still there: four filled slots on the accent.
    expect(starry.match(/<rect[^>]*fill="#D9A566"\/>/g)).toHaveLength(4)
  })

  it('puts an uploaded picture behind the grid with a scrim, and alone when the grid hides', () => {
    const artwork = { ...EMPTY_ARTWORK, banner: { mime: 'image/png' as const, dataUri: pixel } }
    const withGrid = stripSvg(
      { ...content, offer: offer({ banner: { kind: 'image', url: 'https://cdn/x.png' } }) },
      375,
      123,
      artwork,
    )
    expect(withGrid).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(withGrid).toContain('fill-opacity="0.35"')

    const alone = stripSvg(
      {
        ...content,
        offer: offer({ banner: { kind: 'image', url: 'https://cdn/x.png' }, hideStamps: true }),
      },
      375,
      123,
      artwork,
    )
    expect(alone).not.toContain('fill-opacity="0.35"')
  })

  it('falls back to the plain strip when the upload could not be fetched', () => {
    const svg = stripSvg(
      { ...content, offer: offer({ banner: { kind: 'image', url: 'https://cdn/x.png' } }) },
      375,
      123,
    )
    expect(svg).not.toContain('<image')
    expect(svg).toContain('url(#dots)')
  })

  it('hides the grid behind a pill that still shows the count', () => {
    const svg = stripSvg({ ...content, offer: offer({ hideStamps: true }) }, 375, 123)
    // No full-size slots, but ten small dots: four lit on the accent, six faint.
    expect(svg).not.toContain('stroke-dasharray')
    expect(svg.match(/<circle[^>]*fill="#D9A566"[^>]*fill-opacity="1"/g)).toHaveLength(4)
    expect(svg.match(/<circle[^>]*fill-opacity="0.3"/g)).toHaveLength(6)
  })

  it('rolls the image version when the banner or the grid visibility changes', () => {
    const base = imageVersion(content)
    expect(
      imageVersion({ ...content, offer: offer({ banner: { kind: 'preset', value: 'gift' } }) }),
    ).not.toBe(base)
    expect(imageVersion({ ...content, offer: offer({ hideStamps: true }) })).not.toBe(base)
    // Words alone do not: the text lives in the pass, not in the picture.
    expect(imageVersion({ ...content, offer: offer({ headerLabel: 'DOBLE' }) })).toBe(base)
  })
})
