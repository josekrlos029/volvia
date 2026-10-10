import {
  type Database,
  and,
  count,
  customerAnswers,
  customerCards,
  customers,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  organizations,
  profileQuestions,
  rewardGrants,
  sql,
  stampCards,
  stampEvents,
} from '@volvia/db'
import {
  COMMUNITY_SEGMENTS,
  type CustomerListQuery,
  type SegmentDefinition,
  type VisitFrequency,
} from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { filterConditions, segmentCondition, segmentDefinitionConditions } from '../../lib/segments'

function sortColumn(sortBy: CustomerListQuery['sortBy']) {
  switch (sortBy) {
    case 'joinedAt':
      return customers.joinedAt
    case 'stamps':
      return customers.totalStamps
    case 'rewards':
      return customers.totalRewards
    default:
      return customers.lastStampAt
  }
}

/**
 * Everything that narrows a customer list, in one place: ownership, the segment, the
 * card, the free-text search and the filters. Shared by the list, the counts and the
 * CSV export so the three can never disagree about who is in scope.
 *
 * A saved or suggested segment, when given, takes the place of the plain bucket; the
 * URL filters still apply on top of it.
 */
export function customerScope(
  orgId: string,
  query: CustomerListQuery,
  frequency: VisitFrequency,
  definition?: SegmentDefinition,
) {
  const conditions = [eq(customers.orgId, orgId), isNull(customers.deletedAt)]

  if (definition) {
    conditions.push(...segmentDefinitionConditions(definition, frequency))
  } else {
    const segment = segmentCondition(query.segment, frequency)
    if (segment) conditions.push(segment)
  }

  if (query.search) {
    const pattern = `%${query.search}%`
    conditions.push(or(ilike(customers.firstName, pattern), ilike(customers.email, pattern))!)
  }

  conditions.push(...filterConditions(query))

  if (query.ids && query.ids.length > 0) conditions.push(inArray(customers.id, query.ids))

  if (query.cardId) {
    conditions.push(
      sql`exists (select 1 from ${customerCards} where ${customerCards.customerId} = ${customers.id} and ${customerCards.cardId} = ${query.cardId})`,
    )
  }

  return and(...conditions)
}

export async function listCustomers(
  db: Database,
  orgId: string,
  query: CustomerListQuery,
  frequency: VisitFrequency,
  definition?: SegmentDefinition,
) {
  const where = customerScope(orgId, query, frequency, definition)
  const column = sortColumn(query.sortBy)

  /**
   * Postgres sorts NULLs first on DESC, which would put customers who have never
   * visited at the top of a "most recent visits" list. They belong at the end.
   */
  const order =
    query.sortOrder === 'asc' ? sql`${column} asc nulls last` : sql`${column} desc nulls last`

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        email: customers.email,
        birthdayMonth: customers.birthdayMonth,
        birthdayDay: customers.birthdayDay,
        marketingConsent: customers.marketingConsent,
        totalStamps: customers.totalStamps,
        totalRewards: customers.totalRewards,
        joinedAt: customers.joinedAt,
        lastStampAt: customers.lastStampAt,
      })
      .from(customers)
      .where(where)
      .orderBy(order, desc(customers.joinedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(customers).where(where),
  ])

  return {
    items: rows,
    page: query.page,
    pageSize: query.pageSize,
    total: total?.value ?? 0,
    hasMore: query.page * query.pageSize < (total?.value ?? 0),
  }
}

/**
 * How the community is doing, in one query.
 *
 * Counted with the same conditions the list filters by, so clicking a bucket always
 * lands on exactly the people the number promised. The five buckets partition the
 * customers, so they add up to the total — if they ever stop adding up, the rules have
 * developed a hole.
 */
export async function communityCounts(
  db: Database,
  orgId: string,
  query: CustomerListQuery,
  frequency: VisitFrequency,
  definition?: SegmentDefinition,
): Promise<{ total: number; segments: Record<string, number> }> {
  const base = { ...query, segment: 'all' as const }
  // Inside a saved segment the tiles describe the community of that segment: its
  // filters stay, its base bucket gives way to each of the five.
  const scoped = (segment: CustomerListQuery['segment']) =>
    definition
      ? customerScope(orgId, base, frequency, { base: segment, filters: definition.filters })
      : customerScope(orgId, { ...base, segment }, frequency)

  const [[total], ...buckets] = await Promise.all([
    db.select({ value: count() }).from(customers).where(scoped('all')),
    ...COMMUNITY_SEGMENTS.map((segment) =>
      db
        .select({ value: count() })
        .from(customers)
        .where(scoped(segment))
        .then(([row]) => [segment, row?.value ?? 0] as const),
    ),
  ])

  return {
    total: total?.value ?? 0,
    segments: Object.fromEntries(buckets),
  }
}

