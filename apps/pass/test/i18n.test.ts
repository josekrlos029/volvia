import { describe, expect, it } from 'vitest'
import { copy, t } from '../src/lib/i18n'

/**
 * Locale parity for the customer-facing copy.
 *
 * The customer never picks the language: they scan a QR and get whatever the business
 * configured. A key that exists only in Spanish would render as `undefined` on a real
 * card in someone's hand, so the two trees have to match exactly.
 */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return `array(${value.length})`
  if (typeof value === 'function') return 'function'
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, nested]) => [key, shape(nested)] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    )
  }
  return typeof value
}

describe('customer-facing copy', () => {
  it('has the same keys in every language', () => {
    expect(shape(copy.en)).toEqual(shape(copy.es))
  })

  it('leaves no string empty', () => {
    const empties: string[] = []
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string' && value.trim() === '') empties.push(path)
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, nested] of Object.entries(value)) walk(nested, `${path}.${key}`)
      }
    }
    walk(copy, 'copy')
    expect(empties).toEqual([])
  })

  it('falls back to Spanish for a language we do not have', () => {
    expect(t('pt')).toBe(copy.es)
    expect(t(undefined)).toBe(copy.es)
  })

  it('serves English when the business is set to English', () => {
    expect(t('en').card.nextReward).toBe('Next reward')
  })

  it('names the survey screens the card now shows', () => {
    for (const locale of [copy.es, copy.en]) {
      expect(locale.survey.submit.length).toBeGreaterThan(0)
      expect(locale.survey.reviewCta.length).toBeGreaterThan(0)
      expect(locale.survey.ratingLegend(5)).toContain('5')
    }
  })
})
