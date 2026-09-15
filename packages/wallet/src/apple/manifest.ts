import { createHash } from 'node:crypto'

/**
 * A `.pkpass` is a zip whose `manifest.json` maps every file to its SHA-1, and whose
 * `signature` is a detached PKCS#7 over that manifest. Apple rejects the pass if a
 * single byte of any file disagrees with the manifest, so this must stay exact.
 */
export function buildManifest(files: Map<string, Buffer>): Record<string, string> {
  const manifest: Record<string, string> = {}
  for (const [name, contents] of files) {
    // SHA-1 is mandated by the PassKit spec here; it is an integrity map, not a
    // security boundary — the PKCS#7 signature over this manifest provides that.
    manifest[name] = createHash('sha1').update(contents).digest('hex')
  }
  return manifest
}
