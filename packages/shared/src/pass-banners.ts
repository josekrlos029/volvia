import { GIFT_ICON_PATH, STAMP_ICON_PATHS } from './stamp-icons'

/**
 * Ready-made campaign banners, drawn with paths only: the pass images ship no fonts
 * and no bitmaps, so every preset is geometry in the card's own colours. Each one
 * is a repeating scatter seeded from a fixed table, so the same preset always looks
 * the same on the same card. Lives in `shared` because the wallet strip, the web
 * card and the dashboard preview all draw the same picture.
 */

export const CAMPAIGN_BANNER_LABELS: Record<string, string> = {
  confetti: 'Confeti',
  gift: 'Regalos',
  stars: 'Estrellas',
  cake: 'Pastel',
  hearts: 'Corazones',
  sparkle: 'Destellos',
  sale: 'Oferta',
  coffee: 'Cafés',
}

const fmt = (value: number) => Number(value.toFixed(2)).toString()

/** A fixed scatter: x, y as fractions of the canvas, a scale and a rotation. */
const SCATTER: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.06, 0.22, 0.9, 12],
  [0.17, 0.72, 0.6, -30],
  [0.28, 0.18, 0.7, 40],
  [0.36, 0.82, 1, -12],
  [0.47, 0.3, 0.5, 66],
  [0.55, 0.7, 0.85, -48],
  [0.64, 0.14, 0.65, 20],
  [0.74, 0.62, 0.95, -20],
  [0.84, 0.26, 0.55, 54],
  [0.93, 0.76, 0.8, -60],
  [0.12, 0.5, 0.45, 80],
  [0.42, 0.56, 0.4, -75],
  [0.7, 0.4, 0.45, 8],
  [0.9, 0.5, 0.4, -40],
]

function pathAt(
  path: string,
  x: number,
  y: number,
  size: number,
  rotate: number,
  stroke: string,
  opacity: number,
): string {
  const scale = size / 24
  return `<path d="${path}" transform="translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rotate)} ${fmt(size / 2)} ${fmt(size / 2)}) scale(${fmt(scale)})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${fmt(opacity)}"/>`
}

/** A four-point star (a sparkle) as a closed path in a 24-grid. */
const SPARKLE_PATH = 'M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z'

function scatterPaths(
  path: string,
  width: number,
  height: number,
  colours: { accent: string; foreground: string },
  base: number,
  opacity: number,
): string {
  return SCATTER.map(([fx, fy, scale, rotate], index) => {
    const size = base * scale
    return pathAt(
      path,
      fx * width - size / 2,
      fy * height - size / 2,
      size,
      rotate,
      index % 3 === 0 ? colours.foreground : colours.accent,
      opacity * (0.6 + scale * 0.4),
    )
  }).join('')
}

function confetti(width: number, height: number, c: { accent: string; foreground: string }) {
  const unit = height / 123
  return SCATTER.map(([fx, fy, scale, rotate], index) => {
    const w = 10 * unit * scale
    const h = 4 * unit * scale
    const x = fx * width - w / 2
    const y = fy * height - h / 2
    const fill = index % 3 === 0 ? c.foreground : c.accent
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(h / 2)}" transform="rotate(${fmt(rotate)} ${fmt(x + w / 2)} ${fmt(y + h / 2)})" fill="${fill}" opacity="${fmt(0.5 + scale * 0.4)}"/>`
  }).join('')
}

function stripes(width: number, height: number, c: { accent: string; foreground: string }) {
  const band = height / 4
  const parts: string[] = []
  for (let x = -height; x < width + height; x += band * 2) {
    parts.push(
      `<polygon points="${fmt(x)},0 ${fmt(x + band)},0 ${fmt(x + band + height)},${fmt(height)} ${fmt(x + height)},${fmt(height)}" fill="${c.accent}" opacity="0.28"/>`,
    )
  }
  // A bold ribbon across the middle, where a "sale" strip reads at a glance.
  parts.push(
    `<rect x="0" y="${fmt(height * 0.38)}" width="${fmt(width)}" height="${fmt(height * 0.24)}" fill="${c.accent}" opacity="0.9"/>`,
  )
  return parts.join('')
}

function cake(width: number, height: number, c: { accent: string; foreground: string }) {
  const unit = height / 123
  const parts: string[] = []
  // Candles across the strip: a stick, a flame.
  const count = Math.max(5, Math.round(width / (54 * unit)))
  for (let index = 0; index < count; index += 1) {
    const x = ((index + 0.5) / count) * width
    const candleH = (34 + (index % 3) * 10) * unit
    const top = height * 0.68 - candleH
    parts.push(
      `<rect x="${fmt(x - 3 * unit)}" y="${fmt(top)}" width="${fmt(6 * unit)}" height="${fmt(candleH)}" rx="${fmt(3 * unit)}" fill="${c.foreground}" opacity="0.55"/>`,
      `<ellipse cx="${fmt(x)}" cy="${fmt(top - 8 * unit)}" rx="${fmt(4 * unit)}" ry="${fmt(7 * unit)}" fill="${c.accent}" opacity="0.95"/>`,
    )
  }
  // The cake itself: a wide rounded slab at the bottom.
  parts.push(
    `<rect x="${fmt(width * 0.08)}" y="${fmt(height * 0.68)}" width="${fmt(width * 0.84)}" height="${fmt(height * 0.4)}" rx="${fmt(10 * unit)}" fill="${c.accent}" opacity="0.35"/>`,
    `<rect x="${fmt(width * 0.08)}" y="${fmt(height * 0.68)}" width="${fmt(width * 0.84)}" height="${fmt(8 * unit)}" rx="${fmt(4 * unit)}" fill="${c.foreground}" opacity="0.5"/>`,
  )
  return parts.join('')
}

/**
 * The decoration for a preset banner, to be placed over the card background. Every
 * preset stays faint enough for the stamp grid to sit on top when it is not hidden.
 */
export function presetBannerSvg(
  preset: string,
  width: number,
  height: number,
  colours: { accent: string; foreground: string },
): string {
  const base = height * 0.34
  switch (preset) {
    case 'confetti':
      return confetti(width, height, colours)
    case 'gift':
      return scatterPaths(GIFT_ICON_PATH, width, height, colours, base, 0.7)
    case 'stars':
      return scatterPaths(STAMP_ICON_PATHS.star, width, height, colours, base, 0.75)
    case 'cake':
      return cake(width, height, colours)
    case 'hearts':
      return scatterPaths(STAMP_ICON_PATHS.heart, width, height, colours, base, 0.75)
    case 'sparkle':
      return scatterPaths(SPARKLE_PATH, width, height, colours, base * 1.1, 0.8)
    case 'sale':
      return stripes(width, height, colours)
    case 'coffee':
      return scatterPaths(STAMP_ICON_PATHS.coffee, width, height, colours, base, 0.7)
    default:
      return ''
  }
}

/** The same banner as a complete SVG, ready for a CSS `background-image`. */
export function presetBannerDataUri(
  preset: string,
  width: number,
  height: number,
  colours: { accent: string; foreground: string; background: string },
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${colours.background}"/>${presetBannerSvg(preset, width, height, colours)}</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
