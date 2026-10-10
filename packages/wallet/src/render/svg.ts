import { GIFT_ICON_PATH, readableOn, stampIconPath } from '@volvia/shared'
import type { StampStyle } from '@volvia/shared'
import type { PassContent } from '../types'
import type { RemoteImage } from './remote-image'
import { VOLVIA_GLYPH_ASPECT, VOLVIA_GLYPH_PNG_BASE64, VOLVIA_NAVY } from './volvia-glyph'

/**
 * The pass artwork, as SVG.
 *
 * Three pictures cover both wallets: the strip (the stamp grid, the only thing on the
 * pass that changes with every visit), the lockup (Volvia mark + the business, the one
 * image slot either wallet shows while passes are stacked) and the tile (the business
 * on its own, for the Apple icon and the Google round logo). Everything is drawn from
 * the card's own colours; no text, so no fonts.
 */

/** What the business uploaded, already fetched and inlined. */
export interface PassArtwork {
  logo: RemoteImage | null
  /** A custom stamp icon, when the design uses an uploaded image. */
  stampIcon: RemoteImage | null
}

export const EMPTY_ARTWORK: PassArtwork = { logo: null, stampIcon: null }

const fmt = (value: number) => Number(value.toFixed(2)).toString()

function slotRadius(style: StampStyle, size: number): number {
  switch (style) {
    case 'circle':
    case 'badge':
      return size / 2
    case 'rounded':
      return size * 0.3
    default:
      return size * 0.14
  }
}

/** How many columns keep the rows even; mirrors the web grid so the two agree. */
function gridShape(total: number): { rows: number; cols: number } {
  if (total <= 6) return { rows: 1, cols: total }
  const rows = total <= 16 ? 2 : 3
  return { rows, cols: Math.ceil(total / rows) }
}

/** An icon path from the 24-grid, scaled into a `size` box at (x, y). */
function iconAt(
  path: string,
  x: number,
  y: number,
  size: number,
  stroke: string,
  opacity = 1,
): string {
  const scale = size / 24
  return `<path d="${path}" transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${fmt(opacity)}"/>`
}

/** An uploaded image fitted inside a box, letterboxed rather than cropped. */
function imageAt(image: RemoteImage, x: number, y: number, size: number, inset: number): string {
  const box = size - inset * 2
  return `<image href="${image.dataUri}" x="${fmt(x + inset)}" y="${fmt(y + inset)}" width="${fmt(box)}" height="${fmt(box)}" preserveAspectRatio="xMidYMid meet"/>`
}

/** One stamp slot in its state: filled, empty, or the reward still to be reached. */
function slot(
  content: PassContent,
  position: number,
  x: number,
  y: number,
  size: number,
  markPath: string,
  custom: RemoteImage | null,
): string {
  const accent = content.labelColor
  const onAccent = readableOn(accent, [content.backgroundColor, content.foregroundColor])
  const filled = position <= content.stampsCount
  const reward = content.rewardPositions.includes(position)
  const r = slotRadius(content.stampStyle, size)
  const iconSize = size * 0.5
  const ix = x + (size - iconSize) / 2
  const iy = y + (size - iconSize) / 2
  const ring =
    content.stampStyle === 'badge'
      ? `<rect x="${fmt(x - 3)}" y="${fmt(y - 3)}" width="${fmt(size + 6)}" height="${fmt(size + 6)}" rx="${fmt(r + 3)}" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="1.5"/>`
      : ''

  if (filled) {
    const mark = reward
      ? iconAt(GIFT_ICON_PATH, ix, iy, iconSize, onAccent)
      : custom
        ? imageAt(custom, x, y, size, size * 0.2)
        : iconAt(markPath, ix, iy, iconSize, onAccent)
    return `${ring}<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(r)}" fill="${accent}"/>${mark}`
  }

  if (reward) {
    return `${ring}<rect x="${fmt(x + 1)}" y="${fmt(y + 1)}" width="${fmt(size - 2)}" height="${fmt(size - 2)}" rx="${fmt(Math.max(0, r - 1))}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="${fmt(size * 0.12)} ${fmt(size * 0.09)}"/>${iconAt(GIFT_ICON_PATH, ix, iy, iconSize, accent)}`
  }

  const faint = content.foregroundColor
  const mark = custom
    ? `<g opacity="0.3">${imageAt(custom, x, y, size, size * 0.2)}</g>`
    : iconAt(markPath, ix, iy, iconSize, faint, 0.32)
  return `${ring}<rect x="${fmt(x + 1)}" y="${fmt(y + 1)}" width="${fmt(size - 2)}" height="${fmt(size - 2)}" rx="${fmt(Math.max(0, r - 1))}" fill="none" stroke="${faint}" stroke-opacity="0.18" stroke-width="2"/>${mark}`
}

/**
 * The strip: the stamp grid on the card background. Apple shows it at 375×123 pt
 * under the header; Google shows the same picture as the hero image at 1032×336.
 */
