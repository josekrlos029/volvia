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
import { type CustomerListQuery, type CustomerSegment, SEGMENT_RULES } from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { daysAgo } from '../../lib/time'

/**
 * Turns a segment name into a SQL condition.
 *
 * Segments are defined by behaviour, not tags, so they stay accurate without the
 * business maintaining anything: a regular is someone who actually came back.
 */
function segmentCondition(segment: CustomerSegment) {
  switch (segment) {
    case 'regulars':
      return gte(customers.totalStamps, SEGMENT_RULES.regulars.minStampsLast90Days)
    case 'at_risk':
      return and(
        lte(customers.lastStampAt, daysAgo(SEGMENT_RULES.at_risk.inactiveDaysMin)),
        gte(customers.lastStampAt, daysAgo(SEGMENT_RULES.at_risk.inactiveDaysMax)),
      )
    case 'inactive':
      return lte(customers.lastStampAt, daysAgo(SEGMENT_RULES.inactive.inactiveDaysMin))
    case 'new':
      return gte(customers.joinedAt, daysAgo(SEGMENT_RULES.new.joinedWithinDays))
    case 'birthday_month':
      return eq(customers.birthdayMonth, new Date().getMonth() + 1)
    default:
      return undefined
  }
}

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

export async function listCustomers(db: Database, orgId: string, query: CustomerListQuery) {
  const conditions = [eq(customers.orgId, orgId), isNull(customers.deletedAt)]

  const segment = segmentCondition(query.segment)
  if (segment) conditions.push(segment)

  if (query.search) {
    const pattern = `%${query.search}%`
    conditions.push(or(ilike(customers.firstName, pattern), ilike(customers.email, pattern))!)
  }
  if (query.hasConsent !== undefined) {
    conditions.push(eq(customers.marketingConsent, query.hasConsent))
  }

  const where = and(...conditions)
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
): Promise<string> {
  const all = await listCustomers(db, orgId, { ...query, page: 1, pageSize: 10_000 })

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
