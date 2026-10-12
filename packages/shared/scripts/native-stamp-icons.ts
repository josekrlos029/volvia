/**
 * Writes the stamp glyphs into the two native apps.
 *
 * `src/stamp-icons.ts` is the one definition: the web card, the wallet passes and the
 * staff apps all draw from it. Android gets VectorDrawables, iOS gets template SVGs in
 * its asset catalogue, both tinted at runtime with the card's own colours. Run it after
 * changing a glyph; `test/native-stamp-icons.test.ts` fails until you do.
 *
 *   pnpm --filter @volvia/shared native-icons
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nativeStampGlyphs } from '../src/native-stamp-icons'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const androidDir = join(root, 'apps/android/app/src/main/res/drawable')
const iosDir = join(root, 'apps/ios/Resources/Assets.xcassets/Stamps')

const glyphs = nativeStampGlyphs()

mkdirSync(androidDir, { recursive: true })
for (const file of readdirSync(androidDir)) {
  if (file.startsWith('stamp_')) rmSync(join(androidDir, file))
}
rmSync(iosDir, { recursive: true, force: true })
mkdirSync(iosDir, { recursive: true })
writeFileSync(
  join(iosDir, 'Contents.json'),
  `${JSON.stringify({ info: { author: 'xcode', version: 1 }, properties: { 'provides-namespace': true } }, null, 2)}\n`,
)

for (const glyph of glyphs) {
  writeFileSync(join(androidDir, `${glyph.androidName}.xml`), glyph.androidXml)

  const set = join(iosDir, `${glyph.name}.imageset`)
  mkdirSync(set, { recursive: true })
  writeFileSync(join(set, `${glyph.name}.svg`), glyph.svg)
  writeFileSync(
    join(set, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [{ filename: `${glyph.name}.svg`, idiom: 'universal' }],
        info: { author: 'xcode', version: 1 },
        properties: {
          'preserves-vector-representation': true,
          'template-rendering-intent': 'template',
        },
      },
      null,
      2,
    )}\n`,
  )
}

console.log(`wrote ${glyphs.length} glyphs to Android and iOS`)