export function stripSvg(
  content: PassContent,
  width: number,
  height: number,
  artwork: PassArtwork = EMPTY_ARTWORK,
): string {
  const total = Math.max(1, content.stampsRequired)
  const { rows, cols } = gridShape(total)
  const unit = width / 375
  const padX = 24 * unit
  const padY = 14 * unit
  const gap = 8 * unit
  const maxSlot = 40 * unit
  const size = Math.min(
    maxSlot,
    (width - padX * 2 - gap * (cols - 1)) / cols,
    (height - padY * 2 - gap * (rows - 1)) / rows,
  )
  const gridW = cols * size + (cols - 1) * gap
  const gridH = rows * size + (rows - 1) * gap
  const originX = (width - gridW) / 2
  const originY = (height - gridH) / 2
  const markPath = stampIconPath(content.stampIcon)
  const custom = content.stampIcon.kind === 'image' ? artwork.stampIcon : null

  const slots: string[] = []
  for (let index = 0; index < total; index += 1) {
    const row = Math.floor(index / cols)
    const col = index % cols
    // A short last row is centred rather than left-aligned, so it reads as finished.
    const inRow = row === rows - 1 ? total - row * cols : cols
    const rowOffset = ((cols - inRow) * (size + gap)) / 2
    const x = originX + rowOffset + col * (size + gap)
    const y = originY + row * (size + gap)
    slots.push(slot(content, index + 1, x, y, size, markPath, custom))
  }

  const dot = 1.3 * unit
  const cell = 14 * unit
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    `<defs><pattern id="dots" width="${fmt(cell)}" height="${fmt(cell)}" patternUnits="userSpaceOnUse"><circle cx="${fmt(cell / 2)}" cy="${fmt(cell / 2)}" r="${fmt(dot)}" fill="${content.foregroundColor}" fill-opacity="0.07"/></pattern></defs>`,
    `<rect width="${fmt(width)}" height="${fmt(height)}" fill="${content.backgroundColor}"/>`,
    `<rect width="${fmt(width)}" height="${fmt(height)}" fill="url(#dots)"/>`,
    ...slots,
    '</svg>',
  ].join('')
}

/** The business on its own: its logo over the card colour, or the stamp icon on the accent. */
function businessTile(
  content: PassContent,
  artwork: PassArtwork,
  x: number,
  y: number,
  size: number,
  radius: number,
): string {
  if (artwork.logo) {
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(radius)}" fill="${content.foregroundColor}" fill-opacity="0.1"/>${imageAt(artwork.logo, x, y, size, size * 0.12)}`
  }
  const accent = content.labelColor
  const onAccent = readableOn(accent, [content.backgroundColor, content.foregroundColor])
  const iconSize = size * 0.52
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(radius)}" fill="${accent}"/>${iconAt(stampIconPath(content.stampIcon), x + (size - iconSize) / 2, y + (size - iconSize) / 2, iconSize, onAccent)}`
}

function volviaTile(x: number, y: number, size: number, radius: number): string {
  const glyphW = size * 0.6
  const glyphH = glyphW / VOLVIA_GLYPH_ASPECT
  return (
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(radius)}" fill="${VOLVIA_NAVY}"/>` +
    `<image href="data:image/png;base64,${VOLVIA_GLYPH_PNG_BASE64}" x="${fmt(x + (size - glyphW) / 2)}" y="${fmt(y + (size - glyphH) / 2)}" width="${fmt(glyphW)}" height="${fmt(glyphH)}" preserveAspectRatio="xMidYMid meet"/>`
  )
}

/**
 * The lockup: Volvia mark · divider · business. Transparent background, left-aligned,
 * because both wallets place it at the left of the header and paint the card colour
 * behind it. `width`/`height` is the canvas the platform expects; the lockup itself
 * takes the height and as much width as it needs.
 */
export function lockupSvg(
  content: PassContent,
  width: number,
  height: number,
  artwork: PassArtwork = EMPTY_ARTWORK,
): string {
  const tile = height * 0.76
  const y = (height - tile) / 2
  const radius = tile * 0.26
  const gap = tile * 0.28
  const divider = Math.max(1, height / 50)
  const dividerH = tile * 0.68

  const volviaX = 0
  const dividerX = volviaX + tile + gap
  const businessX = dividerX + divider + gap

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    volviaTile(volviaX, y, tile, radius),
    `<rect x="${fmt(dividerX)}" y="${fmt(y + (tile - dividerH) / 2)}" width="${fmt(divider)}" height="${fmt(dividerH)}" fill="${content.foregroundColor}" fill-opacity="0.22"/>`,
    businessTile(content, artwork, businessX, y, tile, radius),
    '</svg>',
  ].join('')
}

/** How wide the lockup comes out for a given height, so the PNG can be cropped to it. */
export function lockupWidth(height: number): number {
  const tile = height * 0.76
  return Math.ceil(tile * 2 + tile * 0.28 * 2 + Math.max(1, height / 50))
}

/**
 * The tile: the business alone, square and opaque. Apple masks it into its icon shape;
 * Google crops it into the round program logo, so the content keeps clear of the corners.
 */
export function tileSvg(
  content: PassContent,
  size: number,
  artwork: PassArtwork = EMPTY_ARTWORK,
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(size)}" height="${fmt(size)}" viewBox="0 0 ${fmt(size)} ${fmt(size)}">`,
    `<rect width="${fmt(size)}" height="${fmt(size)}" fill="${content.backgroundColor}"/>`,
    artwork.logo
      ? imageAt(artwork.logo, 0, 0, size, size * 0.16)
      : businessTile(content, artwork, 0, 0, size, 0),
    '</svg>',
  ].join('')
}
