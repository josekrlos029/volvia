import JSZip from 'jszip'
import type { PassContent } from '../types'
import { buildManifest } from './manifest'
import { type PassJsonOptions, buildPassJson } from './pass-json'
import { type SigningMaterial, signManifest } from './signer'

/**
 * Images a pass needs. PassKit requires at least `icon.png`; the rest improve how the
 * pass looks in the Wallet list and on the lock screen. We generate simple ones from
 * the card design when the business has not uploaded artwork.
 */
export interface PassImages {
  'icon.png': Buffer
  'icon@2x.png'?: Buffer
  'logo.png'?: Buffer
  'logo@2x.png'?: Buffer
  'strip.png'?: Buffer
  'strip@2x.png'?: Buffer
}

export interface BuildPassInput {
  content: PassContent
  options: PassJsonOptions
  images: PassImages
  signing: SigningMaterial
}

/** Produces a complete, signed `.pkpass` archive. */
export async function buildPkpass(input: BuildPassInput): Promise<Buffer> {
  const files = new Map<string, Buffer>()

  const passJson = buildPassJson(input.content, input.options)
  files.set('pass.json', Buffer.from(JSON.stringify(passJson, null, 2), 'utf8'))

  for (const [name, contents] of Object.entries(input.images)) {
    if (contents) files.set(name, contents)
  }

  const manifest = Buffer.from(JSON.stringify(buildManifest(files), null, 2), 'utf8')
  const signature = signManifest(manifest, input.signing)

  const zip = new JSZip()
  for (const [name, contents] of files) zip.file(name, contents)
  zip.file('manifest.json', manifest)
  zip.file('signature', signature)

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
}
