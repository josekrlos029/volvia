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
  inArray,
  lt,
  organizations,
  rewardGrants,
  rewards,
  sql,
  stampCards,
  stampEvents,
} from '@volvia/db'
import { cardDesignSchema } from '@volvia/shared'
import { STAMP_VOID_WINDOW_MINUTES } from '@volvia/shared'
import type {
  CardLookup,
  JoinCardInput,
  MyActivityItem,
  StampResult,
  StampResultDesign,
  StampSource,
} from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { OUTBOX_KINDS, enqueue } from '../../lib/outbox'
import { addDays, orgDay, orgHour, startOfOrgDay } from '../../lib/time'
import { generateCode, randomToken } from '../../lib/tokens'
import {
  bumpCampaignStats,
  endOffersForCard,
  loadLiveOffer,
  multiplierFor,
} from '../engagement/offers'
import { evaluateStamp, evaluateVoid, rewardsCrossed } from './rules'

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
  return enrolOnCard(db, { card, org, data: input.data })
}

/** The staff app's sign-up at the counter: the card is picked by id, inside the org. */
export async function findActiveCardForOrg(db: Database, orgId: string, cardId: string) {
  const [row] = await db
    .select({ card: stampCards, org: organizations })
    .from(stampCards)
    .innerJoin(organizations, eq(organizations.id, stampCards.orgId))
    .where(and(eq(stampCards.id, cardId), eq(stampCards.orgId, orgId)))
    .limit(1)

  if (!row) throw new AppError('CARD_NOT_FOUND', { message: 'card not found' })
  if (row.org.deletedAt || row.card.status !== 'active') {
    throw new AppError('CARD_NOT_ACTIVE', { message: 'this card is not accepting new members' })
  }
  return row
}

/** Shared by the public form and the counter: one customer, one card, never twice. */
export async function enrolOnCard(
  db: Database,
  input: {
    card: typeof stampCards.$inferSelect
    org: typeof organizations.$inferSelect
    data: JoinCardInput
  },
): Promise<JoinResult> {
  const { card, org } = input
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
          phone: input.data.phone ?? existingCustomer.phone,
          documentNumber: input.data.documentNumber ?? existingCustomer.documentNumber,
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
          phone: input.data.phone,
          documentNumber: input.data.documentNumber,
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
  /** One of the two: the scanned token, or the card picked from the customer list. */
  cardToken?: string
  customerCardId?: string
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
        and(
          command.customerCardId
            ? eq(customerCards.id, command.customerCardId)
            : eq(customerCards.token, command.cardToken ?? ''),
          eq(customerCards.orgId, command.orgId),
        ),
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
            // The staff app tells the cashier how long to wait.
            details: [
              { path: 'retryAfterSeconds', message: String(decision.retryAfterSeconds ?? 0) },
            ],
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

    // A live campaign can multiply what the counter hands out. Bonus stamps the
    // campaign itself awards (`source: 'campaign'`) are never multiplied again.
    const liveOffer =
      command.source === 'campaign'
        ? null
        : await loadLiveOffer(tx, {
            customerCardId: row.customerCard.id,
            timezone: row.org.timezone,
            now,
          })
    const factor =
      command.source === 'staff_scan' || command.source === 'kiosk' || command.source === 'remote'
        ? multiplierFor(liveOffer)
        : 1
    const granted = decision.granted * factor
    const note =
      command.note ?? (factor > 1 && liveOffer ? `x${factor} · ${liveOffer.headline}` : null)

    const cardRewards = await tx
      .select()
      .from(rewards)
      .where(eq(rewards.cardId, row.card.id))
      .orderBy(rewards.atStamp)

    const crossing = rewardsCrossed({
      from: row.customerCard.stampsCount,
      granted,
      stampsRequired: row.card.stampsRequired,
      rewardPositions: cardRewards.map((reward) => reward.atStamp),
    })

    const nextCycle = row.customerCard.cycleIndex + crossing.cyclesCompleted

    const [event] = await tx
      .insert(stampEvents)
      .values({
        orgId: row.org.id,
        customerCardId: row.customerCard.id,
        locationId: command.locationId ?? null,
        actorUserId: command.actorUserId ?? null,
        source: command.source,
        delta: granted,
        resultingCount: crossing.finalCount,
        cycleIndex: nextCycle,
        purchaseAmount: command.purchaseAmount ?? null,
        note,
        idempotencyKey: command.idempotencyKey,
        occurredAt: now,
      })
      .returning({ id: stampEvents.id })

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
        lifetimeStamps: sql`${customerCards.lifetimeStamps} + ${granted}`,
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
        totalStamps: sql`${customers.totalStamps} + ${granted}`,
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
      stamps: granted,
      rewardsUnlocked: grants.length,
    })

    // A visit is what some offers wait for: the first stamp ends them, and the pass
    // update queued below is what returns the card to normal.
    if (command.source !== 'campaign') {
      await endOffersForCard(tx, row.customerCard.id, 'stamp')
      if (liveOffer?.campaignId) {
        await bumpCampaignStats(tx, liveOffer.campaignId, { stamps: granted })
      }
    }

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
      eventId: event!.id,
      stampsAdded: granted,
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
      design: stampResultDesign({
        org: row.org,
        card: row.card,
        rewards: cardRewards,
        stampsCount: crossing.finalCount,
      }),
    }
  })
}