/** Full profile for the customer drawer: cards, activity, rewards and answers. */
export async function getCustomer(db: Database, orgId: string, customerId: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.orgId, orgId)))
    .limit(1)

  if (!customer || customer.deletedAt) {
    throw new AppError('NOT_FOUND', { message: 'customer not found' })
  }

  const [cards, grants, answers, recent] = await Promise.all([
    db
      .select({
        id: customerCards.id,
        token: customerCards.token,
        cardName: stampCards.name,
        stampsCount: customerCards.stampsCount,
        stampsRequired: stampCards.stampsRequired,
        cycleIndex: customerCards.cycleIndex,
        lifetimeStamps: customerCards.lifetimeStamps,
        status: customerCards.status,
        joinedAt: customerCards.joinedAt,
        lastStampAt: customerCards.lastStampAt,
      })
      .from(customerCards)
      .innerJoin(stampCards, eq(stampCards.id, customerCards.cardId))
      .where(eq(customerCards.customerId, customerId)),
    db
      .select({
        id: rewardGrants.id,
        title: rewardGrants.title,
        code: rewardGrants.code,
        status: rewardGrants.status,
        grantedAt: rewardGrants.grantedAt,
        redeemedAt: rewardGrants.redeemedAt,
        expiresAt: rewardGrants.expiresAt,
      })
      .from(rewardGrants)
      .innerJoin(customerCards, eq(customerCards.id, rewardGrants.customerCardId))
      .where(eq(customerCards.customerId, customerId))
      .orderBy(desc(rewardGrants.grantedAt))
      .limit(50),
    db
      .select({
        questionId: customerAnswers.questionId,
        prompt: profileQuestions.prompt,
        value: customerAnswers.value,
        answeredAt: customerAnswers.answeredAt,
      })
      .from(customerAnswers)
      .innerJoin(profileQuestions, eq(profileQuestions.id, customerAnswers.questionId))
      .where(eq(customerAnswers.customerId, customerId)),
    db
      .select({
        id: stampEvents.id,
        delta: stampEvents.delta,
        source: stampEvents.source,
        occurredAt: stampEvents.occurredAt,
        resultingCount: stampEvents.resultingCount,
      })
      .from(stampEvents)
      .innerJoin(customerCards, eq(customerCards.id, stampEvents.customerCardId))
      .where(eq(customerCards.customerId, customerId))
      .orderBy(desc(stampEvents.occurredAt))
      .limit(30),
  ])

  return { customer, cards, rewards: grants, answers, activity: recent }
}

/**
 * Deletes a customer's personal data on request (GDPR/Habeas Data).
 *
 * The stamp ledger is kept but detached: the business keeps accurate historical
 * counts, while nothing in the retained rows identifies the person.
 */
export async function deleteCustomer(db: Database, orgId: string, customerId: string) {
  return db.transaction(async (tx) => {
    const [customer] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.orgId, orgId)))
      .limit(1)
    if (!customer) throw new AppError('NOT_FOUND', { message: 'customer not found' })

    await tx.delete(customerAnswers).where(eq(customerAnswers.customerId, customerId))

    await tx
      .update(customerCards)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(customerCards.customerId, customerId))

    await tx
      .update(customers)
      .set({
        firstName: 'Cliente eliminado',
        // Keep the row unique per organisation without keeping the address.
        email: `deleted-${customerId}@volvia.invalid`,
        phone: null,
        birthdayMonth: null,
        birthdayDay: null,
        marketingConsent: false,
        notes: '',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))

    await tx
      .update(organizations)
      .set({ customerCount: sql`greatest(0, ${organizations.customerCount} - 1)` })
      .where(eq(organizations.id, orgId))

    return { deleted: true }
  })
}

/** CSV export. Streams as a string: even a large business fits comfortably in memory. */
export async function exportCustomersCsv(
  db: Database,
  orgId: string,
  query: CustomerListQuery,
  frequency: VisitFrequency,
  definition?: SegmentDefinition,
): Promise<string> {
  const all = await listCustomers(
    db,
    orgId,
    { ...query, page: 1, pageSize: 10_000 },
    frequency,
    definition,
  )

  const header = [
    'nombre',
    'email',
    'cumpleanos',
    'consentimiento_marketing',
    'sellos_totales',
    'recompensas',
    'fecha_registro',
    'ultima_visita',
  ]

  const csvCell = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value)
    // Guard against CSV formula injection when the file is opened in a spreadsheet.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }

  const lines = [header.join(',')]
  for (const row of all.items) {
    lines.push(
      [
        csvCell(row.firstName),
        csvCell(row.email),
        csvCell(row.birthdayMonth ? `${row.birthdayDay}/${row.birthdayMonth}` : ''),
        csvCell(row.marketingConsent ? 'si' : 'no'),
        csvCell(row.totalStamps),
        csvCell(row.totalRewards),
        csvCell(row.joinedAt.toISOString()),
        csvCell(row.lastStampAt?.toISOString() ?? ''),
      ].join(','),
    )
  }

  return lines.join('\n')
}
