import { createHash } from 'node:crypto'
import type { PassImages } from './apple/builder'
import { renderPng } from './render/raster'
import { type RemoteImage, loadRemoteImage } from './render/remote-image'
import {
  EMPTY_ARTWORK,
  type PassArtwork,
  lockupSvg,
  lockupWidth,
  stripSvg,
  tileSvg,
} from './render/svg'
import type { PassContent } from './types'

export type { PassArtwork, RemoteImage }
export { EMPTY_ARTWORK, lockupSvg, stripSvg, tileSvg }

/** Point sizes PassKit lays a store card out with; pixels are these × 1, 2 and 3. */
const APPLE = {
  icon: 29,
  logoHeight: 50,
  strip: { width: 375, height: 123 },
} as const

/** Pixel sizes Google documents for a loyalty card. */
export const GOOGLE_IMAGE_SIZES = {
  hero: { width: 1032, height: 336 },
  lockup: { width: 1032, height: 336 },
  logo: { width: 660, height: 660 },
} as const
export type GoogleImageKind = keyof typeof GOOGLE_IMAGE_SIZES

/** Fetches the uploads the design refers to. Failures degrade to the drawn fallbacks. */
export async function loadPassArtwork(content: PassContent): Promise<PassArtwork> {
  const [logo, stampIcon] = await Promise.all([
    content.logoUrl ? loadRemoteImage(content.logoUrl) : null,
    content.stampIcon.kind === 'image' ? loadRemoteImage(content.stampIcon.value) : null,
  ])
  return { logo, stampIcon }
}

/** Every PNG a `.pkpass` carries, at the three densities current iPhones use. */
export function buildAppleImages(
  content: PassContent,
  artwork: PassArtwork = EMPTY_ARTWORK,
): PassImages {
  const tile = tileSvg(content, APPLE.icon, artwork)
  const lockup = lockupSvg(content, lockupWidth(APPLE.logoHeight), APPLE.logoHeight, artwork)
  const strip = stripSvg(content, APPLE.strip.width, APPLE.strip.height, artwork)
  const lockupW = lockupWidth(APPLE.logoHeight)

  return {
    'icon.png': renderPng(tile, APPLE.icon),
    'icon@2x.png': renderPng(tile, APPLE.icon * 2),
    'icon@3x.png': renderPng(tile, APPLE.icon * 3),
    'logo.png': renderPng(lockup, lockupW),
    'logo@2x.png': renderPng(lockup, lockupW * 2),
    'logo@3x.png': renderPng(lockup, lockupW * 3),
    'strip.png': renderPng(strip, APPLE.strip.width),
    'strip@2x.png': renderPng(strip, APPLE.strip.width * 2),
    'strip@3x.png': renderPng(strip, APPLE.strip.width * 3),
  }
}

/** One of the pictures Google fetches by URL: the hero strip, the wide logo, the round logo. */
export function renderGoogleImage(
  kind: GoogleImageKind,
  content: PassContent,
  artwork: PassArtwork = EMPTY_ARTWORK,
): Buffer {
  const size = GOOGLE_IMAGE_SIZES[kind]
  switch (kind) {
    case 'hero':
      return renderPng(stripSvg(content, size.width, size.height, artwork), size.width)
    case 'lockup':
      return renderPng(lockupSvg(content, size.width, size.height, artwork), size.width)
    default:
      return renderPng(tileSvg(content, size.width, artwork), size.width)
  }
}

/**
 * A short fingerprint of everything the images depend on. Google caches an image by
 * its URL, so the URL has to change when the picture does: on every stamp, and on any
 * change to the design.
 */
export function imageVersion(content: PassContent): string {
  const hash = createHash('sha1')
  hash.update(
    JSON.stringify([
      content.stampsCount,
      content.stampsRequired,
      content.rewardPositions,
      content.backgroundColor,
      content.foregroundColor,
      content.labelColor,
      content.emptyStampColor,
      content.stampIcon,
      content.stampStyle,
      content.logoUrl,
    ]),
  )
  return hash.digest('hex').slice(0, 12)
}
