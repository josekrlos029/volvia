/**
 * Colour arithmetic for text and marks drawn over a business's own palette.
 *
 * A card is painted in colours the business picked, so nothing can be hard-coded as
 * "the dark ink": the readable choice depends on the accent. These follow the WCAG
 * relative-luminance definition, which is what the contrast figures in the design
 * review were computed with.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '').trim()
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const int = Number.parseInt(full, 16)
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 }
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Which of the candidates reads best on `background`. Used for the mark inside a filled
 * stamp: on a pale gold accent the card's dark background wins, on a deep red the
 * white foreground does.
 */
export function readableOn(background: string, candidates: readonly string[]): string {
  let best = candidates[0] ?? '#000000'
  let bestRatio = 0
  for (const candidate of candidates) {
    const ratio = contrastRatio(background, candidate)
    if (ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
  }
  return best
}
