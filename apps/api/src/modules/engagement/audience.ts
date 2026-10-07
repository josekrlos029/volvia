import { type Database, and, count, customerCards, customers, eq, inArray } from '@volvia/db'
import type { Audience, VisitFrequency } from '@volvia/shared'
import { segmentCondition } from '../../lib/segments'

/**
 * How many people a campaign or message would actually reach.
 *
 * Shown before sending, because "this goes to 340 customers" is the number a business
 * needs to see before committing — and because consent filtering can make the real
 * audience much smaller than the segment suggests.
 *
 * The worker that sends resolves the audience with the same conditions, so what is
 * previewed here is what leaves.
 */
export function audienceConditions(orgId: string, audience: Audience, frequency: VisitFrequency) {
  const conditions = [eq(customerCards.orgId, orgId), eq(customerCards.status, 'active')]

  if (audience.cardIds.length > 0) conditions.push(inArray(customerCards.cardId, audience.cardIds))
  if (audience.customerIds.length > 0) {
    conditions.push(inArray(customerCards.customerId, audience.customerIds))
  }
  if (audience.consentOnly) conditions.push(eq(customers.marketingConsent, true))

  const segment = segmentCondition(audience.segment, frequency)
  if (segment) conditions.push(segment)

  return and(...conditions)
}

export async function resolveAudienceSize(
  db: Database,
  orgId: string,
  audience: Audience,
  frequency: VisitFrequency,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(customerCards)
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .where(audienceConditions(orgId, audience, frequency))

  return row?.value ?? 0
}
