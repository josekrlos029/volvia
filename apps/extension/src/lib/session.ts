import type { SessionUser } from '@volvia/shared'
import { browser } from 'wxt/browser'

/**
 * What the extension remembers between openings. Lives in `storage.local`, which only
 * this extension can read; the popup loads it once and keeps a copy in memory so the
 * API client can read the token synchronously.
 */
export interface StoredSession {
  accessToken: string
  refreshToken: string
  user: SessionUser
  /** The business stamps go to; chosen once when the person belongs to several. */
  orgId: string | null
}

const KEY = 'volvia.session'

export async function loadSession(): Promise<StoredSession | null> {
  const stored = await browser.storage.local.get(KEY)
  return (stored[KEY] as StoredSession | undefined) ?? null
}

export async function saveSession(session: StoredSession | null): Promise<void> {
  if (session) await browser.storage.local.set({ [KEY]: session })
  else await browser.storage.local.remove(KEY)
}
