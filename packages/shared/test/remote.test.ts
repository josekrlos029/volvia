import { describe, expect, it } from 'vitest'
import { documentNumberSchema, joinCardSchema, stampSchema } from '../src'

describe('documentNumberSchema', () => {
  it('drops dots, spaces and dashes so one cédula has one spelling', () => {
    expect(documentNumberSchema.parse('1.065.123.456')).toBe('1065123456')
    expect(documentNumberSchema.parse(' 1065 123-456 ')).toBe('1065123456')
    expect(documentNumberSchema.parse('pe-123456')).toBe('PE123456')
  })

  it('rejects what cannot be an ID', () => {
    expect(documentNumberSchema.safeParse('12').success).toBe(false)
    expect(documentNumberSchema.safeParse('....').success).toBe(false)
  })
})

describe('joinCardSchema documentNumber', () => {
  const base = { firstName: 'Ana', email: 'ana@example.com' }

  it('is optional and an empty field means none', () => {
    expect(joinCardSchema.parse(base).documentNumber).toBeNull()
    expect(joinCardSchema.parse({ ...base, documentNumber: '' }).documentNumber).toBeNull()
  })

  it('is normalised when given', () => {
    expect(joinCardSchema.parse({ ...base, documentNumber: '1.065.123' }).documentNumber).toBe(
      '1065123',
    )
  })
})

describe('stampSchema channel', () => {
  it('accepts remote and nothing else', () => {
    const base = { cardToken: 'AbCdEfGhIjKlMnOpQrSt', idempotencyKey: 'key-12345678' }
    expect(stampSchema.parse({ ...base, channel: 'remote' }).channel).toBe('remote')
    expect(stampSchema.parse(base).channel).toBeUndefined()
    expect(stampSchema.safeParse({ ...base, channel: 'kiosk' }).success).toBe(false)
  })
})
