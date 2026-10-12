import { type Database, automations, eq } from '@volvia/db'
import type { LiveOffer } from './offers'

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * The headline and body an offer shows. A campaign's words travel with the offer; a
 * birthday's come from the automation as it is configured *now*, so a business that
 * fixes a typo on Tuesday sees it on Wednesday's passes.
 */
export async function resolveOfferWords(
  db: Tx,
  offer: LiveOffer,
): Promise<{ headline: string; body: string }> {
  if (offer.source === 'campaign' || !offer.automationId) {
    return { headline: offer.headline, body: offer.body }
  }
  const [automation] = await db
    .select({ config: automations.config })
    .from(automations)
    .where(eq(automations.id, offer.automationId))
    .limit(1)
  return {
    headline: automation?.config.headline ?? offer.headline,
    body: automation?.config.body ?? offer.body,
  }
}
