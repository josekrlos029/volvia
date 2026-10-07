import {
  type Database,
  analyticsDaily,
  and,
  customerAnswers,
  customerCards,
  customers,
  desc,
  eq,
  gte,
  organizations,
  rewardGrants,
  rewards,
  sql,
  stampCards,
  stampEvents,
} from '@volvia/db'
import type { JoinCardInput, StampResult, StampSource } from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { OUTBOX_KINDS, enqueue } from '../../lib/outbox'
import { addDays, orgDay, orgHour, startOfOrgDay } from '../../lib/time'
import { generateCode, randomToken } from '../../lib/tokens'
import { evaluateStamp, rewardsCrossed } from './rules'

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

/** Increments the daily rollup so the dashboard never scans the event ledger. */
async function bumpAnalytics(
  tx: Tx,
  input: {
    orgId: string
    cardId: string
    locationId: string | null
    day: string
    hour: number
    joins?: number
    stamps?: number
    rewardsUnlocked?: number
    rewardsRedeemed?: number
  },
): Promise<void> {
  const hourly = Array.from({ length: 24 }, (_, index) =>
    index === input.hour ? (input.stamps ?? 0) : 0,
  )

  await tx
    .insert(analyticsDaily)
    .values({
      orgId: input.orgId,
      cardId: input.cardId,
      locationId: input.locationId,
      day: input.day,
      joins: input.joins ?? 0,
      stamps: input.stamps ?? 0,
      rewardsUnlocked: input.rewardsUnlocked ?? 0,
      rewardsRedeemed: input.rewardsRedeemed ?? 0,
      hourly,
    })
    .onConflictDoUpdate({
      target: [
        analyticsDaily.orgId,
        analyticsDaily.cardId,
        analyticsDaily.locationId,
        analyticsDaily.day,
      ],
      set: {
        joins: sql`${analyticsDaily.joins} + ${input.joins ?? 0}`,
        stamps: sql`${analyticsDaily.stamps} + ${input.stamps ?? 0}`,
        rewardsUnlocked: sql`${analyticsDaily.rewardsUnlocked} + ${input.rewardsUnlocked ?? 0}`,
        rewardsRedeemed: sql`${analyticsDaily.rewardsRedeemed} + ${input.rewardsRedeemed ?? 0}`,
        // Add this scan into its hour bucket without rewriting the other 23.
        hourly: sql`(
          select jsonb_agg(coalesce(existing.value::int, 0) + coalesce(incoming.value::int, 0) order by existing.ordinality)
          from jsonb_array_elements(${analyticsDaily.hourly}) with ordinality as existing(value, ordinality)
          join jsonb_array_elements(${JSON.stringify(hourly)}::jsonb) with ordinality as incoming(value, ordinality)
            on existing.ordinality = incoming.ordinality
        )`,
        updatedAt: new Date(),
      },
    })
}

export async function findActiveCardByJoinSlug(db: Database, joinSlug: string) {
  const [row] = await db
    .select({
      card: stampCards,
      org: organizations,
    })
    .from(stampCards)
    .innerJoin(organizations, eq(organizations.id, stampCards.orgId))
    .where(eq(stampCards.joinSlug, joinSlug))
    .limit(1)

  if (!row) throw new AppError('CARD_NOT_FOUND', { message: 'card not found' })
  // Closing the business closes its cards with it, whatever their own status says.
  if (row.org.deletedAt || row.card.status !== 'active') {
    throw new AppError('CARD_NOT_ACTIVE', { message: 'this card is not accepting new members' })
  }
  return row
}

export interface JoinResult {
  token: string
  customerId: string
  isNew: boolean
}

/**
 * Enrols a customer. Joining twice with the same email is idempotent — a customer who
 * scans the QR again gets their existing card back, never a second one.
 */
