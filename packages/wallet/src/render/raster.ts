import { Resvg } from '@resvg/resvg-js'

/**
 * SVG → PNG, in process.
 *
 * resvg ships as a prebuilt binary per platform (the Cloud Run image is linux-x64), has
 * no system dependencies and renders embedded raster images, which is all the pass
 * artwork needs. No text is ever drawn, so no font has to be shipped with it.
 */
export function renderPng(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false },
    logLevel: 'off',
  })
  return Buffer.from(resvg.render().asPng())
}

/**
 * Whether an image is a filled square: its edges painted all the way round, like a
 * logo exported as an app-icon badge. Those look framed twice when they are inset into
 * a tile, so they take the whole tile instead. The image is drawn letterboxed into a
 * small square, so anything not roughly square leaves its margins transparent and fails.
 * The outer quarter of each edge is skipped, so rounded corners still count as filled.
 */
export function fillsSquare(dataUri: string): boolean {
  const size = 32
  try {
    const resvg = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><image href="${dataUri}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/></svg>`,
      { font: { loadSystemFonts: false }, logLevel: 'off' },
    )
    const pixels = resvg.render().pixels
    const alpha = (x: number, y: number) => pixels[(y * size + x) * 4 + 3] ?? 0
    let edge = 0
    let opaque = 0
    for (let i = size / 4; i < (size * 3) / 4; i++) {
      for (const a of [alpha(i, 0), alpha(i, size - 1), alpha(0, i), alpha(size - 1, i)]) {
        edge++
        if (a > 200) opaque++
      }
    }
    return opaque / edge >= 0.9
  } catch {
    return false
  }
}
