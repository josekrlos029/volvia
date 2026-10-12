import { describe, expect, it } from 'vitest'
import { phoneSchema } from '../src/schemas/common'
import { joinCardSchema, profileQuestionSchema } from '../src/schemas/customer'
import { BUSINESS_CATEGORIES } from '../src/schemas/org'
import { SIGNUP_PRESETS, presetsFor } from '../src/signup-presets'

describe('phoneSchema', () => {
  it('keeps the digits and the country sign, drops the punctuation people type', () => {
    expect(phoneSchema.parse('+57 300 123 4567')).toBe('+573001234567')
    expect(phoneSchema.parse('(300) 123-4567')).toBe('3001234567')
  })

  it('rejects letters and numbers too short to dial', () => {
    expect(() => phoneSchema.parse('llámame')).toThrow()
    expect(() => phoneSchema.parse('12345')).toThrow()
  })

  it('is optional on the join form and blank means nothing given', () => {
    expect(joinCardSchema.parse({ firstName: 'Ana', email: 'a@b.co' }).phone).toBeNull()
    expect(joinCardSchema.parse({ firstName: 'Ana', email: 'a@b.co', phone: '' }).phone).toBeNull()
    expect(
      joinCardSchema.parse({ firstName: 'Ana', email: 'a@b.co', phone: '300 123 4567' }).phone,
    ).toBe('3001234567')
  })
})

describe('signup presets', () => {
  it('offers something for every kind of business, ending with the shared ones', () => {
    for (const category of BUSINESS_CATEGORIES) {
      const keys = presetsFor(category).map((preset) => preset.key)
      expect(keys.length, category).toBeGreaterThan(1)
      expect(keys, category).toContain('how_found')
      expect(keys, category).toContain('last_name')
      expect(new Set(keys).size, category).toBe(keys.length)
    }
    expect(presetsFor('something_unknown').map((preset) => preset.key)).toEqual(
      SIGNUP_PRESETS.any.map((preset) => preset.key),
    )
  })

  it('writes questions the form accepts as they are, with no duplicates', () => {
    for (const [category, presets] of Object.entries(SIGNUP_PRESETS)) {
      const keys = presets.map((preset) => preset.key)
      expect(new Set(keys).size, category).toBe(keys.length)
      for (const preset of presets) {
        expect(() => profileQuestionSchema.parse(preset), `${category}/${preset.key}`).not.toThrow()
        if (preset.type === 'single_choice') expect(preset.options.length).toBeGreaterThan(1)
      }
    }
  })

  it('keeps an id on a question being edited, and none on a new one', () => {
    const edited = profileQuestionSchema.parse({
      id: '5a1e7c1e-3f6a-4f1e-9c4a-2b1d8e7f6a5b',
      prompt: 'Tu plato favorito',
    })
    expect(edited.id).toBe('5a1e7c1e-3f6a-4f1e-9c4a-2b1d8e7f6a5b')
    expect(profileQuestionSchema.parse({ prompt: 'Tu plato favorito' }).id).toBeUndefined()
  })
})
