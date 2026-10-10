import { describe, expect, it } from 'vitest'
import { contrastRatio, readableOn, relativeLuminance } from '../src/color'
import { STAMP_PRESETS } from '../src/schemas/card'
import { STAMP_ICON_PATHS, stampIconPath } from '../src/stamp-icons'

describe('contrast', () => {
  it('matches the WCAG reference points', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#FFF', '#fff')).toBeCloseTo(1, 5)
  })

  it('picks the card colour that reads on the accent, whichever it is', () => {
    // Café Raíces: pale gold accent, dark card. The dark background wins (7.7:1 vs 2.1:1).
    expect(readableOn('#D9A566', ['#2B1D14', '#FFFFFF'])).toBe('#2B1D14')
    expect(contrastRatio('#D9A566', '#2B1D14')).toBeGreaterThan(7)
    // Burger Train: red-orange accent. The dark card still wins, but white stays legible.
    expect(readableOn('#E4572E', ['#141414', '#FFFFFF'])).toBe('#141414')
    // A deep accent flips the choice to the light foreground.
    expect(readableOn('#1E3A8A', ['#0F1E30', '#FFFFFF'])).toBe('#FFFFFF')
  })
})

describe('stamp icons', () => {
  it('has a glyph for every preset the schema accepts', () => {
    for (const preset of STAMP_PRESETS) {
      expect(STAMP_ICON_PATHS[preset], preset).toMatch(/^M/)
    }
  })

  it('falls back to a preset for emoji and custom images, which need a font or a fetch', () => {
    expect(stampIconPath({ kind: 'emoji', value: '☕' })).toBe(STAMP_ICON_PATHS.star)
    expect(stampIconPath({ kind: 'image', value: 'https://x/y.png' }, 'coffee')).toBe(
      STAMP_ICON_PATHS.coffee,
    )
  })
})
