import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { rewards, stampCards } from './cards'
import { customerCardStatusEnum, localeEnum, rewardGrantStatusEnum, stampSourceEnum } from './enums'
import { users } from './identity'
import { locations, organizations, profileQuestions } from './org'

export const customers = pgTable(
  'customers',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    firstName: text().notNull(),
    email: text().notNull(),
    phone: text(),
    /** Birthday without a year — we never ask for age. */
    birthdayMonth: integer(),
    birthdayDay: integer(),
    locale: localeEnum().notNull().default('es'),
    marketingConsent: boolean().notNull().default(false),
    consentAt: timestamp({ withTimezone: true }),
    notes: text().notNull().default(''),
    /** Denormalised for list sorting and segment queries. */
    totalStamps: integer().notNull().default(0),
    totalRewards: integer().notNull().default(0),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastStampAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('customers_org_email_key').on(table.orgId, sql`lower(${table.email})`),
    index('customers_org_last_stamp_idx').on(table.orgId, table.lastStampAt),
    index('customers_birthday_idx').on(table.orgId, table.birthdayMonth, table.birthdayDay),
  ],
)

export const customerCards = pgTable(
  'customer_cards',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    cardId: uuid()
      .notNull()
      .references(() => stampCards.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Opaque, unguessable public identifier used in links, QR codes and wallet passes. */
    token: text().notNull(),
    stampsCount: integer().notNull().default(0),
    /** Increments each time the card completes and resets. */
    cycleIndex: integer().notNull().default(0),
    lifetimeStamps: integer().notNull().default(0),
    status: customerCardStatusEnum().notNull().default('active'),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastStampAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('customer_cards_token_key').on(table.token),
    uniqueIndex('customer_cards_card_customer_key').on(table.cardId, table.customerId),
    index('customer_cards_org_idx').on(table.orgId),
    index('customer_cards_last_stamp_idx').on(table.cardId, table.lastStampAt),
  ],
)

/**
 * Append-only ledger. The unique index on (customer_card_id, idempotency_key) is the
 * hard guarantee against double stamping; Redis is only the fast path in front of it.
 */
export const stampEvents = pgTable(
  'stamp_events',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerCardId: uuid()
      .notNull()
      .references(() => customerCards.id, { onDelete: 'cascade' }),
    locationId: uuid().references(() => locations.id, { onDelete: 'set null' }),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    source: stampSourceEnum().notNull().default('staff_scan'),
    delta: integer().notNull().default(1),
    /** Stamp total after applying this event, for auditability without replaying. */
    resultingCount: integer().notNull(),
    cycleIndex: integer().notNull().default(0),
    purchaseAmount: integer(),
    note: text(),
    idempotencyKey: text().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('stamp_events_idempotency_key').on(table.customerCardId, table.idempotencyKey),
    index('stamp_events_card_time_idx').on(table.customerCardId, table.occurredAt),
    index('stamp_events_org_time_idx').on(table.orgId, table.occurredAt),
  ],
)

export const rewardGrants = pgTable(
  'reward_grants',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerCardId: uuid()
      .notNull()
      .references(() => customerCards.id, { onDelete: 'cascade' }),
    rewardId: uuid().references(() => rewards.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text().notNull().default(''),
    /** Short human-typeable code, unique per organisation. */
    code: text().notNull(),
    status: rewardGrantStatusEnum().notNull().default('pending'),
    cycleIndex: integer().notNull().default(0),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }),
    redeemedAt: timestamp({ withTimezone: true }),
    redeemedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    redeemedLocationId: uuid().references(() => locations.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('reward_grants_org_code_key').on(table.orgId, table.code),
    index('reward_grants_card_status_idx').on(table.customerCardId, table.status),
    index('reward_grants_org_time_idx').on(table.orgId, table.grantedAt),
  ],
)

export const customerAnswers = pgTable(
  'customer_answers',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    questionId: uuid()
      .notNull()
      .references(() => profileQuestions.id, { onDelete: 'cascade' }),
    value: jsonb().$type<string | string[]>().notNull(),
    answeredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('customer_answers_key').on(table.customerId, table.questionId)],
)

export const customersRelations = relations(customers, ({ one, many }) => ({
  org: one(organizations, { fields: [customers.orgId], references: [organizations.id] }),
  cards: many(customerCards),
  answers: many(customerAnswers),
}))

export const customerCardsRelations = relations(customerCards, ({ one, many }) => ({
  customer: one(customers, { fields: [customerCards.customerId], references: [customers.id] }),
  card: one(stampCards, { fields: [customerCards.cardId], references: [stampCards.id] }),
  events: many(stampEvents),
  grants: many(rewardGrants),
}))
