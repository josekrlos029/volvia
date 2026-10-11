import { describe, expect, it } from 'vitest'
import { formatOpeningHours } from '../src/opening-hours'

const weekdays = (opens: string, closes: string) =>
  [1, 2, 3, 4, 5].map((day) => ({ day, opens, closes }))

describe('formatOpeningHours', () => {
  it('collapses consecutive days with the same hours into a range', () => {
    expect(
      formatOpeningHours(
        [...weekdays('09:00', '18:00'), { day: 6, opens: '10:00', closes: '14:00' }],
        'es',
      ),
    ).toBe('Lun–Vie 9:00–18:00\nSáb 10:00–14:00')
  })

  it('keeps a lone day on its own and skips closed days', () => {
    expect(
      formatOpeningHours(
        [
          { day: 1, opens: '08:00', closes: '12:00' },
          { day: 3, opens: '08:00', closes: '12:00' },
        ],
        'es',
      ),
    ).toBe('Lun 8:00–12:00\nMié 8:00–12:00')
  })

  it('lists a split shift as two ranges on one day', () => {
    expect(
      formatOpeningHours(
        [
          { day: 2, opens: '08:00', closes: '12:00' },
          { day: 2, opens: '14:00', closes: '19:00' },
        ],
        'es',
      ),
    ).toBe('Mar 8:00–12:00, 14:00–19:00')
  })

  it('starts the week on Monday and ends on Sunday', () => {
    expect(
      formatOpeningHours(
        [
          { day: 0, opens: '10:00', closes: '13:00' },
          { day: 6, opens: '10:00', closes: '13:00' },
        ],
        'en',
      ),
    ).toBe('Sat–Sun 10:00–13:00')
  })

  it('is empty when the business set no hours, and joins with the separator asked for', () => {
    expect(formatOpeningHours([], 'es')).toBe('')
    expect(formatOpeningHours(weekdays('09:00', '18:00'), 'en', ' · ')).toBe('Mon–Fri 9:00–18:00')
  })
})
