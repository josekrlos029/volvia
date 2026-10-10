// Marketing screenshots: a headline on a brand background with the raw simulator capture
// framed below, at exactly the pixel sizes App Store Connect accepts (iPhone 1206×2622, iPad 2064×2752).
//
//   node frame.mjs            all locales and devices from raw/
//   LOCALES=es-MX DEVICES=iphone node frame.mjs
import fs from 'node:fs/promises'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { OUT, RAW, STORE, assertSize, brand, ensureDir } from './lib.mjs'

const copy = JSON.parse(await fs.readFile(path.join(STORE, 'copy.json'), 'utf8'))
const DEVICES = {
  // App Store Connect's "iPhone with Dynamic Island" slot takes 6.3" (1206×2622) or 6.1";
  // the raw 1320×2868 capture has the same proportions and is simply scaled down.
  iphone: { width: 1206, height: 2622, folder: 'iphone-6.3', title: 95, subtitle: 42, top: 174, radius: 110, scale: 0.78 },
  ipad: { width: 2064, height: 2752, folder: 'ipad-13', title: 128, subtitle: 56, top: 220, radius: 72, scale: 0.72 },
}
const FONT_FILES = ['/System/Library/Fonts/HelveticaNeue.ttc', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function textBlock({ lines, x, y, size, weight, fill, lineHeight }) {
  return lines
    .map((line, i) => `<text x="${x}" y="${y + i * size * lineHeight}" font-family="Helvetica Neue, Arial" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${escape(line)}</text>`)
    .join('')
}

function backdrop({ width, height, title, subtitle, device, dark }) {
  const [from, to] = brand.gradient
  const fill = dark ? `url(#g)` : brand.offWhite
  const ink = dark ? '#FFFFFF' : brand.navy
  const muted = dark ? 'rgba(255,255,255,0.78)' : '#475569'
  const titleLines = title.split('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${fill}"/>
  ${dark ? '' : `<circle cx="${width * 0.92}" cy="${height * 0.08}" r="${width * 0.28}" fill="${brand.violet}" opacity="0.08"/>`}
  ${textBlock({ lines: titleLines, x: width / 2, y: device.top, size: device.title, weight: 700, fill: ink, lineHeight: 1.12 })}
  ${textBlock({ lines: [subtitle], x: width / 2, y: device.top + titleLines.length * device.title * 1.12 + device.subtitle * 0.4, size: device.subtitle, weight: 400, fill: muted, lineHeight: 1.3 })}
</svg>`
  return new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Helvetica Neue' } }).render().asPng()
}

async function framedShot(raw, device) {
  const w = Math.round(device.width * device.scale)
  const meta = await sharp(raw).metadata()
  const h = Math.round((meta.height / meta.width) * w)
  const border = Math.round(w * 0.012)
  const shot = await sharp(raw).resize(w, h).png().toBuffer()
  // Rounded corners + a thin dark bezel; no fake hardware, Apple accepts either.
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${device.radius}" ry="${device.radius}" fill="#fff"/></svg>`)
  const rounded = await sharp(shot).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  const bezel = Buffer.from(`<svg width="${w + border * 2}" height="${h + border * 2}"><rect width="${w + border * 2}" height="${h + border * 2}" rx="${device.radius + border}" ry="${device.radius + border}" fill="#0B1220"/></svg>`)
  const framed = await sharp(bezel).composite([{ input: rounded, left: border, top: border }]).png().toBuffer()
  return { framed, width: w + border * 2, height: h + border * 2 }
}

const locales = (process.env.LOCALES ?? 'es-MX en-US').split(/\s+/)
const devices = (process.env.DEVICES ?? 'iphone ipad').split(/\s+/)
let count = 0

for (const locale of locales) {
  for (const deviceKey of devices) {
    const device = DEVICES[deviceKey]
    const dir = await ensureDir(path.join(OUT, 'screenshots', locale, device.folder))
    for (const [index, state] of copy.order.entries()) {
      const raw = path.join(RAW, deviceKey, `${state}.png`)
      const { title, subtitle } = copy[locale][state]
      const dark = index % 2 === 0
      const bg = backdrop({ width: device.width, height: device.height, title, subtitle, device, dark })
      const { framed, width, height } = await framedShot(raw, device)
      const left = Math.round((device.width - width) / 2)
      // The result card sits at the bottom of the app, so the whole screen stays visible.
      const top = Math.round(device.height - height - device.height * (deviceKey === 'iphone' ? 0.02 : 0.05))
      const file = path.join(dir, `${String(index + 1).padStart(2, '0')}-${state}.png`)
      await sharp(bg).composite([{ input: framed, left, top }]).flatten({ background: dark ? brand.gradient[0] : brand.offWhite }).removeAlpha().png().toFile(file)
      await assertSize(file, device.width, device.height)
      count += 1
    }
  }
}
console.log(`${count} screenshots in ${path.relative(process.cwd(), path.join(OUT, 'screenshots'))}`)