/**
 * How a card looks to the staff member who just stamped it, or is about to: the
 * business's colours, the reward slots and what the customer is working towards.
 */
export function stampResultDesign(input: {
  org: { name: string; logoUrl: string | null }
  card: { name: string; design: unknown }
  rewards: Array<{ atStamp: number; title: string }>
  stampsCount: number
}): StampResultDesign {
  const design = cardDesignSchema.parse(input.card.design ?? {})
  const nextReward = input.rewards.find((reward) => reward.atStamp > input.stampsCount) ?? null
  return {
    businessName: input.org.name,
    cardName: input.card.name,
    logoUrl: design.logoUrl ?? input.org.logoUrl ?? null,
    backgroundColor: design.backgroundColor,
    foregroundColor: design.foregroundColor,
    accentColor: design.accentColor,
    emptyStampColor: design.emptyStampColor,
    stampStyle: design.stampStyle,
    stampIcon: design.stampIcon,
    rewardPositions: input.rewards.map((reward) => reward.atStamp),
    nextReward: nextReward ? { atStamp: nextReward.atStamp, title: nextReward.title } : null,
  }
}

/**
 * The card as the staff app sees it right after a scan, before anything is written:
 * who it is, where they are on the card, and whether the rules will let a stamp in.
 */
export async function lookupCard(
  db: Database,
  input: { orgId: string; cardToken?: string; customerCardId?: string; now?: Date },
): Promise<CardLookup> {
  const now = input.now ?? new Date()
  const [row] = await db
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
      and(
        input.customerCardId
          ? eq(customerCards.id, input.customerCardId)
          : eq(customerCards.token, input.cardToken ?? ''),
        eq(customerCards.orgId, input.orgId),
      ),
    )
    .limit(1)

  // Same answer as a card of another business: tokens must not be probeable.
  if (!row || row.customerCard.status === 'deleted') {
    throw new AppError('CUSTOMER_CARD_NOT_FOUND', { message: 'card not found' })
  }
  if (row.customerCard.status !== 'active') {
    throw new AppError('CUSTOMER_CARD_BLOCKED', { message: 'this card is not active' })
  }

  const [cardRewards, pending] = await Promise.all([
    db.select().from(rewards).where(eq(rewards.cardId, row.card.id)).orderBy(rewards.atStamp),
    db
      .select({
        grantId: rewardGrants.id,
        title: rewardGrants.title,
        code: rewardGrants.code,
        expiresAt: rewardGrants.expiresAt,
      })
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.customerCardId, row.customerCard.id),
          eq(rewardGrants.status, 'pending'),
        ),
      )
      .orderBy(rewardGrants.grantedAt),
  ])

  const rules = row.card.rules
  const lastStampAt = row.customerCard.lastStampAt
  const cooldownSecondsLeft =
    rules.cooldownMinutes > 0 && lastStampAt
      ? Math.max(
          0,
          Math.ceil(
            (rules.cooldownMinutes * 60_000 - (now.getTime() - lastStampAt.getTime())) / 1000,
          ),
        )
      : 0

  return {
    customerCardId: row.customerCard.id,
    cardToken: row.customerCard.token,
    customer: {
      id: row.customer.id,
      firstName: row.customer.firstName,
      phone: row.customer.phone,
      notes: row.customer.notes,
      totalStamps: row.customer.totalStamps,
      joinedAt: row.customer.joinedAt,
    },
    card: {
      id: row.card.id,
      name: row.card.name,
      stampsRequired: row.card.stampsRequired,
      ruleMode: rules.mode,
      minSpendAmount: rules.minSpendAmount ?? null,
      maxStampsPerScan: rules.maxStampsPerScan,
    },
    stampsCount: row.customerCard.stampsCount,
    lastStampAt,
    cooldownSecondsLeft,
    pendingRewards: pending.filter(
      (grant) => !grant.expiresAt || grant.expiresAt.getTime() > now.getTime(),
    ),
    design: stampResultDesign({
      org: row.org,
      card: row.card,
      rewards: cardRewards,
      stampsCount: row.customerCard.stampsCount,
    }),
  }
}

