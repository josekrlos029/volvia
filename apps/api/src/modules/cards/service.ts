import { type Database, and, count, customerCards, desc, eq, rewards, stampCards } from '@volvia/db'
import {
  type CardDesign,
  type CreateCardInput,
  type Entitlements,
  type StampRules,
  type UpdateCardInput,
  cardDesignSchema,
  stampRulesBaseSchema,
} from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { generateJoinSlug } from '../../lib/tokens'
import { assertWithinLimit } from '../../plugins/auth'

/** Applies schema defaults so a partially-specified design still lands complete. */
export function normaliseDesign(input: Partial<CardDesign> | undefined): CardDesign {
  return cardDesignSchema.parse(input ?? {})
}

export function normaliseRules(input: Partial<StampRules> | undefined): StampRules {
  return stampRulesBaseSchema.parse(input ?? {}) as StampRules
}

/**
 * Features the design may use are plan-gated. Rather than rejecting the save — which
 * would lose the business's work — unavailable options fall back to the defaults.
 */
export function applyDesignEntitlements(
  design: CardDesign,
  entitlements: Entitlements,
): CardDesign {
  const next = { ...design }
  if (!entitlements.has('custom_branding')) {
    next.backgroundColor = cardDesignSchema.shape.backgroundColor._def.defaultValue()
    next.foregroundColor = cardDesignSchema.shape.foregroundColor._def.defaultValue()
    next.accentColor = cardDesignSchema.shape.accentColor._def.defaultValue()
    next.bannerUrl = null
  }
  if (!entitlements.has('custom_stamp_icons') && next.stampIcon.kind === 'image') {
    next.stampIcon = { kind: 'preset', value: 'star' }
  }
  return next
}

