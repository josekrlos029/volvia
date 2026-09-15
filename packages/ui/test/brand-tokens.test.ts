import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { brand } from '../src/brand'

const css = readFileSync(fileURLToPath(new URL('../src/styles/theme.css', import.meta.url)), 'utf8')

function cssVar(name: string): string | null {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return match?.[1]?.trim() ?? null
}

/**
 * The palette lives in two places by necessity (TS for wallet passes and OG images,
 * CSS for Tailwind). This test is what keeps swapping the brand a one-step change.
 */
describe('brand tokens', () => {
  const pairs: Array<[string, string]> = [
    ['color-primary', brand.colors.primary],
    ['color-primary-hover', brand.colors.primaryHover],
    ['color-primary-soft', brand.colors.primarySoft],
    ['color-accent', brand.colors.accent],
    ['color-accent-soft', brand.colors.accentSoft],
    ['color-ink', brand.colors.ink],
    ['color-ink-muted', brand.colors.inkMuted],
    ['color-line', brand.colors.line],
    ['color-surface', brand.colors.surface],
    ['color-surface-muted', brand.colors.surfaceMuted],
    ['color-inverse-surface', brand.colors.inverseSurface],
    ['color-success', brand.colors.success],
    ['color-warning', brand.colors.warning],
    ['color-danger', brand.colors.danger],
    ['color-info', brand.colors.info],
  ]

  for (const [variable, value] of pairs) {
    it(`--${variable} matches brand.ts`, () => {
      expect(cssVar(variable)?.toUpperCase()).toBe(value.toUpperCase())
    })
  }
})
