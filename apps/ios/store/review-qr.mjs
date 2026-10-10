// The QR the App Review team scans. Point it at the demo card of the "Volvia Demo"
// business in production; the token comes from the card's URL in the dashboard.
//
//   VOLVIA_REVIEW_TOKEN=<token> node review-qr.mjs
//   VOLVIA_REVIEW_URL=https://tarjeta.somosvolvia.com/c/<token> node review-qr.mjs
import fs from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { OUT, brand, ensureDir } from './lib.mjs'

const url = process.env.VOLVIA_REVIEW_URL
  ?? (process.env.VOLVIA_REVIEW_TOKEN ? `https://tarjeta.somosvolvia.com/c/${process.env.VOLVIA_REVIEW_TOKEN}` : null)
if (!url) {
  console.error('Set VOLVIA_REVIEW_TOKEN (or VOLVIA_REVIEW_URL) to the demo card for the reviewer.')
  process.exit(1)
}

const dir = await ensureDir(path.join(OUT, 'review'))
const qr = path.join(dir, 'demo-card-qr.png')
await QRCode.toFile(qr, url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })

// A one-page sheet to attach in App Store Connect → App Review Information.
const W = 1240, H = 1754
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  <text x="${W / 2}" y="160" font-family="Helvetica Neue, Arial" font-size="56" font-weight="700" fill="${brand.navy}" text-anchor="middle">Volvia Biz — test card for App Review</text>
  <text x="${W / 2}" y="230" font-family="Helvetica Neue, Arial" font-size="30" fill="#475569" text-anchor="middle">Sign in with the demo account, then point the camera at this code.</text>
  <text x="${W / 2}" y="1420" font-family="Helvetica Neue, Arial" font-size="26" fill="#475569" text-anchor="middle">${url}</text>
  <text x="${W / 2}" y="1480" font-family="Helvetica Neue, Arial" font-size="26" fill="#475569" text-anchor="middle">Each scan adds one stamp. After the card is complete the app shows the reward.</text>
</svg>`
const page = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: ['/System/Library/Fonts/HelveticaNeue.ttc', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'], defaultFontFamily: 'Helvetica Neue' } }).render().asPng()
const sheet = path.join(dir, 'demo-card-sheet.png')
await sharp(page).composite([{ input: await sharp(qr).resize(1000, 1000).toBuffer(), left: (W - 1000) / 2, top: 320 }]).png().toFile(sheet)
await fs.writeFile(path.join(dir, 'demo-card-url.txt'), `${url}\n`)
console.log(`review QR: ${qr}\nreview sheet: ${sheet}`)