async function uniqueJoinSlug(db: Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateJoinSlug()
    const [existing] = await db
      .select({ id: stampCards.id })
      .from(stampCards)
      .where(eq(stampCards.joinSlug, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  throw new AppError('INTERNAL', { message: 'could not allocate a join slug' })
}

export async function countActiveCards(db: Database, orgId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(stampCards)
    .where(and(eq(stampCards.orgId, orgId), eq(stampCards.status, 'active')))
  return row?.value ?? 0
}

export async function listCards(db: Database, orgId: string) {
  const cards = await db
    .select()
    .from(stampCards)
    .where(eq(stampCards.orgId, orgId))
    .orderBy(desc(stampCards.createdAt))

  if (cards.length === 0) return []

  // One extra query rather than N: rewards and holder counts for every card at once.
  const rewardRows = await db.select().from(rewards).where(eq(rewards.orgId, orgId))
  const holderRows = await db
    .select({ cardId: customerCards.cardId, holders: count() })
    .from(customerCards)
    .where(eq(customerCards.orgId, orgId))
    .groupBy(customerCards.cardId)

  const holdersByCard = new Map(holderRows.map((row) => [row.cardId, row.holders]))

  return cards.map((card) => ({
    ...card,
    rewards: rewardRows
      .filter((reward) => reward.cardId === card.id)
      .sort((a, b) => a.atStamp - b.atStamp),
    holders: holdersByCard.get(card.id) ?? 0,
  }))
}

export async function getCard(db: Database, orgId: string, cardId: string) {
  const [card] = await db
    .select()
    .from(stampCards)
    .where(and(eq(stampCards.id, cardId), eq(stampCards.orgId, orgId)))
    .limit(1)
  if (!card) throw new AppError('CARD_NOT_FOUND', { message: 'card not found' })

  const cardRewards = await db
    .select()
    .from(rewards)
    .where(eq(rewards.cardId, cardId))
    .orderBy(rewards.atStamp)

  return { ...card, rewards: cardRewards }
}

export async function createCard(
  db: Database,
  input: { orgId: string; entitlements: Entitlements; data: CreateCardInput },
) {
  const activeCards = await countActiveCards(db, input.orgId)
  assertWithinLimit(input.entitlements, 'activeCards', activeCards)

  const joinSlug = await uniqueJoinSlug(db)
  const design = applyDesignEntitlements(normaliseDesign(input.data.design), input.entitlements)
  const rules = normaliseRules(input.data.rules)

  return db.transaction(async (tx) => {
    const [card] = await tx
      .insert(stampCards)
      .values({
        orgId: input.orgId,
        name: input.data.name,
        stampsRequired: input.data.stampsRequired,
        design,
        rules,
        terms: input.data.terms,
        inactivityExpiryDays: input.data.inactivityExpiryDays,
        collectBirthday: input.data.collectBirthday,
        signupQuestionIds: input.data.signupQuestionIds,
        joinSlug,
        status: 'draft',
      })
      .returning()

    await tx.insert(rewards).values(
      input.data.rewards.map((reward) => ({
        cardId: card!.id,
        orgId: input.orgId,
        atStamp: reward.atStamp,
        title: reward.title,
        description: reward.description,
        kind: reward.kind,
        isRepeating: reward.isRepeating,
        expiresInDays: reward.expiresInDays,
      })),
    )

    return card!
  })
}

export async function updateCard(
  db: Database,
  input: { orgId: string; cardId: string; entitlements: Entitlements; data: UpdateCardInput },
) {
  const current = await getCard(db, input.orgId, input.cardId)

  // Changing the length of a live card would silently move everyone's finish line.
  if (
    input.data.stampsRequired !== undefined &&
    input.data.stampsRequired !== current.stampsRequired &&
    current.status === 'active'
  ) {
    const [holders] = await db
      .select({ value: count() })
      .from(customerCards)
      .where(eq(customerCards.cardId, input.cardId))
    if ((holders?.value ?? 0) > 0) {
      throw new AppError('CONFLICT', {
        message: 'cannot change the stamp count of a card that already has customers',
      })
    }
  }

  const design = input.data.design
    ? applyDesignEntitlements(
        cardDesignSchema.parse({ ...current.design, ...input.data.design }),
        input.entitlements,
      )
    : (current.design as CardDesign)

  const rules = input.data.rules
    ? (stampRulesBaseSchema.parse({ ...current.rules, ...input.data.rules }) as StampRules)
    : (current.rules as StampRules)

  if (rules.kioskEnabled && !input.entitlements.has('kiosk_mode')) {
    throw new AppError('FEATURE_NOT_IN_PLAN', {
      message: 'kiosk mode is not included in your plan',
      upgradeTo: input.entitlements.upgradeForFeature('kiosk_mode') ?? undefined,
    })
  }

  return db.transaction(async (tx) => {
    const [card] = await tx
      .update(stampCards)
      .set({
        name: input.data.name ?? current.name,
        stampsRequired: input.data.stampsRequired ?? current.stampsRequired,
        design,
        rules,
        terms: input.data.terms ?? current.terms,
        inactivityExpiryDays:
          input.data.inactivityExpiryDays === undefined
            ? current.inactivityExpiryDays
            : input.data.inactivityExpiryDays,
        collectBirthday: input.data.collectBirthday ?? current.collectBirthday,
        signupQuestionIds: input.data.signupQuestionIds ?? current.signupQuestionIds,
        status: input.data.status ?? current.status,
        updatedAt: new Date(),
      })
      .where(and(eq(stampCards.id, input.cardId), eq(stampCards.orgId, input.orgId)))
      .returning()

    if (input.data.rewards) {
      await tx.delete(rewards).where(eq(rewards.cardId, input.cardId))
      await tx.insert(rewards).values(
        input.data.rewards.map((reward) => ({
          cardId: input.cardId,
          orgId: input.orgId,
          atStamp: reward.atStamp,
          title: reward.title,
          description: reward.description,
          kind: reward.kind,
          isRepeating: reward.isRepeating,
          expiresInDays: reward.expiresInDays,
        })),
      )
    }

    return card!
  })
}

export async function publishCard(
  db: Database,
  input: { orgId: string; cardId: string; entitlements: Entitlements },
) {
  const card = await getCard(db, input.orgId, input.cardId)
  if (card.status === 'active') return card
  if (card.rewards.length === 0) {
    throw new AppError('VALIDATION_FAILED', {
      message: 'add at least one reward before publishing',
    })
  }

  const activeCards = await countActiveCards(db, input.orgId)
  assertWithinLimit(input.entitlements, 'activeCards', activeCards)

  const [updated] = await db
    .update(stampCards)
    .set({ status: 'active', publishedAt: card.publishedAt ?? new Date(), updatedAt: new Date() })
    .where(and(eq(stampCards.id, input.cardId), eq(stampCards.orgId, input.orgId)))
    .returning()

  return { ...updated!, rewards: card.rewards }
}

export async function archiveCard(db: Database, orgId: string, cardId: string) {
  const [card] = await db
    .update(stampCards)
    .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(stampCards.id, cardId), eq(stampCards.orgId, orgId)))
    .returning()
  if (!card) throw new AppError('CARD_NOT_FOUND', { message: 'card not found' })
  return card
}
