import {
  type Database,
  analyticsDaily,
  and,
  customerCards,
  customers,
  desc,
  eq,
  organizations,
  rewardGrants,
  sql,
  stampCards,
  stampEvents,
} from '@volvia/db'
import { AppError } from '../../lib/errors'
import { OUTBOX_KINDS, enqueue } from '../../lib/outbox'
import { orgDay, orgHour } from '../../lib/time'

export interface RedeemCommand {
  orgId: string
  grantId?: string
  code?: string
  cardToken?: string
  locationId?: string | null
  actorUserId: string
  idempotencyKey: string
}

export interface RedeemResult {
  grantId: string
  title: string
  redeemedAt: Date
  customer: { id: string; firstName: string }
  stampsCount: number
  stampsRequired: number
  /** Rewards still waiting after this one was handed over. */
  remainingPending: number
}

/**
 * Hands a reward over.
 *
 * The grant row is locked and re-checked inside the transaction, so two staff members
 * redeeming the same code at once cannot both succeed — one gets a clear conflict.
 */
export async function redeemReward(db: Database, command: RedeemCommand): Promise<RedeemResult> {
  const now = new Date()

  return db.transaction(async (tx) => {
    const conditions = [eq(rewardGrants.orgId, command.orgId)]
    if (command.grantId) conditions.push(eq(rewardGrants.id, command.grantId))
    if (command.code) conditions.push(eq(rewardGrants.code, command.code.toUpperCase()))

    const query = tx
      .select({ grant: rewardGrants, customerCard: customerCards })
      .from(rewardGrants)
      .innerJoin(customerCards, eq(customerCards.id, rewardGrants.customerCardId))
      .$dynamic()

    if (command.cardToken && !command.grantId && !command.code) {
      // Staff scanned the customer's card: take the oldest reward still waiting.
      conditions.push(eq(customerCards.token, command.cardToken))
      conditions.push(eq(rewardGrants.status, 'pending'))
    }

    const [row] = await query
      .where(and(...conditions))
      .orderBy(rewardGrants.grantedAt)
      .for('update', { of: rewardGrants })
      .limit(1)

    if (!row) throw new AppError('REWARD_NOT_AVAILABLE', { message: 'no reward found to redeem' })

    if (row.grant.status === 'redeemed') {
      throw new AppError('REWARD_ALREADY_REDEEMED', {
        message: 'this reward was already redeemed',
        logContext: { redeemedAt: row.grant.redeemedAt },
      })
    }
    if (row.grant.status !== 'pending') {
      throw new AppError('REWARD_NOT_AVAILABLE', { message: `reward is ${row.grant.status}` })
    }
    if (row.grant.expiresAt && row.grant.expiresAt.getTime() < now.getTime()) {
      await tx
        .update(rewardGrants)
        .set({ status: 'expired' })
        .where(eq(rewardGrants.id, row.grant.id))
      throw new AppError('REWARD_NOT_AVAILABLE', { message: 'this reward has expired' })
    }

    await tx
      .update(rewardGrants)
      .set({
        status: 'redeemed',
        redeemedAt: now,
        redeemedBy: command.actorUserId,
        redeemedLocationId: command.locationId ?? null,
      })
      .where(eq(rewardGrants.id, row.grant.id))

    const [context] = await tx
      .select({ org: organizations, card: stampCards, customer: customers })
      .from(customerCards)
      .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .innerJoin(customers, eq(customers.id, customerCards.customerId))
      .where(eq(customerCards.id, row.customerCard.id))
      .limit(1)

    if (context) {
      await tx
        .insert(analyticsDaily)
        .values({
          orgId: context.org.id,
          cardId: context.card.id,
          locationId: command.locationId ?? null,
          day: orgDay(now, context.org.timezone),
          rewardsRedeemed: 1,
          hourly: Array.from({ length: 24 }, () => 0),
        })
        .onConflictDoUpdate({
          target: [
            analyticsDaily.orgId,
            analyticsDaily.cardId,
            analyticsDaily.locationId,
            analyticsDaily.day,
          ],
          set: {
            rewardsRedeemed: sql`${analyticsDaily.rewardsRedeemed} + 1`,
            updatedAt: now,
          },
        })
    }

    await enqueue(
      tx,
      OUTBOX_KINDS.walletUpdate,
      { customerCardId: row.customerCard.id, reason: 'redeem' },
      { orgId: command.orgId },
    )

    // A redemption is the natural moment to ask for feedback or a review.
    await enqueue(
      tx,
      OUTBOX_KINDS.reviewRequest,
      { customerCardId: row.customerCard.id, grantId: row.grant.id },
      { orgId: command.orgId },
    )

    const [pending] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.customerCardId, row.customerCard.id),
          eq(rewardGrants.status, 'pending'),
        ),
      )

    return {
      grantId: row.grant.id,
      title: row.grant.title,
      redeemedAt: now,
      customer: {
        id: context?.customer.id ?? '',
        firstName: context?.customer.firstName ?? '',
      },
      stampsCount: row.customerCard.stampsCount,
      stampsRequired: context?.card.stampsRequired ?? 0,
      remainingPending: pending?.value ?? 0,
    }
  })
}

/** Manual correction from the dashboard. Always audited, never subject to scan rules. */
export async function adjustStamps(
  db: Database,
  input: {
    orgId: string
    customerCardId: string
    delta: number
    reason: string
    actorUserId: string
    idempotencyKey: string
  },
) {
  const now = new Date()

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ customerCard: customerCards, card: stampCards })
      .from(customerCards)
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .where(and(eq(customerCards.id, input.customerCardId), eq(customerCards.orgId, input.orgId)))
      .for('update', { of: customerCards })
      .limit(1)

    if (!row) throw new AppError('CUSTOMER_CARD_NOT_FOUND', { message: 'card not found' })

    // Corrections clamp to the card, they never create a negative or overflowing count.
    const next = Math.max(
      0,
      Math.min(row.card.stampsRequired - 1, row.customerCard.stampsCount + input.delta),
    )

    await tx.insert(stampEvents).values({
      orgId: input.orgId,
      customerCardId: row.customerCard.id,
      actorUserId: input.actorUserId,
      source: 'manual',
      delta: next - row.customerCard.stampsCount,
      resultingCount: next,
      cycleIndex: row.customerCard.cycleIndex,
      note: input.reason,
      idempotencyKey: input.idempotencyKey,
      occurredAt: now,
    })

    await tx
      .update(customerCards)
      .set({ stampsCount: next, updatedAt: now })
      .where(eq(customerCards.id, row.customerCard.id))

    await enqueue(
      tx,
      OUTBOX_KINDS.walletUpdate,
      { customerCardId: row.customerCard.id, reason: 'adjust' },
      { orgId: input.orgId },
    )

    return {
      customerCardId: row.customerCard.id,
      stampsCount: next,
      stampsRequired: row.card.stampsRequired,
    }
  })
}

/** Latest activity for a customer card, used by the staff scanner's confirmation screen. */
export async function recentActivity(db: Database, orgId: string, customerCardId: string) {
  return db
    .select({
      id: stampEvents.id,
      delta: stampEvents.delta,
      source: stampEvents.source,
      occurredAt: stampEvents.occurredAt,
      resultingCount: stampEvents.resultingCount,
    })
    .from(stampEvents)
    .where(and(eq(stampEvents.orgId, orgId), eq(stampEvents.customerCardId, customerCardId)))
    .orderBy(desc(stampEvents.occurredAt))
    .limit(10)
}
