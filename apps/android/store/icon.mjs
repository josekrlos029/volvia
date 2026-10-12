// Android brand assets from the same "V" and palette as the iOS app (apps/ios/store/lib.mjs):
// adaptive launcher icon (foreground + monochrome), splash icon, the in-app mark and the
// Play Store listing icon and feature graphic. Writes straight into app/src/main/res and out/.
//
//   cd apps/ios/store && pnpm install --ignore-workspace   # once, for sharp
//   node apps/android/store/icon.mjs
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, assertSize, brand, ensureDir, glyph } from '../../ios/store/lib.mjs'

// sharp is installed once, next to the iOS scripts; reuse that copy instead of a second install.
const sharp = createRequire(path.join(ROOT, 'apps/ios/store/package.json'))('sharp')

const STORE = path.dirname(fileURLToPath(import.meta.url))
const RES = path.resolve(STORE, '../app/src/main/res')
const OUT = await ensureDir(path.join(STORE, 'out'))
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const WHITE = '#FFFFFF'
const clear = { r: 0, g: 0, b: 0, alpha: 0 }

/** A square transparent canvas of `canvasDp` with the white "V" `glyphDp` wide, optically centred. */
async function centredGlyph({ canvasDp, glyphDp, scale, nudgeDp }) {
  const size = Math.round(canvasDp * scale)
  const mark = await glyph({ width: Math.round(glyphDp * scale), color: WHITE })
  const meta = await sharp(mark).metadata()
  return sharp({ create: { width: size, height: size, channels: 4, background: clear } })
    .composite([
      {
        input: mark,
        left: Math.round((size - meta.width) / 2),
        // The "V" reads bottom-heavy; iOS nudges it up 12/1024 of the icon, same here.
        top: Math.round((size - meta.height) / 2 - nudgeDp * scale),
      },
    ])
    .png()
    .toBuffer()
}

async function write(dir, file, buffer) {
  await ensureDir(path.join(RES, dir))
  await fs.writeFile(path.join(RES, dir, file), buffer)
}

for (const [density, scale] of Object.entries(DENSITIES)) {
  // Adaptive icon layer: 108 dp, of which ~72 dp shows through the mask. 42 dp of glyph
  // keeps the iOS proportion (600/1024 of the visible icon) and sits well inside the
  // 66 dp safe circle.
  const foreground = await centredGlyph({ canvasDp: 108, glyphDp: 42, scale, nudgeDp: 0.8 })
  await write(`mipmap-${density}`, 'ic_launcher_foreground.png', foreground)
  // Themed icons (Android 13+) tint this; white on transparent is exactly what they want.
  await write(`mipmap-${density}`, 'ic_launcher_monochrome.png', foreground)

  // Splash icon without background: 288 dp canvas, content inside a 192 dp circle. 120 dp
  // of glyph matches the 120 pt launch logo on iOS.
  await write(`drawable-${density}`, 'ic_splash.png', await centredGlyph({ canvasDp: 288, glyphDp: 120, scale, nudgeDp: 2 }))

  // The mark on the login screen, drawn over a navy tile in Compose.
  await write(`drawable-${density}`, 'ic_volvia_mark.png', await glyph({ width: Math.round(30 * scale), color: WHITE }))
}

// Play Store listing icon: 512×512, opaque, full square (Play applies its own mask).
const playIcon = path.join(OUT, 'play-icon-512.png')
{
  const mark = await glyph({ width: 300, color: WHITE })
  const meta = await sharp(mark).metadata()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: brand.navy } })
    .composite([{ input: mark, left: Math.round((512 - meta.width) / 2), top: Math.round((512 - meta.height) / 2) - 6 }])
    .flatten({ background: brand.navy })
    .removeAlpha()
    .png()
    .toFile(playIcon)
  await assertSize(playIcon, 512, 512)
}

// Feature graphic: 1024×500, the somosvolvia.com hero gradient with the white logo.
const feature = path.join(OUT, 'feature-graphic-1024x500.png')
{
  const [from, to] = brand.gradient
  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
      </linearGradient></defs>
      <rect width="1024" height="500" fill="url(#g)"/></svg>`,
  )
  const logo = await sharp(path.join(ROOT, 'apps/web/public/brand/logo-inverse-full.png')).resize({ width: 560 }).toBuffer()
  const meta = await sharp(logo).metadata()
  await sharp(gradient)
    .composite([{ input: logo, left: Math.round((1024 - meta.width) / 2), top: Math.round((500 - meta.height) / 2) }])
    .flatten({ background: from })
    .removeAlpha()
    .png()
    .toFile(feature)
  await assertSize(feature, 1024, 500)
}

console.log(`res → ${path.relative(ROOT, RES)}\nstore → ${path.relative(ROOT, OUT)}`)
