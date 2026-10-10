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
