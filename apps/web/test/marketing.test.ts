import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALES, copyFor, isLocale, site } from '../src/lib/i18n'
import { industries, industryCopy } from '../src/lib/industries'

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

describe('marketing copy', () => {
  it('has the same keys in every language', () => {
    expect(shape(site.en)).toEqual(shape(site.es))
  })

  it('answers with Spanish for anything that is not a language we publish', () => {
    expect(isLocale('es')).toBe(true)
    expect(isLocale('pt')).toBe(false)
    expect(copyFor(DEFAULT_LOCALE)).toBe(site.es)
  })

  it('invites visitors to create an account, not to sign in', () => {
    // The sign-up page did not exist and every call to action pointed at /login,
    // which is the one thing a visitor without an account cannot use.
    for (const locale of LOCALES) {
      expect(copyFor(locale).nav.cta).not.toMatch(/entrar|sign in/i)
    }
  })
})

describe('industry pages', () => {
  it('gives every industry a unique slug', () => {
    const slugs = industries.map((industry) => industry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('writes real copy for each industry in both languages', () => {
    for (const industry of industries) {
      for (const locale of LOCALES) {
        const copy = industryCopy(industry, locale)
        expect(copy.name.length, industry.slug).toBeGreaterThan(2)
        expect(copy.headline.length, industry.slug).toBeGreaterThan(10)
        expect(copy.intro.length, industry.slug).toBeGreaterThan(40)
        expect(copy.stamps, industry.slug).toBeGreaterThan(0)
      }
    }
  })

  it('uses slugs that are safe in a URL', () => {
    for (const industry of industries) {
      expect(industry.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
