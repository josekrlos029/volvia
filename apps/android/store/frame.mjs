// Play Store phone screenshots: headline on a brand background with the raw emulator
// capture framed below, at 1080×1920 (9:16, inside Play's 2:1 limit, ≥1080 px for
// promotion). Same headlines and look as the App Store set (apps/ios/store/copy.json).
//
//   bash capture.sh && node frame.mjs
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, assertSize, brand, ensureDir } from '../../ios/store/lib.mjs'

const require = createRequire(path.join(ROOT, 'apps/ios/store/package.json'))
const sharp = require('sharp')
const { Resvg } = require('@resvg/resvg-js')

const STORE = path.dirname(fileURLToPath(import.meta.url))
const RAW = path.join(STORE, 'raw')
const copy = JSON.parse(await fs.readFile(path.join(ROOT, 'apps/ios/store/copy.json'), 'utf8'))
// Play's Spanish (Latin America) listing is es-419; the copy is the es-MX one from iOS.
const LOCALES = { 'es-419': 'es-MX', 'en-US': 'en-US' }
const W = 1080
const H = 1920
const TOP = 150
const TITLE = 74
const SUBTITLE = 34
const FONT_FILES = ['/System/Library/Fonts/HelveticaNeue.ttc', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const lines = (items, y, size, weight, fill) =>
  items
    .map((line, i) => `<text x="${W / 2}" y="${y + i * size * 1.14}" font-family="Helvetica Neue, Arial" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${escape(line)}</text>`)
    .join('')

function backdrop({ title, subtitle, dark }) {
  const [from, to] = brand.gradient
  const ink = dark ? '#FFFFFF' : brand.navy
  const muted = dark ? 'rgba(255,255,255,0.8)' : '#475569'
  const titleLines = title.split('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${dark ? 'url(#g)' : brand.offWhite}"/>
  ${dark ? '' : `<circle cx="${W * 0.92}" cy="${H * 0.07}" r="${W * 0.3}" fill="${brand.violet}" opacity="0.08"/>`}
  ${lines(titleLines, TOP, TITLE, 700, ink)}
  ${lines([subtitle], TOP + titleLines.length * TITLE * 1.14 + SUBTITLE * 0.3, SUBTITLE, 400, muted)}
</svg>`
  return { png: new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Helvetica Neue' } }).render().asPng(), textBottom: TOP + titleLines.length * TITLE * 1.14 + SUBTITLE * 1.5 }
}

async function framed(raw, height) {
  const meta = await sharp(raw).metadata()
  const h = height
  const w = Math.round((meta.width / meta.height) * h)
  const radius = Math.round(w * 0.085)
  const border = Math.round(w * 0.016)
  const shot = await sharp(raw).resize(w, h).png().toBuffer()
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" fill="#fff"/></svg>`)
  const rounded = await sharp(shot).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  const bezel = Buffer.from(`<svg width="${w + border * 2}" height="${h + border * 2}"><rect width="${w + border * 2}" height="${h + border * 2}" rx="${radius + border}" fill="#0B1220"/></svg>`)
  return { image: await sharp(bezel).composite([{ input: rounded, left: border, top: border }]).png().toBuffer(), width: w + border * 2, height: h + border * 2 }
}

let count = 0
for (const [playLocale, copyLocale] of Object.entries(LOCALES)) {
  const dir = await ensureDir(path.join(STORE, 'out', 'screenshots', playLocale))
  for (const [index, state] of copy.order.entries()) {
    const { title, subtitle } = copy[copyLocale][state]
    const dark = index % 2 === 0
    const bg = backdrop({ title, subtitle, dark })
    const bottomMargin = 44
    const room = H - Math.round(bg.textBottom) - 40 - bottomMargin
    const shot = await framed(path.join(RAW, `${state}.png`), room)
    const file = path.join(dir, `${String(index + 1).padStart(2, '0')}-${state}.png`)
    await sharp(bg.png)
      .composite([{ input: shot.image, left: Math.round((W - shot.width) / 2), top: H - shot.height - bottomMargin }])
      .flatten({ background: dark ? brand.gradient[0] : brand.offWhite })
      .removeAlpha()
      .png()
      .toFile(file)
    await assertSize(file, W, H)
    count += 1
  }
}
console.log(`${count} screenshots in ${path.relative(ROOT, path.join(STORE, 'out', 'screenshots'))}`)
