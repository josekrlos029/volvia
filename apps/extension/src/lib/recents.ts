import type { RemoteLookupItem } from '@volvia/shared'
import { browser } from 'wxt/browser'

/**
 * The last few customers stamped from this browser, per business, so the regular
 * who orders every Friday is one tap away. Only what the list shows is kept.
 */
export interface Recent {
  query: string
  firstName: string
  tail: string | null
  cardName: string
  stampsCount: number
  stampsRequired: number
}

const MAX_RECENTS = 5
const key = (orgId: string) => `volvia.recents.${orgId}`

export async function loadRecents(orgId: string): Promise<Recent[]> {
  const stored = await browser.storage.local.get(key(orgId))
  return (stored[key(orgId)] as Recent[] | undefined) ?? []
}

export async function rememberRecent(
  orgId: string,
  item: RemoteLookupItem,
  stampsCount: number,
): Promise<void> {
  const recent: Recent = {
    // Searching the card link again finds exactly this card.
    query: `/c/${item.cardToken}`,
    firstName: item.customer.firstName,
    tail: item.customer.documentTail ?? item.customer.phoneTail,
    cardName: item.design.cardName,
    stampsCount,
    stampsRequired: item.stampsRequired,
  }
  const others = (await loadRecents(orgId)).filter((entry) => entry.query !== recent.query)
  await browser.storage.local.set({ [key(orgId)]: [recent, ...others].slice(0, MAX_RECENTS) })
}
