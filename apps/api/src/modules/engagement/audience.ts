import { type Database, and, count, customerCards, customers, eq, inArray } from '@volvia/db'
import type { Audience } from '@volvia/shared'

/**
 * How many people a campaign or message would actually reach.
 *
 * Shown before sending, because "this goes to 340 customers" is the number a business
 * needs to see before committing — and because consent filtering can make the real
 * audience much smaller than the segment suggests.
 */
export async function resolveAudienceSize(
  db: Database,
  orgId: string,
  audience: Audience,
): Promise<number> {
  const conditions = [eq(customerCards.orgId, orgId), eq(customerCards.status, 'active')]

  if (audience.cardIds.length > 0) conditions.push(inArray(customerCards.cardId, audience.cardIds))
  if (audience.customerIds.length > 0) {
    conditions.push(inArray(customerCards.customerId, audience.customerIds))
  }
  if (audience.consentOnly) conditions.push(eq(customers.marketingConsent, true))

  const [row] = await db
    .select({ value: count() })
    .from(customerCards)
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .where(and(...conditions))

  return row?.value ?? 0
}