export async function joinCard(
  db: Database,
  input: { joinSlug: string; data: JoinCardInput; ip: string },
): Promise<JoinResult> {
  const { card, org } = await findActiveCardByJoinSlug(db, input.joinSlug)
  const now = new Date()

  return db.transaction(async (tx) => {
    const email = input.data.email.toLowerCase()

    const [existingCustomer] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.orgId, org.id), sql`lower(${customers.email}) = ${email}`))
      .limit(1)

    let customerId: string
    let customerIsNew = false

    if (existingCustomer) {
      customerId = existingCustomer.id
      // Refresh the details they just gave us, but never clear an existing value.
      await tx
        .update(customers)
        .set({
          firstName: input.data.firstName || existingCustomer.firstName,
          birthdayMonth: input.data.birthday?.month ?? existingCustomer.birthdayMonth,
          birthdayDay: input.data.birthday?.day ?? existingCustomer.birthdayDay,
          marketingConsent: input.data.marketingConsent || existingCustomer.marketingConsent,
          consentAt: input.data.marketingConsent
            ? (existingCustomer.consentAt ?? now)
            : existingCustomer.consentAt,
          deletedAt: null,
          updatedAt: now,
        })
        .where(eq(customers.id, customerId))
    } else {
      const [created] = await tx
        .insert(customers)
        .values({
          orgId: org.id,
          firstName: input.data.firstName,
          email,
          birthdayMonth: input.data.birthday?.month ?? null,
          birthdayDay: input.data.birthday?.day ?? null,
          locale: input.data.locale ?? org.locale,
          marketingConsent: input.data.marketingConsent,
          consentAt: input.data.marketingConsent ? now : null,
        })
        .returning()
      customerId = created!.id
      customerIsNew = true
    }

    const [existingCard] = await tx
      .select()
      .from(customerCards)
      .where(and(eq(customerCards.cardId, card.id), eq(customerCards.customerId, customerId)))
      .limit(1)

    if (existingCard) {
      return { token: existingCard.token, customerId, isNew: false }
    }

    const token = randomToken()
    // A head start the business configured: the card is never handed over empty.
    const headStart = Math.max(0, Math.min(card.initialStamps, card.stampsRequired - 1))

    const [createdCard] = await tx
      .insert(customerCards)
      .values({
        orgId: org.id,
        cardId: card.id,
        customerId,
        token,
        stampsCount: headStart,
        lifetimeStamps: headStart,
        expiresAt: card.inactivityExpiryDays ? addDays(now, card.inactivityExpiryDays) : null,
      })
      .returning({ id: customerCards.id })

    if (headStart > 0) {
      // Recorded like any other stamp, so the history explains where they came from.
      await tx.insert(stampEvents).values({
        orgId: org.id,
        customerCardId: createdCard!.id,
        source: 'manual',
        delta: headStart,
        resultingCount: headStart,
        cycleIndex: 0,
        note: 'head start',
        idempotencyKey: `head-start:${createdCard!.id}`,
        occurredAt: now,
      })
      await tx
        .update(customers)
        .set({
          totalStamps: sql`${customers.totalStamps} + ${headStart}`,
          updatedAt: now,
        })
        .where(eq(customers.id, customerId))
    }

    // Answers to the card's signup questions, if any were asked.
    const answerEntries = Object.entries(input.data.answers ?? {})
    if (answerEntries.length > 0) {
      await tx
        .insert(customerAnswers)
        .values(
          answerEntries.map(([questionId, value]) => ({
            orgId: org.id,
            customerId,
            questionId,
            value,
          })),
        )
        .onConflictDoNothing()
    }

    if (customerIsNew) {
      // Drives the premium trial gate; kept denormalised to avoid a COUNT per request.
      await tx
        .update(organizations)
        .set({ customerCount: sql`${organizations.customerCount} + 1`, updatedAt: now })
        .where(eq(organizations.id, org.id))
    }

    await bumpAnalytics(tx, {
      orgId: org.id,
      cardId: card.id,
      locationId: null,
      day: orgDay(now, org.timezone),
      hour: orgHour(now, org.timezone),
      joins: 1,
    })

    await enqueue(
      tx,
      OUTBOX_KINDS.emailSend,
      { type: 'customer_welcome', customerCardToken: token, cardId: card.id },
      { orgId: org.id },
    )

    return { token, customerId, isNew: true }
  })
}

