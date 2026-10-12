import { describe, expect, it } from 'vitest'
import { fromMinorUnits, toMinorUnits } from '../src/lib/money'

describe('menu prices', () => {
  it('reads pesos the way they are written and stores them in minor units', () => {
    expect(toMinorUnits('12.500', 'cop')).toBe(1_250_000)
    expect(toMinorUnits('12500', 'cop')).toBe(1_250_000)
    expect(toMinorUnits(' 9 900 ', 'cop')).toBe(990_000)
  })

  it('reads dollars with cents', () => {
    expect(toMinorUnits('4.50', 'usd')).toBe(450)
    expect(toMinorUnits('1,299.99', 'usd')).toBe(129_999)
  })

  it('treats a blank or nonsense price as no price', () => {
    expect(toMinorUnits('', 'cop')).toBeNull()
    expect(toMinorUnits('gratis', 'cop')).toBeNull()
    expect(toMinorUnits('-5', 'usd')).toBeNull()
  })

  it('round-trips back into the input box', () => {
    expect(fromMinorUnits(1_250_000, 'cop')).toBe('12500')
    expect(fromMinorUnits(450, 'usd')).toBe('4.50')
    expect(fromMinorUnits(null, 'usd')).toBe('')
  })
})
