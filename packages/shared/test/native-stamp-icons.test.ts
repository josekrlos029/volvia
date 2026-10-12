import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { nativeStampGlyphs } from '../src/native-stamp-icons'

const root = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * The staff apps draw the same glyphs as the web card and the passes. The files in the
 * apps are generated; this fails when a glyph changed here and the script was not run.
 */
describe('native stamp glyphs', () => {
  for (const glyph of nativeStampGlyphs()) {
    it(`${glyph.name} is current in both apps`, () => {
      const android = readFileSync(
        `${root}apps/android/app/src/main/res/drawable/${glyph.androidName}.xml`,
        'utf8',
      )
      const ios = readFileSync(
        `${root}apps/ios/Resources/Assets.xcassets/Stamps/${glyph.name}.imageset/${glyph.name}.svg`,
        'utf8',
      )
      expect(android, 'run: pnpm --filter @volvia/shared native-icons').toBe(glyph.androidXml)
      expect(ios, 'run: pnpm --filter @volvia/shared native-icons').toBe(glyph.svg)
    })
  }
})