export interface StampCommand {
  /** The organisation doing the stamping. Cards outside it must not be reachable. */
  orgId: string
  cardToken: string
  count: number
  locationId?: string | null
  actorUserId?: string | null
  source: StampSource
  idempotencyKey: string
  occurredAt?: Date
  purchaseAmount?: number
  note?: string
}

/**
 * Adds stamps to a customer's card.
 *
 * The whole operation is one transaction with the customer's card row locked, so two
 * staff scanning the same customer at the same moment cannot both cross the reward line.
 */
export async function applyStamp(db: Database, command: StampCommand): Promise<StampResult> {
  const now = command.occurredAt ?? new Date()

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        customerCard: customerCards,
        card: stampCards,
        org: organizations,
        customer: customers,
      })
      .from(customerCards)
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
      .innerJoin(customers, eq(customers.id, customerCards.customerId))
      .where(
        and(eq(customerCards.token, command.cardToken), eq(customerCards.orgId, command.orgId)),
      )
      .for('update', { of: customerCards })
      .limit(1)

    // Deliberately the same error as a missing card: a business must not be able to
    // probe whether a token belongs to a competitor.
    if (!row) throw new AppError('CUSTOMER_CARD_NOT_FOUND', { message: 'card not found' })
    if (row.customerCard.status !== 'active') {
      throw new AppError('CUSTOMER_CARD_BLOCKED', { message: 'this card is not active' })
    }
    if (row.card.status !== 'active') {
      throw new AppError('CARD_NOT_ACTIVE', { message: 'this loyalty card is not active' })
    }

    const dayStart = startOfOrgDay(now, row.org.timezone)
    const [todayRow] = await tx
      .select({ total: sql<number>`coalesce(sum(${stampEvents.delta}), 0)::int` })
      .from(stampEvents)
      .where(
        and(
          eq(stampEvents.customerCardId, row.customerCard.id),
          gte(stampEvents.occurredAt, dayStart),
        ),
      )

    const decision = evaluateStamp({
      now,
      rules: row.card.rules,
      source: command.source,
      lastStampAt: row.customerCard.lastStampAt,
      stampsToday: todayRow?.total ?? 0,
      requestedCount: command.count,
      purchaseAmount: command.purchaseAmount,
    })

    if (!decision.allowed) {
      switch (decision.reason) {
        case 'cooldown':
          throw new AppError('STAMP_COOLDOWN_ACTIVE', {
            message: 'this customer was stamped very recently',
            logContext: { retryAfterSeconds: decision.retryAfterSeconds },
          })
        case 'daily_cap':
          throw new AppError('STAMP_DAILY_CAP_REACHED', {
            message: 'daily stamp limit reached for this customer',
          })
        default:
          throw new AppError('VALIDATION_FAILED', {
            message:
              decision.reason === 'missing_amount'
                ? 'purchase amount required'
                : 'purchase below the minimum',
          })
      }
    }

    const cardRewards = await tx
      .select()
      .from(rewards)
      .where(eq(rewards.cardId, row.card.id))
      .orderBy(rewards.atStamp)

    const crossing = rewardsCrossed({
      from: row.customerCard.stampsCount,
      granted: decision.granted,
      stampsRequired: row.card.stampsRequired,
      rewardPositions: cardRewards.map((reward) => reward.atStamp),
    })

    const nextCycle = row.customerCard.cycleIndex + crossing.cyclesCompleted

    await tx.insert(stampEvents).values({
      orgId: row.org.id,
      customerCardId: row.customerCard.id,
      locationId: command.locationId ?? null,
      actorUserId: command.actorUserId ?? null,
      source: command.source,
      delta: decision.granted,
      resultingCount: crossing.finalCount,
      cycleIndex: nextCycle,
      purchaseAmount: command.purchaseAmount ?? null,
      note: command.note ?? null,
      idempotencyKey: command.idempotencyKey,
      occurredAt: now,
    })

    // Rewards that are not repeating are only granted on the customer's first cycle.
    const unlockedGrants = crossing.unlocked
      .map((position) => cardRewards.find((reward) => reward.atStamp === position))
      .filter((reward): reward is (typeof cardRewards)[number] => Boolean(reward))
      .filter((reward) => reward.isRepeating || row.customerCard.cycleIndex === 0)

    const grants =
      unlockedGrants.length > 0
        ? await tx
            .insert(rewardGrants)
            .values(
              unlockedGrants.map((reward) => ({
                orgId: row.org.id,
                customerCardId: row.customerCard.id,
                rewardId: reward.id,
                title: reward.title,
                description: reward.description,
                code: generateCode(),
                cycleIndex: row.customerCard.cycleIndex,
                expiresAt: reward.expiresInDays ? addDays(now, reward.expiresInDays) : null,
              })),
            )
            .returning()
        : []

    await tx
      .update(customerCards)
      .set({
        stampsCount: crossing.finalCount,
        cycleIndex: nextCycle,
        lifetimeStamps: sql`${customerCards.lifetimeStamps} + ${decision.granted}`,
        lastStampAt: now,
        expiresAt: row.card.inactivityExpiryDays
          ? addDays(now, row.card.inactivityExpiryDays)
          : null,
        updatedAt: now,
      })
      .where(eq(customerCards.id, row.customerCard.id))

    await tx
      .update(customers)
      .set({
        totalStamps: sql`${customers.totalStamps} + ${decision.granted}`,
        totalRewards: sql`${customers.totalRewards} + ${grants.length}`,
        lastStampAt: now,
        updatedAt: now,
      })
      .where(eq(customers.id, row.customer.id))

    await bumpAnalytics(tx, {
      orgId: row.org.id,
      cardId: row.card.id,
      locationId: command.locationId ?? null,
      day: orgDay(now, row.org.timezone),
      hour: orgHour(now, row.org.timezone),
      stamps: decision.granted,
      rewardsUnlocked: grants.length,
    })

    // The wallet pass must reflect the new count; the outbox guarantees it is sent
    // exactly when this transaction commits, and never if it rolls back.
    await enqueue(
      tx,
      OUTBOX_KINDS.walletUpdate,
      { customerCardId: row.customerCard.id, reason: 'stamp' },
      { orgId: row.org.id },
    )

    if (grants.length > 0) {
      await enqueue(
        tx,
        OUTBOX_KINDS.emailSend,
        { type: 'reward_ready', customerCardToken: row.customerCard.token, grantId: grants[0]!.id },
        { orgId: row.org.id },
      )
    }

    const pending = await tx
      .select({ id: rewardGrants.id, title: rewardGrants.title, code: rewardGrants.code })
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.customerCardId, row.customerCard.id),
          eq(rewardGrants.status, 'pending'),
        ),
      )
      .orderBy(desc(rewardGrants.grantedAt))

    return {
      customerCardId: row.customerCard.id,
      stampsAdded: decision.granted,
      stampsCount: crossing.finalCount,
      stampsRequired: row.card.stampsRequired,
      cycleIndex: nextCycle,
      unlockedRewards: grants.map((grant) => ({
        grantId: grant.id,
        title: grant.title,
        description: grant.description,
        code: grant.code,
        expiresAt: grant.expiresAt,
      })),
      pendingRewards: pending
        .filter((grant) => !grants.some((created) => created.id === grant.id))
        .map((grant) => ({ grantId: grant.id, title: grant.title, code: grant.code })),
      customer: {
        id: row.customer.id,
        firstName: row.customer.firstName,
        isNew: row.customerCard.lifetimeStamps === 0,
      },
      replayed: false,
    }
  })
}
