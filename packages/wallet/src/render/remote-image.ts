/**
 * Fetches a business's uploaded artwork so it can be embedded in the pass images.
 *
 * Uploads live in object storage behind a public URL. A pass is rebuilt on every stamp,
 * so the bytes are cached for a while: the logo changes once a year, the stamp count
 * changes every visit.
 */
export interface RemoteImage {
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/svg+xml'
  dataUri: string
}

interface CacheEntry {
  expiresAt: number
  value: RemoteImage | null
}

const TTL_OK_MS = 10 * 60 * 1000
const TTL_FAIL_MS = 60 * 1000
const MAX_ENTRIES = 200
const cache = new Map<string, CacheEntry>()

function sniffMime(bytes: Buffer, declared: string): RemoteImage['mime'] | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg'
  if (bytes.length >= 6 && bytes.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif'
  const head = bytes.subarray(0, 512).toString('utf8').trimStart()
  if (head.startsWith('<svg') || head.startsWith('<?xml') || declared.includes('svg'))
    return 'image/svg+xml'
  // WebP and anything else: the rasteriser cannot decode it, so the pass falls back to
  // the stamp icon tile rather than shipping a broken image.
  return null
}

export async function loadRemoteImage(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<RemoteImage | null> {
  const now = Date.now()
  const hit = cache.get(url)
  if (hit && hit.expiresAt > now) return hit.value

  const value = await fetchImage(
    url,
    options.timeoutMs ?? 4000,
    options.maxBytes ?? 2 * 1024 * 1024,
  )

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(url, { value, expiresAt: now + (value ? TTL_OK_MS : TTL_FAIL_MS) })
  return value
}

async function fetchImage(
  url: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<RemoteImage | null> {
  if (!/^https?:\/\//.test(url)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok) return null
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > maxBytes) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0 || bytes.length > maxBytes) return null
    const mime = sniffMime(bytes, response.headers.get('content-type') ?? '')
    if (!mime) return null
    return { mime, dataUri: `data:${mime};base64,${bytes.toString('base64')}` }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Test seam: forget everything fetched so far. */
export function clearRemoteImageCache(): void {
  cache.clear()
}
