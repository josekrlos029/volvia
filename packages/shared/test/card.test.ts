import { describe, expect, it } from 'vitest'
import { MAX_CARD_MESSAGE_VARIANTS, MAX_INITIAL_STAMPS } from '../src/constants'
import {
  BANNER_PATTERNS,
  cardDesignSchema,
  cardMessagesSchema,
  createCardSchema,
  pickCardMessage,
} from '../src/schemas/card'

const card = (overrides: Record<string, unknown> = {}) =>
  createCardSchema.safeParse({
    name: 'Club de la casa',
    stampsRequired: 6,
    rewards: [{ atStamp: 6, title: 'Café gratis' }],
    ...overrides,
  })

describe('card messages', () => {
  it('says nothing when the business wrote nothing', () => {
    expect(pickCardMessage(cardMessagesSchema.parse({}), 3)).toBeNull()
  })

  it('rotates the variants so the card reads differently between visits', () => {
    const messages = cardMessagesSchema.parse({ variants: ['Uno', 'Dos', 'Tres'] })

    expect(pickCardMessage(messages, 0)).toBe('Uno')
    expect(pickCardMessage(messages, 1)).toBe('Dos')
    expect(pickCardMessage(messages, 2)).toBe('Tres')
    expect(pickCardMessage(messages, 3)).toBe('Uno')
  })

  it('lets a line written for one moment beat the rotation', () => {
    const messages = cardMessagesSchema.parse({
      variants: ['Gracias por volver'],
      perStamp: { '5': '¡Una más y es tuyo!' },
    })

    expect(pickCardMessage(messages, 4)).toBe('Gracias por volver')
    expect(pickCardMessage(messages, 5)).toBe('¡Una más y es tuyo!')
  })

  it('is stable for the same visit, so the answer can be cached', () => {
    const messages = cardMessagesSchema.parse({ variants: ['A', 'B'] })
    const once = pickCardMessage(messages, 7)
    expect(pickCardMessage(messages, 7)).toBe(once)
  })

  it('refuses more variants than a business can keep good', () => {
    const tooMany = Array.from({ length: MAX_CARD_MESSAGE_VARIANTS + 1 }, (_, i) => `Frase ${i}`)
    expect(cardMessagesSchema.safeParse({ variants: tooMany }).success).toBe(false)
  })
})

describe('head start', () => {
  it('defaults to none', () => {
    const parsed = card()
    expect(parsed.success && parsed.data.initialStamps).toBe(0)
  })

  it('accepts a small gift', () => {
    expect(card({ initialStamps: MAX_INITIAL_STAMPS }).success).toBe(true)
  })

  it('refuses a gift that hands over the reward for free', () => {
    const parsed = card({
      stampsRequired: 2,
      initialStamps: 2,
      rewards: [{ atStamp: 2, title: 'x' }],
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message)).toContain(
        'initial_stamps_complete_card',
      )
    }
  })

  it('refuses more than the cap, whatever the card length', () => {
    expect(card({ stampsRequired: 12, initialStamps: MAX_INITIAL_STAMPS + 1 }).success).toBe(false)
  })
})

describe('card surface', () => {
  it('starts every card on a plain background with no texture', () => {
    const design = cardDesignSchema.parse({})
    expect(design.banner).toEqual({ kind: 'solid' })
    expect(design.bannerPattern).toBe('none')
    expect(design.stampStyle).toBe('circle')
  })

  it('keeps a gradient together with both of its colours', () => {
    expect(
      cardDesignSchema.safeParse({ banner: { kind: 'gradient', from: '#000000' } }).success,
    ).toBe(false)
    expect(
      cardDesignSchema.safeParse({
        banner: { kind: 'gradient', from: '#000000', to: '#FFFFFF' },
      }).success,
    ).toBe(true)
  })

  it('offers the fourteen textures the editor shows', () => {
    expect(BANNER_PATTERNS).toHaveLength(14)
    expect(new Set(BANNER_PATTERNS).size).toBe(BANNER_PATTERNS.length)
  })
})
