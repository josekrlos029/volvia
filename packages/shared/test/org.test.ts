import { describe, expect, it } from 'vitest'
import { locationSchema, updateLocationSchema } from '../src/schemas/org'

const location = (overrides: Record<string, unknown> = {}) =>
  locationSchema.safeParse({ name: 'Sede Centro', ...overrides })

/**
 * A pin is either whole or absent. Half a coordinate would put the shop on the equator
 * or the prime meridian, and every customer's pass would point there.
 */
describe('location coordinates', () => {
  it('defaults to no pin at all', () => {
    const result = location()
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ latitude: null, longitude: null })
  })

  it('accepts a full pin', () => {
    expect(location({ latitude: 4.6097, longitude: -74.0817 }).success).toBe(true)
  })

  it('rejects one coordinate without the other', () => {
    expect(location({ latitude: 4.6097 }).success).toBe(false)
    expect(location({ latitude: 4.6097, longitude: null }).success).toBe(false)
    expect(location({ longitude: -74.0817 }).success).toBe(false)
  })

  it('rejects coordinates off the globe', () => {
    expect(location({ latitude: 91, longitude: 0 }).success).toBe(false)
    expect(location({ latitude: 0, longitude: -181 }).success).toBe(false)
  })

  describe('on a partial update', () => {
    it('lets other fields change without mentioning the pin', () => {
      expect(updateLocationSchema.safeParse({ name: 'Sede Norte' }).success).toBe(true)
    })

    it('sets or clears both coordinates in one go', () => {
      expect(updateLocationSchema.safeParse({ latitude: 4.6, longitude: -74.1 }).success).toBe(true)
      expect(updateLocationSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true)
    })

    it('refuses to touch only one coordinate, which would leave a stale half behind', () => {
      expect(updateLocationSchema.safeParse({ latitude: null }).success).toBe(false)
      expect(updateLocationSchema.safeParse({ longitude: -74.1 }).success).toBe(false)
      expect(updateLocationSchema.safeParse({ latitude: 4.6, longitude: null }).success).toBe(false)
    })
  })
})