const VOID_KEY_PREFIX = 'void:'

const VOID_MESSAGES = {
  not_a_scan: 'only a stamp from a scan can be undone',
  not_yours: 'only the person who made this scan can undo it',
  too_late: 'this scan is too old to undo',
  card_moved_on: 'the card changed after this scan',
} as const

/**
 * Takes a scan back: the card returns to where it was, rewards it unlocked are
 * revoked, and the ledger keeps both rows so the history still explains itself.
 */
export async function voidStamp(
  db: Database,
  input: {
    orgId: string
    eventId: string
    actorUserId: string
    isAdmin: boolean
    reason?: string
    now?: Date
  },
) {
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ event: stampEvents })
      .from(stampEvents)
      .where(and(eq(stampEvents.id, input.eventId), eq(stampEvents.orgId, input.orgId)))
      .limit(1)
    if (!target) throw new AppError('NOT_FOUND', { message: 'scan not found' })
    const event = target.event

    const [row] = await tx
      .select({ customerCard: customerCards, card: stampCards, org: organizations })
      .from(customerCards)
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .innerJoin(organizations, eq(organizations.id, customerCards.orgId))
      .where(eq(customerCards.id, event.customerCardId))
      .for('update', { of: customerCards })
      .limit(1)
    if (!row) throw new AppError('CUSTOMER_CARD_NOT_FOUND', { message: 'card not found' })

    const [latest] = await tx
      .select({ id: stampEvents.id })
      .from(stampEvents)
      .where(eq(stampEvents.customerCardId, event.customerCardId))
      .orderBy(desc(stampEvents.createdAt))
      .limit(1)

    // Grants are written in the same transaction as their scan, so they share its clock.
    const unlocked = await tx
      .select({ id: rewardGrants.id, status: rewardGrants.status })
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.customerCardId, event.customerCardId),
          gte(rewardGrants.grantedAt, event.createdAt),
        ),
      )

    const decision = evaluateVoid({
      now,
      windowMinutes: STAMP_VOID_WINDOW_MINUTES,
      isAdmin: input.isAdmin,
      actorUserId: input.actorUserId,
      event,
      isLatestEvent: latest?.id === event.id,
      unlockedRewardRedeemed: unlocked.some((grant) => grant.status === 'redeemed'),
    })
    if (!decision.allowed) {
      throw new AppError('STAMP_VOID_NOT_ALLOWED', {
        message: VOID_MESSAGES[decision.reason],
        logContext: { reason: decision.reason },
      })
    }

    const [previous] = await tx
      .select({
        resultingCount: stampEvents.resultingCount,
        cycleIndex: stampEvents.cycleIndex,
      })
      .from(stampEvents)
      .where(
        and(
          eq(stampEvents.customerCardId, event.customerCardId),
          lt(stampEvents.createdAt, event.createdAt),
        ),
      )
      .orderBy(desc(stampEvents.createdAt))
      .limit(1)

    // Within one cycle the arithmetic is exact; a scan that completed the card is
    // rewound to the row before it.
    const previousCycle = previous?.cycleIndex ?? 0
    const wrapped = event.cycleIndex !== previousCycle
    const restoredCount = wrapped
      ? (previous?.resultingCount ?? 0)
      : Math.max(0, event.resultingCount - event.delta)

    // The cooldown must not punish the corrected scan that usually follows an undo.
    const [lastCounted] = await tx
      .select({ occurredAt: stampEvents.occurredAt })
      .from(stampEvents)
      .where(
        and(
          eq(stampEvents.customerCardId, event.customerCardId),
          lt(stampEvents.createdAt, event.createdAt),
          gte(stampEvents.delta, 1),
        ),
      )
      .orderBy(desc(stampEvents.createdAt))
      .limit(1)

    await tx.insert(stampEvents).values({
      orgId: input.orgId,
      customerCardId: event.customerCardId,
      locationId: event.locationId,
      actorUserId: input.actorUserId,
      source: 'manual',
      delta: -event.delta,
      resultingCount: restoredCount,
      cycleIndex: previousCycle,
      note: input.reason ? `Sello anulado: ${input.reason}` : 'Sello anulado',
      idempotencyKey: `${VOID_KEY_PREFIX}${event.id}`,
      occurredAt: now,
    })

    const revocable = unlocked
      .filter((grant) => grant.status === 'pending')
      .map((grant) => grant.id)
    if (revocable.length > 0) {
      await tx
        .update(rewardGrants)
        .set({ status: 'revoked' })
        .where(inArray(rewardGrants.id, revocable))
    }

    await tx
      .update(customerCards)
      .set({
        stampsCount: restoredCount,
        cycleIndex: previousCycle,
        lifetimeStamps: sql`greatest(0, ${customerCards.lifetimeStamps} - ${event.delta})`,
        lastStampAt: lastCounted?.occurredAt ?? null,
        updatedAt: now,
      })
      .where(eq(customerCards.id, event.customerCardId))

    await tx
      .update(customers)
      .set({
        totalStamps: sql`greatest(0, ${customers.totalStamps} - ${event.delta})`,
        totalRewards: sql`greatest(0, ${customers.totalRewards} - ${revocable.length})`,
        updatedAt: now,
      })
      .where(eq(customers.id, row.customerCard.customerId))

    // Counted where the scan was counted, so today's numbers come back down.
    await bumpAnalytics(tx, {
      orgId: input.orgId,
      cardId: row.card.id,
      locationId: event.locationId,
      day: orgDay(event.occurredAt, row.org.timezone),
      hour: orgHour(event.occurredAt, row.org.timezone),
      stamps: -event.delta,
      rewardsUnlocked: -revocable.length,
    })

    await enqueue(
      tx,
      OUTBOX_KINDS.walletUpdate,
      { customerCardId: event.customerCardId, reason: 'adjust' },
      { orgId: input.orgId },
    )

    return {
      customerCardId: event.customerCardId,
      cardToken: row.customerCard.token,
      stampsCount: restoredCount,
      stampsRequired: row.card.stampsRequired,
      stampsRemoved: event.delta,
      rewardsRevoked: revocable.length,
    }
  })
}

