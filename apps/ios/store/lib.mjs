// Shared bits for the store asset scripts: paths, the brand palette and the Volvia glyph.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export const STORE = path.dirname(fileURLToPath(import.meta.url))
export const IOS = path.resolve(STORE, '..')
export const ROOT = path.resolve(STORE, '../../..')
export const OUT = path.join(STORE, 'out')
export const RAW = path.join(STORE, 'raw')
export const ASSETS = path.join(IOS, 'Resources', 'Assets.xcassets')

/** The real brand (see /assets and memory volvia-brand-palette), not the placeholder in packages/ui. */
export const brand = {
  navy: '#1E3A8A',
  violet: '#7C3AED',
  orange: '#FB923C',
  offWhite: '#F8FAFC',
  ink: '#0F172A',
  /** Hero gradient used on somosvolvia.com (apps/web/src/app/globals.css). */
  gradient: ['#2E1065', '#7C3AED'],
}

/** The brand "V" lives as an embedded PNG (157×129, white on transparent) inside the SVG icon. */
const GLYPH_SVG = path.join(ROOT, 'assets', 'Icono Azul sin Fondo.svg')
export const GLYPH_ASPECT = 157 / 129

export async function glyphSource() {
  const svg = await fs.readFile(GLYPH_SVG, 'utf8')
  const match = svg.match(/base64,([^"]+)"/)
  if (!match) throw new Error(`No embedded PNG in ${GLYPH_SVG}`)
  return Buffer.from(match[1], 'base64')
}

/**
 * A crisp alpha mask of the glyph at `width` px. The source is only 157 px wide, so a plain
 * resize would be soft at icon size: upscale 8×, threshold the anti-aliased edge back to a
 * hard outline (which lands on the true sub-pixel edge), then downscale to the target.
 */
export async function glyphMask(width) {
  const source = await glyphSource()
  const big = Math.max(width * 2, 1256)
  const outline = await sharp(source)
    .ensureAlpha()
    .extractChannel('alpha')
    .resize({ width: big, kernel: 'lanczos3' })
    // Smooth the interpolation ripple before cutting the outline, or the edge wobbles.
    .blur(big / 157 / 2)
    .threshold(128)
    .toBuffer()
  return sharp(outline).resize({ width, kernel: 'lanczos3' }).png().toBuffer()
}

/** The glyph as an RGBA PNG: `color` where the mask is, transparent elsewhere. */
export async function glyph({ width, color }) {
  const mask = await glyphMask(width)
  const { height } = await sharp(mask).metadata()
  return sharp({ create: { width, height, channels: 3, background: color } })
    .joinChannel(mask)
    .png()
    .toBuffer()
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function assertSize(file, width, height, { opaque = true } = {}) {
  const meta = await sharp(file).metadata()
  const problems = []
  if (meta.width !== width || meta.height !== height) {
    problems.push(`is ${meta.width}×${meta.height}, expected ${width}×${height}`)
  }
  if (opaque && meta.hasAlpha) {
    // sharp reports hasAlpha for any RGBA PNG; App Store Connect rejects icons with an alpha
    // channel, so the scripts flatten before writing and this is the safety net.
    problems.push('has an alpha channel')
  }
  if (problems.length) throw new Error(`${path.relative(STORE, file)} ${problems.join('; ')}`)
}
