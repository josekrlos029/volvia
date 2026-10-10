import { describe, expect, it } from 'vitest'
import {
  COMMUNITY_SEGMENTS,
  type CommunitySegment,
  VISIT_FREQUENCIES,
  VISIT_FREQUENCY_DAYS,
  classifyCustomer,
  communityWindows,
} from '../src/segments'

const NOW = new Date('2026-06-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

const customer = (overrides: {
  joinedDaysAgo: number
  lastStampDaysAgo?: number | null
  totalStamps: number
}) => ({
  joinedAt: daysAgo(overrides.joinedDaysAgo),
  lastStampAt:
    overrides.lastStampDaysAgo === null || overrides.lastStampDaysAgo === undefined
      ? null
      : daysAgo(overrides.lastStampDaysAgo),
  totalStamps: overrides.totalStamps,
})

const classify = (input: Parameters<typeof customer>[0], frequency = 'monthly' as const) =>
  classifyCustomer(customer(input), frequency, NOW)

describe('community segments', () => {
  it('calls someone who just joined new, whatever else is true', () => {
    expect(classify({ joinedDaysAgo: 2, lastStampDaysAgo: 1, totalStamps: 1 })).toBe('new')
    expect(classify({ joinedDaysAgo: 2, lastStampDaysAgo: null, totalStamps: 0 })).toBe('new')
  })

  it('stops calling someone new once they have really started using the card', () => {
    // Three visits in a fortnight is a regular, not a newcomer.
    expect(classify({ joinedDaysAgo: 10, lastStampDaysAgo: 1, totalStamps: 3 })).toBe('regulars')
  })

  it('needs both recency and repetition to call someone a regular', () => {
    expect(classify({ joinedDaysAgo: 200, lastStampDaysAgo: 5, totalStamps: 9 })).toBe('regulars')
    // Came back yesterday, but only twice ever.
    expect(classify({ joinedDaysAgo: 200, lastStampDaysAgo: 1, totalStamps: 2 })).toBe('returning')
    // Loyal once, but not seen in two cycles.
    expect(classify({ joinedDaysAgo: 200, lastStampDaysAgo: 75, totalStamps: 20 })).toBe('missing')
  })

  it('walks someone out through returning, missing and lost', () => {
    const history = (lastStampDaysAgo: number) =>
      classify({ joinedDaysAgo: 300, lastStampDaysAgo, totalStamps: 2 })

    expect(history(10)).toBe('returning')
    expect(history(59)).toBe('returning')
    expect(history(61)).toBe('missing')
    expect(history(119)).toBe('missing')
    expect(history(121)).toBe('lost')
  })

  it('judges someone who never got a stamp from the day they joined', () => {
    // Joined six months ago, never came back: lost, not "missing a visit".
    expect(classify({ joinedDaysAgo: 180, lastStampDaysAgo: null, totalStamps: 0 })).toBe('lost')
    expect(classify({ joinedDaysAgo: 45, lastStampDaysAgo: null, totalStamps: 0 })).toBe(
      'returning',
    )
  })

  it('moves the boundaries with the business, not with the calendar', () => {
    const fortyDays = { joinedDaysAgo: 300, lastStampDaysAgo: 40, totalStamps: 4 } as const

    // The same customer, read by four different kinds of business.
    expect(classifyCustomer(customer(fortyDays), 'weekly', NOW)).toBe('lost')
    expect(classifyCustomer(customer(fortyDays), 'biweekly', NOW)).toBe('missing')
    expect(classifyCustomer(customer(fortyDays), 'monthly', NOW)).toBe('returning')
    expect(classifyCustomer(customer(fortyDays), 'quarterly', NOW)).toBe('regulars')
  })

  it('puts every customer in exactly one bucket', () => {
    const seen = new Set<CommunitySegment>()
    for (const frequency of VISIT_FREQUENCIES) {
      for (const joinedDaysAgo of [0, 3, 20, 100, 400]) {
        for (const lastStampDaysAgo of [null, 0, 5, 20, 70, 200, 500]) {
          for (const totalStamps of [0, 1, 2, 5, 40]) {
            if (lastStampDaysAgo !== null && lastStampDaysAgo > joinedDaysAgo) continue
            const segment = classifyCustomer(
              customer({ joinedDaysAgo, lastStampDaysAgo, totalStamps }),
              frequency,
              NOW,
            )
            expect(COMMUNITY_SEGMENTS).toContain(segment)
            seen.add(segment)
          }
        }
      }
    }
    // Every bucket is reachable: a rule nobody can fall into is a rule nobody needs.
    expect([...seen].sort()).toEqual([...COMMUNITY_SEGMENTS].sort())
  })

  it('derives every window from the one number the business sets', () => {
    for (const frequency of VISIT_FREQUENCIES) {
      const windows = communityWindows(frequency)
      expect(windows.cycleDays).toBe(VISIT_FREQUENCY_DAYS[frequency])
      expect(windows.missingAfterDays).toBe(windows.cycleDays * 2)
      expect(windows.lostAfterDays).toBe(windows.cycleDays * 4)
    }
  })
})

describe('composite and suggested segments', () => {
  it('reads cold and recurring as disjoint halves of the community, leaving only the new', async () => {
    const { COMPOSITE_SEGMENTS } = await import('../src/segments')
    const cold = new Set<string>(COMPOSITE_SEGMENTS.cold)
    const recurring = new Set<string>(COMPOSITE_SEGMENTS.recurring)
    for (const segment of cold) expect(recurring.has(segment)).toBe(false)
    const covered = new Set([...cold, ...recurring, 'new'])
    expect([...covered].sort()).toEqual([...COMMUNITY_SEGMENTS].sort())
  })

  it('ships every suggested segment with a valid definition and sendable templates', async () => {
    const { SUGGESTED_SEGMENTS, SUGGESTED_SEGMENT_KEYS } = await import('../src/index')
    const { messageSchema, segmentDefinitionSchema } = await import('../src/index')
    const text = messageSchema.pick({ headline: true, body: true })

    for (const key of SUGGESTED_SEGMENT_KEYS) {
      const suggested = SUGGESTED_SEGMENTS[key]
      expect(suggested.key).toBe(key)
      expect(() => segmentDefinitionSchema.parse(suggested.definition), key).not.toThrow()
      expect(suggested.messageTemplates.length, key).toBeGreaterThan(0)
      for (const template of suggested.messageTemplates) {
        expect(() => text.parse(template), `${key}: ${template.headline}`).not.toThrow()
      }
    }
  })

  it('refuses a filter it does not know, so a typo cannot silently match everyone', async () => {
    const { segmentDefinitionSchema } = await import('../src/index')
    expect(() => segmentDefinitionSchema.parse({ base: 'all', filters: { minStamp: 3 } })).toThrow()
    expect(segmentDefinitionSchema.parse({})).toEqual({ base: 'all', filters: {} })
  })
})
