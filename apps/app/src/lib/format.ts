import type { Currency } from '@volvia/shared'

const LOCALE = 'es-CO'

/** Money arrives in minor units; never let a raw cent count reach the screen. */
export function formatMoney(minorUnits: number, currency: Currency): string {
  const value = currency === 'cop' ? minorUnits / 100 : minorUnits / 100
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency === 'cop' ? 0 : 2,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value)
}

export function formatPercent(value: number | null): string {
  if (value === null) return 'Sin datos'
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value)}%`
}

export function formatDate(value: string | Date | null, style: 'short' | 'long' = 'short'): string {
  if (!value) return 'Nunca'
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: style === 'long' ? 'numeric' : undefined,
  }).format(date)
}

/** "hace 3 días" reads faster than a date when the question is recency. */
export function formatRelative(value: string | Date | null): string {
  if (!value) return 'Nunca'
  const date = typeof value === 'string' ? new Date(value) : value
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000)

  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
  if (Math.abs(diffDays) < 1) return 'Hoy'
  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, 'day')
  if (Math.abs(diffDays) < 365) return formatter.format(Math.round(diffDays / 30), 'month')
  return formatter.format(Math.round(diffDays / 365), 'year')
}

export const PLAN_NAMES: Record<string, string> = {
  free: 'Gratis',
  pro: 'Pro',
  business: 'Negocio',
  multi: 'Multi',
}
