import type { Currency } from '@volvia/shared'

/**
 * Prices travel as minor units (cents, or pesos × 100) and are typed as people write
 * them: "12.500" in Colombia, "4.50" in dollars. These two keep the conversion in one
 * place so a menu never shows a price a hundred times too big.
 */
export function toMinorUnits(input: string | number, currency: Currency): number | null {
  const text = String(input).trim()
  if (text === '') return null
  // Colombian prices are written with dots as thousand separators and no cents.
  const normalised =
    currency === 'cop' ? text.replace(/[.\s]/g, '').replace(',', '.') : text.replace(/[\s,]/g, '')
  const value = Number(normalised)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

export function fromMinorUnits(minorUnits: number | null, currency: Currency): string {
  if (minorUnits === null) return ''
  const value = minorUnits / 100
  return currency === 'cop' ? String(Math.round(value)) : value.toFixed(2)
}
