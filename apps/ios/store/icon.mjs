// App icon (1024, opaque, no rounded corners: Apple masks it), the iOS 18 dark and tinted
// variants, the launch-screen logo and the simulator camera backdrop. Writes out/icon/ and
// installs the chosen variant into Resources/Assets.xcassets so the next build picks it up.
//
//   node icon.mjs                 navy background (default)
//   ICON_VARIANT=violet node icon.mjs
//   SIM_PHOTO=volvia-counter-service.webp node icon.mjs
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { ASSETS, OUT, ROOT, assertSize, brand, ensureDir, glyph } from './lib.mjs'

const dir = await ensureDir(path.join(OUT, 'icon'))
const SIZE = 1024
const GLYPH_WIDTH = 600

async function composeIcon({ background, foreground, file, transparent = false }) {
  const mark = await glyph({ width: GLYPH_WIDTH, color: foreground })
  const meta = await sharp(mark).metadata()
  const left = Math.round((SIZE - meta.width) / 2)
  // The "V" reads bottom-heavy; nudging it up a touch centres it optically.
  const top = Math.round((SIZE - meta.height) / 2) - 12
  const target = path.join(dir, file)

  if (transparent) {
    await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: mark, left, top }])
      .png()
      .toFile(target)
    return target
  }

  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background } })
    .composite([{ input: mark, left, top }])
    .flatten({ background })
    .removeAlpha()
    .png()
    .toFile(target)
  await assertSize(target, SIZE, SIZE)
  return target
}

const variant = process.env.ICON_VARIANT ?? 'navy'
const variants = {
  navy: { background: brand.navy, foreground: '#FFFFFF' },
  violet: { background: brand.violet, foreground: '#FFFFFF' },
}
if (!variants[variant]) throw new Error(`ICON_VARIANT must be one of ${Object.keys(variants).join(', ')}`)

const light = {}
for (const [name, colors] of Object.entries(variants)) {
  light[name] = await composeIcon({ ...colors, file: `AppIcon-1024-${name}.png` })
}
// Dark: iOS 18 supplies the dark background itself, so the glyph goes on transparent.
const dark = await composeIcon({ foreground: brand.violet, file: 'AppIcon-dark-1024.png', transparent: true })
// Tinted: Apple wants a grayscale image on transparent; the system applies the user's tint.
const tinted = await composeIcon({ foreground: '#FFFFFF', file: 'AppIcon-tinted-1024.png', transparent: true })

// Launch logo: 120 pt, white, @1x/@2x/@3x.
const launch = {}
for (const scale of [1, 2, 3]) {
  const file = path.join(dir, `LaunchLogo${scale === 1 ? '' : `@${scale}x`}.png`)
  await fs.writeFile(file, await glyph({ width: 120 * scale, color: '#FFFFFF' }))
  launch[scale] = file
}

// Simulator camera backdrop: a portrait crop of a marketing photo. Only simulator builds
// ship it (EXCLUDED_SOURCE_FILE_NAMES[sdk=iphoneos*] in project.yml).
const photo = path.join(ROOT, 'apps/web/public/photos', process.env.SIM_PHOTO ?? 'volvia-staff-scanner.webp')
const backdrop = path.join(dir, 'SimulatedCamera.jpg')
await sharp(photo).resize(1440, 2868, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82 }).toFile(backdrop)

// Install into the asset catalog.
const appIcon = path.join(ASSETS, 'AppIcon.appiconset')
await fs.copyFile(light[variant], path.join(appIcon, 'AppIcon-1024.png'))
await fs.copyFile(dark, path.join(appIcon, 'AppIcon-dark-1024.png'))
await fs.copyFile(tinted, path.join(appIcon, 'AppIcon-tinted-1024.png'))
const launchSet = path.join(ASSETS, 'LaunchLogo.imageset')
for (const scale of [1, 2, 3]) {
  await fs.copyFile(launch[scale], path.join(launchSet, path.basename(launch[scale])))
}
await fs.copyFile(backdrop, path.join(path.resolve(ASSETS, '..'), 'Simulator', 'SimulatedCamera.jpg'))

console.log(`icon: ${variant} installed in ${path.relative(ROOT, appIcon)}; all variants in ${path.relative(ROOT, dir)}`)
