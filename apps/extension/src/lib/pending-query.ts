import { browser } from 'wxt/browser'

/**
 * Text selected on a page and sent with "Buscar en Volvia". The background script
 * stores it and opens the popup, which picks it up once and clears it.
 */
const KEY = 'volvia.pendingQuery'

export async function setPendingQuery(query: string): Promise<void> {
  await browser.storage.local.set({ [KEY]: query.trim().slice(0, 200) })
}

export async function takePendingQuery(): Promise<string | null> {
  const stored = await browser.storage.local.get(KEY)
  const query = (stored[KEY] as string | undefined) ?? null
  if (query) await browser.storage.local.remove(KEY)
  return query
}
