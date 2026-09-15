import { deflateSync } from 'node:zlib'

/**
 * Minimal PNG encoder.
 *
 * A pass must ship an `icon.png`, and most businesses have not uploaded artwork when
 * they publish their first card. Rather than pull in a native image library — which
 * would complicate the Cloud Run image — we emit a small, valid PNG in the card's own
 * colours. It is a placeholder that looks deliberate, not broken.
 */

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHexColor(hex: string): Rgb {
  const normalised = hex.replace('#', '')
  const full =
    normalised.length === 3
      ? normalised
          .split('')
          .map((char) => char + char)
          .join('')
      : normalised
  const value = Number.parseInt(full, 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export type Pixel = { r: number; g: number; b: number; a: number }

/**
 * Encodes an RGBA image. `pixel(x, y)` returns the colour of each pixel, which keeps
 * the encoder generic enough to draw both the flat strip and the rounded badge below.
 */
export function encodePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Pixel,
): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  // Each scanline is prefixed with its filter type; 0 (None) keeps this simple.
  const raw = Buffer.alloc(height * (width * 4 + 1))
  let offset = 0
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0
    offset += 1
    for (let x = 0; x < width; x += 1) {
      const { r, g, b, a } = pixel(x, y)
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
      offset += 4
    }
  }

  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** A rounded square in the card's colours — the default pass icon. */
export function generateIcon(size: number, backgroundHex: string, accentHex: string): Buffer {
  const background = parseHexColor(backgroundHex)
  const accent = parseHexColor(accentHex)
  const radius = size * 0.22
  const centre = size / 2
  const dotRadius = size * 0.18

  return encodePng(size, size, (x, y) => {
    // Round the corners so the icon does not look like a raw block in the Wallet list.
    const cornerX = Math.max(radius - x, x - (size - radius), 0)
    const cornerY = Math.max(radius - y, y - (size - radius), 0)
    if (Math.hypot(cornerX, cornerY) > radius) {
      return { r: 0, g: 0, b: 0, a: 0 }
    }
    // A single accent dot stands in for the stamp mark.
    if (Math.hypot(x - centre, y - centre) <= dotRadius) {
      return { ...accent, a: 255 }
    }
    return { ...background, a: 255 }
  })
}

/** A flat strip image used as the pass banner when no artwork was uploaded. */
export function generateStrip(width: number, height: number, hex: string): Buffer {
  const colour = parseHexColor(hex)
  return encodePng(width, height, () => ({ ...colour, a: 255 }))
}
