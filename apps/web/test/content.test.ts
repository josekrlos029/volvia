import { describe, expect, it } from 'vitest'
import { benchmarks } from '../src/lib/benchmarks'
import { comparisons } from '../src/lib/comparisons'
import { faq } from '../src/lib/faq'
import { features } from '../src/lib/features'
import { glossary } from '../src/lib/glossary'
import { LOCALES } from '../src/lib/i18n'
import { industries } from '../src/lib/industries'
import { playbook } from '../src/lib/playbook'
import { templates } from '../src/lib/templates'

/**
 * The marketing site is content, and content rots quietly: a slug that stops matching,
 * a page that exists in Spanish and not in English, an internal link to something that
 * was renamed. None of that breaks a build, so it is checked here.
 */
const collections = [
  ['features', features],
  ['industries', industries],
  ['comparisons', comparisons],
  ['glossary', glossary],
  ['benchmarks', benchmarks],
  ['faq', faq],
  ['playbook', playbook],
  ['templates', templates],
] as const

describe('every collection is complete in both languages', () => {
  it.each(collections)('%s', (_name, entries) => {
    for (const entry of entries) {
      for (const locale of LOCALES) {
        expect(entry[locale], JSON.stringify(entry).slice(0, 60)).toBeDefined()
      }
    }
  })

  it('uses url-safe slugs with no duplicates', () => {
    for (const [, entries] of collections) {
      const slugs = entries
        .map((entry) => ('slug' in entry ? entry.slug : 'id' in entry ? entry.id : ''))
        .filter(Boolean)
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
      expect(new Set(slugs).size, slugs.join(',')).toBe(slugs.length)
    }
  })
})

describe('internal links point at pages that exist', () => {
  it('every feature’s related list resolves', () => {
    const slugs = new Set(features.map((feature) => feature.slug))
    for (const feature of features) {
      for (const related of feature.related) {
        expect(slugs.has(related), `${feature.slug} → ${related}`).toBe(true)
      }
      // A page that links only to itself is not related to anything.
      expect(feature.related).not.toContain(feature.slug)
    }
  })

  it('every template points at industries that exist', () => {
    const slugs = new Set(industries.map((industry) => industry.slug))
    for (const template of templates) {
      for (const industry of template.industries) {
        expect(slugs.has(industry), `${template.slug} → ${industry}`).toBe(true)
      }
    }
  })
})

describe('the pages are worth indexing', () => {
  it('covers the seventeen trades the site claims', () => {
    expect(industries).toHaveLength(17)
  })

  it('gives every feature a page with real copy', () => {
    expect(features.length).toBeGreaterThanOrEqual(9)
    for (const feature of features) {
      for (const locale of LOCALES) {
        const copy = feature[locale]
        expect(copy.title.length, feature.slug).toBeGreaterThan(20)
        expect(copy.description.length, feature.slug).toBeGreaterThan(80)
        // A description Google truncates is a description nobody wrote on purpose.
        expect(copy.description.length, feature.slug).toBeLessThan(200)
        expect(copy.details.length, feature.slug).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('admits where each feature does not help', () => {
    // A page that only praises itself is not read as information.
    for (const feature of features) {
      for (const locale of LOCALES) {
        expect(feature[locale].caveat.length, feature.slug).toBeGreaterThan(60)
      }
    }
  })

  it('lets the alternative win something in every comparison', () => {
    for (const comparison of comparisons) {
      for (const locale of LOCALES) {
        const copy = comparison[locale]
        expect(copy.theirStrengths.length, comparison.slug).toBeGreaterThanOrEqual(3)
        expect(copy.verdict.forThem.length, comparison.slug).toBeGreaterThan(40)
      }
    }
  })

  it('says where every reference number comes from', () => {
    for (const benchmark of benchmarks) {
      expect(['observed', 'arithmetic', 'rule-of-thumb']).toContain(benchmark.basis)
      for (const locale of LOCALES) {
        expect(benchmark[locale].note.length, benchmark.id).toBeGreaterThan(40)
      }
    }
  })

  it('gives every playbook step a mistake and a way to check it', () => {
    for (const step of playbook) {
      for (const locale of LOCALES) {
        expect(step[locale].mistake.length, step.id).toBeGreaterThan(40)
        expect(step[locale].check.length, step.id).toBeGreaterThan(20)
      }
    }
  })

  it('answers the awkward questions, not only the easy ones', () => {
    const answers = faq.map((entry) => entry.es.answer).join(' ')
    // If no answer ever says "not yet" or "no", the FAQ is an advertisement.
    expect(answers).toMatch(/todavía no|No\./)
  })
})