/** What this staff member did since `since`: their scans, undos and handed-over rewards. */
export async function myActivity(
  db: Database,
  input: { orgId: string; userId: string; since: Date; now?: Date },
): Promise<MyActivityItem[]> {
  const now = input.now ?? new Date()

  const [events, redemptions] = await Promise.all([
    db
      .select({
        id: stampEvents.id,
        at: stampEvents.createdAt,
        source: stampEvents.source,
        delta: stampEvents.delta,
        idempotencyKey: stampEvents.idempotencyKey,
        customerCardId: stampEvents.customerCardId,
        customerId: customers.id,
        firstName: customers.firstName,
        cardName: stampCards.name,
      })
      .from(stampEvents)
      .innerJoin(customerCards, eq(customerCards.id, stampEvents.customerCardId))
      .innerJoin(customers, eq(customers.id, customerCards.customerId))
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .where(
        and(
          eq(stampEvents.orgId, input.orgId),
          eq(stampEvents.actorUserId, input.userId),
          gte(stampEvents.createdAt, input.since),
        ),
      )
      .orderBy(desc(stampEvents.createdAt))
      .limit(100),
    db
      .select({
        id: rewardGrants.id,
        at: rewardGrants.redeemedAt,
        title: rewardGrants.title,
        customerCardId: rewardGrants.customerCardId,
        customerId: customers.id,
        firstName: customers.firstName,
        cardName: stampCards.name,
      })
      .from(rewardGrants)
      .innerJoin(customerCards, eq(customerCards.id, rewardGrants.customerCardId))
      .innerJoin(customers, eq(customers.id, customerCards.customerId))
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .where(
        and(
          eq(rewardGrants.orgId, input.orgId),
          eq(rewardGrants.redeemedBy, input.userId),
          gte(rewardGrants.redeemedAt, input.since),
        ),
      )
      .orderBy(desc(rewardGrants.redeemedAt))
      .limit(100),
  ])

  const cardIds = [...new Set(events.map((event) => event.customerCardId))]
  const latestByCard = new Map<string, string>()
  if (cardIds.length > 0) {
    const latest = await db
      .selectDistinctOn([stampEvents.customerCardId], {
        customerCardId: stampEvents.customerCardId,
        id: stampEvents.id,
      })
      .from(stampEvents)
      .where(inArray(stampEvents.customerCardId, cardIds))
      .orderBy(stampEvents.customerCardId, desc(stampEvents.createdAt))
    for (const row of latest) latestByCard.set(row.customerCardId, row.id)
  }

  const windowMs = STAMP_VOID_WINDOW_MINUTES * 60_000
  const items: MyActivityItem[] = []
  for (const event of events) {
    const isVoid = event.idempotencyKey.startsWith(VOID_KEY_PREFIX)
    const isScan = event.source === 'staff_scan' || event.source === 'remote'
    if (!isVoid && !isScan) continue
    items.push({
      kind: isVoid ? 'void' : 'stamp',
      id: event.id,
      at: event.at,
      customerCardId: event.customerCardId,
      customerId: event.customerId,
      firstName: event.firstName,
      cardName: event.cardName,
      delta: event.delta,
      rewardTitle: null,
      canVoid:
        isScan &&
        event.delta > 0 &&
        latestByCard.get(event.customerCardId) === event.id &&
        now.getTime() - event.at.getTime() <= windowMs,
    })
  }
  for (const grant of redemptions) {
    items.push({
      kind: 'redeem',
      id: grant.id,
      at: grant.at ?? now,
      customerCardId: grant.customerCardId,
      customerId: grant.customerId,
      firstName: grant.firstName,
      cardName: grant.cardName,
      delta: 0,
      rewardTitle: grant.title,
      canVoid: false,
    })
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime())
}
