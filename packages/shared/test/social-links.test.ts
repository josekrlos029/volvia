import { describe, expect, it } from 'vitest'
import { socialLinkLabel } from '../src/social-links'

describe('socialLinkLabel', () => {
  it("prefers the business's own wording", () => {
    expect(socialLinkLabel({ platform: 'menu', label: 'Carta de vinos' }, 'es')).toBe(
      'Carta de vinos',
    )
    expect(socialLinkLabel({ platform: 'menu', label: '   ' }, 'es')).toBe('Menú')
  })

  it('names the platform in the reader language otherwise', () => {
    expect(socialLinkLabel({ platform: 'website' }, 'es')).toBe('Sitio web')
    expect(socialLinkLabel({ platform: 'website' }, 'en')).toBe('Website')
    expect(socialLinkLabel({ platform: 'unknown' }, 'es')).toBe('unknown')
  })
})
