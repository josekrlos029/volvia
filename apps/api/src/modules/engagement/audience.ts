import {
  type Database,
  and,
  count,
  customerCards,
  customers,
  eq,
  inArray,
  isNull,
  sql,
  walletPasses,
} from '@volvia/db'
import type { Audience, SegmentDefinition, VisitFrequency } from '@volvia/shared'
import { segmentDefinitionConditions } from '../../lib/segments'
import { resolveSegmentDefinition } from '../segments/service'

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
export function audienceConditions(
  orgId: string,
  audience: Audience,
  definition: SegmentDefinition,
  frequency: VisitFrequency,
  now: Date = new Date(),
) {
  const conditions = [
    eq(customerCards.orgId, orgId),
    eq(customerCards.status, 'active'),
    // A deleted customer keeps an anonymised row; it must never be reached.
    isNull(customers.deletedAt),
  ]

  if (audience.cardIds.length > 0) conditions.push(inArray(customerCards.cardId, audience.cardIds))
  if (audience.customerIds.length > 0) {
    conditions.push(inArray(customerCards.customerId, audience.customerIds))
  }
  if (audience.consentOnly) conditions.push(eq(customers.marketingConsent, true))

  conditions.push(...segmentDefinitionConditions(definition, frequency, now))

  return and(...conditions)
}

/** The audience's saved, suggested or plain segment, as one definition. */
export async function resolveAudienceDefinition(
  db: Database,
  orgId: string,
  audience: Audience,
  options: { allowDeleted?: boolean } = {},
): Promise<SegmentDefinition> {
  return resolveSegmentDefinition(db, orgId, audience, options)
}

export async function resolveAudienceSize(
  db: Database,
  orgId: string,
  audience: Audience,
  frequency: VisitFrequency,
): Promise<number> {
  return (await resolveAudienceReach(db, orgId, audience, frequency)).size
}

export interface AudienceReach {
  size: number
  /** Cards with at least one wallet pass: the only ones a push can reach. */
  withWallet: number
  applePasses: number
  googlePasses: number
}

/**
 * Reach, split by whether a push can actually arrive. A message to 120 people of whom
 * 30 carry the pass is a message to 30 people, and the business should know before
 * it sends.
 */
export async function resolveAudienceReach(
  db: Database,
  orgId: string,
  audience: Audience,
  frequency: VisitFrequency,
): Promise<AudienceReach> {
  const definition = await resolveAudienceDefinition(db, orgId, audience)

  const [row] = await db
    .select({
      size: count(sql`distinct ${customerCards.id}`),
      withWallet: sql<number>`count(distinct ${walletPasses.customerCardId})::int`,
      applePasses: sql<number>`count(*) filter (where ${walletPasses.platform} = 'apple')::int`,
      googlePasses: sql<number>`count(*) filter (where ${walletPasses.platform} = 'google')::int`,
    })
    .from(customerCards)
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .leftJoin(
      walletPasses,
      and(eq(walletPasses.customerCardId, customerCards.id), isNull(walletPasses.revokedAt)),
    )
    .where(audienceConditions(orgId, audience, definition, frequency))

  return {
    size: row?.size ?? 0,
    withWallet: row?.withWallet ?? 0,
    applePasses: row?.applePasses ?? 0,
    googlePasses: row?.googlePasses ?? 0,
  }
}
