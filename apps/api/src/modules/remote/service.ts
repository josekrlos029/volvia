import {
  type Database,
  and,
  asc,
  customerCards,
  customers,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  organizations,
  rewardGrants,
  rewards,
  sql,
  stampCards,
} from '@volvia/db'
import type { RemoteLookupItem, RemoteStatus } from '@volvia/shared'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { stampResultDesign } from '../loyalty/service'
import { classifyQuery } from './query'

const MAX_RESULTS = 20

export interface RemoteSettings {
  enabled: boolean
  requireOrder: boolean
}

export async function remoteStatus(db: Database, orgId: string): Promise<RemoteStatus> {
  const [org] = await db
    .select({
      name: organizations.name,
      logoUrl: organizations.logoUrl,
      settings: organizations.settings,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  if (!org) throw new AppError('ORG_NOT_FOUND', { message: 'organization not found' })
  return {
    enabled: org.settings?.remoteStamping === true,
    requireOrder: org.settings?.remoteStampingRequireOrder === true,
    businessName: org.name,
    logoUrl: org.logoUrl,
  }
}

/** Every remote endpoint goes through here: the owner must have turned it on. */
export async function assertRemoteStamping(db: Database, orgId: string): Promise<RemoteSettings> {
  const status = await remoteStatus(db, orgId)
  if (!status.enabled) {
    throw new AppError('REMOTE_STAMPING_DISABLED', {
      message: 'this business has not enabled remote stamping',
    })
  }
  return { enabled: true, requireOrder: status.requireOrder }
}

const tail = (value: string | null) => (value ? value.slice(-4) : null)

/**
 * Finds the cards a delivery order could belong to. A number matches the cédula
 * exactly or appears anywhere in the phone (people drop the +57, or give only the
 * last digits); anything else is a name. Results are cards, not customers, so the
 * staff member picks the right programme in one tap.
 */
export async function lookupCards(
  db: Database,
  orgId: string,
  rawQuery: string,
): Promise<RemoteLookupItem[]> {
  const query = classifyQuery(rawQuery.trim())

  const match =
    query.kind === 'token'
      ? eq(customerCards.token, query.token)
      : query.kind === 'number'
        ? or(
            eq(customers.documentNumber, query.value),
            ...(/^[0-9]+$/.test(query.value) ? [ilike(customers.phone, `%${query.value}%`)] : []),
          )!
        : or(
            ilike(customers.firstName, `%${rawQuery.trim()}%`),
            ilike(customers.email, `${rawQuery.trim()}%`),
          )!

  const rows = await db
    .select({
      customerCard: customerCards,
      card: stampCards,
      customer: customers,
      org: { name: organizations.name, logoUrl: organizations.logoUrl },
      pending: sql<number>`(select count(*)::int from ${rewardGrants} where ${rewardGrants.customerCardId} = ${customerCards.id} and ${rewardGrants.status} = 'pending')`,
    })
    .from(customerCards)
    .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
    .innerJoin(customers, eq(customers.id, customerCards.customerId))
    .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
    .where(
      and(
        eq(customerCards.orgId, orgId),
        eq(customerCards.status, 'active'),
        eq(stampCards.status, 'active'),
        isNull(customers.deletedAt),
        match,
      ),
    )
    .orderBy(sql`${customerCards.lastStampAt} desc nulls last`, asc(customers.firstName))
    .limit(MAX_RESULTS)

  if (rows.length === 0) return []

  const cardIds = [...new Set(rows.map((row) => row.card.id))]
  const cardRewards = await db
    .select({ cardId: rewards.cardId, atStamp: rewards.atStamp, title: rewards.title })
    .from(rewards)
    .where(inArray(rewards.cardId, cardIds))
    .orderBy(rewards.atStamp)

  return rows.map((row) => ({
    cardToken: row.customerCard.token,
    customerCardId: row.customerCard.id,
    customer: {
      id: row.customer.id,
      firstName: row.customer.firstName,
      phoneTail: tail(row.customer.phone),
      documentTail: tail(row.customer.documentNumber),
    },
    stampsCount: row.customerCard.stampsCount,
    stampsRequired: row.card.stampsRequired,
    pendingRewards: row.pending,
    lastStampAt: row.customerCard.lastStampAt,
    missingDocument: row.card.collectDocument && !row.customer.documentNumber,
    design: stampResultDesign({
      org: row.org,
      card: row.card,
      rewards: cardRewards.filter((reward) => reward.cardId === row.card.id),
      stampsCount: row.customerCard.stampsCount,
    }),
  }))
}

/** The sign-up link for the business's oldest live card, to paste into the chat. */
export async function primaryJoinUrl(db: Database, orgId: string): Promise<string | null> {
  const [card] = await db
    .select({ joinSlug: stampCards.joinSlug })
    .from(stampCards)
    .where(and(eq(stampCards.orgId, orgId), eq(stampCards.status, 'active')))
    .orderBy(asc(stampCards.createdAt))
    .limit(1)
  return card ? `${env.PASS_URL}/j/${card.joinSlug}` : null
}

/** Lets staff fill in a cédula the first time they find a customer some other way. */
export async function saveDocumentNumber(
  db: Database,
  orgId: string,
  customerId: string,
  documentNumber: string,
): Promise<{ documentTail: string }> {
  const [updated] = await db
    .update(customers)
    .set({ documentNumber, updatedAt: new Date() })
    .where(
      and(eq(customers.id, customerId), eq(customers.orgId, orgId), isNull(customers.deletedAt)),
    )
    .returning({ documentNumber: customers.documentNumber })
  if (!updated) throw new AppError('NOT_FOUND', { message: 'customer not found' })
  return { documentTail: documentNumber.slice(-4) }
}
