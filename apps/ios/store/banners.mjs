// Product-page creative assets for App Store Connect ("Header and Search Results"):
//   header-universal-<locale>.png  5244×2950 (16:9) — valid for both placements
//   header-<locale>.png            3840×1646 (21:9) — dedicated header
//   search-<locale>.png            3840×2560 (3:2)  — dedicated search results
// Opaque PNG, brand gradient, the Volvia mark, a short claim and a framed screenshot.
// Keep the message near the centre: Apple crops the edges on small screens.
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { OUT, RAW, assertSize, brand, ensureDir, glyph } from './lib.mjs'

const FONT_FILES = ['/System/Library/Fonts/HelveticaNeue.ttc', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
const COPY = {
  'es-MX': { title: 'Volvia Biz', claim: 'Sella tarjetas de fidelidad\ndesde el mostrador', note: 'La app del personal de los negocios que usan Volvia' },
  'en-US': { title: 'Volvia Biz', claim: 'Stamp loyalty cards\nfrom the counter', note: 'The staff app for businesses that use Volvia' },
}
const SIZES = [
  { name: 'header-universal', width: 5244, height: 2950 },
  { name: 'header', width: 3840, height: 1646 },
  { name: 'search', width: 3840, height: 2560 },
]
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function background({ width, height, title, claim, note, textLeft, titleSize }) {
  const [from, to] = brand.gradient
  const lines = claim.split('\n')
  const claimSize = Math.round(titleSize * 0.62)
  const noteSize = Math.round(titleSize * 0.3)
  const top = Math.round(height * 0.33)
  const text = [
    `<text x="${textLeft}" y="${top}" font-family="Helvetica Neue, Arial" font-size="${titleSize}" font-weight="700" fill="#FFFFFF">${escape(title)}</text>`,
    ...lines.map((l, i) => `<text x="${textLeft}" y="${top + titleSize * 0.55 + (i + 1) * claimSize * 1.15}" font-family="Helvetica Neue, Arial" font-size="${claimSize}" font-weight="400" fill="#FFFFFF" opacity="0.95">${escape(l)}</text>`),
    `<text x="${textLeft}" y="${top + titleSize * 0.55 + (lines.length + 1) * claimSize * 1.15 + noteSize * 1.2}" font-family="Helvetica Neue, Arial" font-size="${noteSize}" fill="#FFFFFF" opacity="0.72">${escape(note)}</text>`,
  ].join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${width * 0.88}" cy="${height * 0.1}" r="${height * 0.6}" fill="#FFFFFF" opacity="0.05"/>
  ${text}</svg>`
  return new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Helvetica Neue' } }).render().asPng()
}

async function phone(rawFile, height) {
  const meta = await sharp(rawFile).metadata()
  const w = Math.round((meta.width / meta.height) * height)
  const radius = Math.round(w * 0.11)
  const border = Math.round(w * 0.012)
  const shot = await sharp(rawFile).resize(w, height).png().toBuffer()
  const mask = Buffer.from(`<svg width="${w}" height="${height}"><rect width="${w}" height="${height}" rx="${radius}" fill="#fff"/></svg>`)
  const rounded = await sharp(shot).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  const bezel = Buffer.from(`<svg width="${w + border * 2}" height="${height + border * 2}"><rect width="${w + border * 2}" height="${height + border * 2}" rx="${radius + border}" fill="#0B1220"/></svg>`)
  return { image: await sharp(bezel).composite([{ input: rounded, left: border, top: border }]).png().toBuffer(), width: w + border * 2, height: height + border * 2 }
}

const dir = await ensureDir(path.join(OUT, 'banners'))
const raw = path.join(RAW, 'iphone', 'reward.png')
let count = 0
for (const [locale, copy] of Object.entries(COPY)) {
  for (const size of SIZES) {
    const { width, height } = size
    const titleSize = Math.round(height * 0.12)
    const textLeft = Math.round(width * 0.09)
    const bg = background({ width, height, ...copy, textLeft, titleSize })
    // Mark above the title, phone on the right, bleeding off the bottom edge.
    const mark = await glyph({ width: Math.round(titleSize * 0.9), color: '#FFFFFF' })
    const markMeta = await sharp(mark).metadata()
    const ph = await phone(raw, Math.round(height * 1.05))
    const phoneLeft = Math.round(width * 0.62)
    const phoneTop = Math.round(height * 0.14)
    // sharp cannot composite an image larger than the canvas: trim what bleeds off.
    const visible = await sharp(ph.image)
      .extract({ left: 0, top: 0, width: Math.min(ph.width, width - phoneLeft), height: Math.min(ph.height, height - phoneTop) })
      .png()
      .toBuffer()
    const file = path.join(dir, `${size.name}-${locale}.png`)
    await sharp(bg)
      .composite([
        { input: mark, left: textLeft, top: Math.round(height * 0.33 - titleSize - markMeta.height - height * 0.03) },
        { input: visible, left: phoneLeft, top: phoneTop },
      ])
      .flatten({ background: brand.gradient[0] })
      .removeAlpha()
      .png()
      .toFile(file)
    await assertSize(file, width, height)
    count += 1
  }
}
console.log(`${count} banners in ${path.relative(process.cwd(), dir)}`)
