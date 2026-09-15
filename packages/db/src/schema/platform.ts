import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { stampCards } from './cards'
import {
  billingIntervalEnum,
  currencyEnum,
  outboxStatusEnum,
  paymentProviderEnum,
  planEnum,
  subscriptionStatusEnum,
} from './enums'
import { users } from './identity'
import { locations, organizations } from './org'

/**
 * Transactional outbox. Anything with a side effect outside Postgres — wallet pushes,
 * emails, campaign fan-out — is written here inside the same transaction as the state
 * change, then drained by a worker. No lost pushes, no phantom sends on rollback.
 */
export const outbox = pgTable(
  'outbox',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid().references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    lastError: text(),
    runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outbox_pending_idx').on(table.status, table.runAt),
    index('outbox_kind_idx').on(table.kind),
  ],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid().references(() => organizations.id, { onDelete: 'cascade' }),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    actorType: text().notNull().default('user'),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    meta: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ip: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_org_time_idx').on(table.orgId, table.createdAt),
    index('audit_logs_action_idx').on(table.action),
  ],
)

/** Daily rollups so the dashboard never aggregates the event ledger on the hot path. */
export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    cardId: uuid().references(() => stampCards.id, { onDelete: 'cascade' }),
    locationId: uuid().references(() => locations.id, { onDelete: 'set null' }),
    /** Calendar date in the organisation's timezone. */
    day: date().notNull(),
    joins: integer().notNull().default(0),
    stamps: integer().notNull().default(0),
    rewardsUnlocked: integer().notNull().default(0),
    rewardsRedeemed: integer().notNull().default(0),
    activeCustomers: integer().notNull().default(0),
    /** Stamps per hour bucket, for the "busiest hours" chart. */
    hourly: jsonb().$type<number[]>().notNull().default([]),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // `nullsNotDistinct` is essential here: locationId is null for org-wide rows, and
    // Postgres treats every null as distinct by default — which would defeat the upsert
    // and write one row per stamp instead of one row per day.
    unique('analytics_daily_key')
      .on(table.orgId, table.cardId, table.locationId, table.day)
      .nullsNotDistinct(),
    index('analytics_daily_org_day_idx').on(table.orgId, table.day),
  ],
)

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum().notNull(),
    providerCustomerId: text(),
    providerSubscriptionId: text(),
    plan: planEnum().notNull(),
    interval: billingIntervalEnum().notNull().default('monthly'),
    status: subscriptionStatusEnum().notNull().default('none'),
    currency: currencyEnum().notNull().default('cop'),
    extraLocations: integer().notNull().default(0),
    currentPeriodStart: timestamp({ withTimezone: true }),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    canceledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subscriptions_org_key').on(table.orgId),
    index('subscriptions_provider_idx').on(table.provider, table.providerSubscriptionId),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum().notNull(),
    providerPaymentId: text().notNull(),
    amount: integer().notNull(),
    currency: currencyEnum().notNull(),
    status: text().notNull(),
    description: text(),
    paidAt: timestamp({ withTimezone: true }),
    raw: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payments_provider_key').on(table.provider, table.providerPaymentId),
    index('payments_org_idx').on(table.orgId, table.createdAt),
  ],
)

/** Every webhook we receive, stored before processing so replays are cheap and auditable. */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    provider: paymentProviderEnum().notNull(),
    providerEventId: text().notNull(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('webhook_events_key').on(table.provider, table.providerEventId)],
)

/** An open kiosk screen. The rotating QR nonce itself lives in Redis with a 30s TTL. */
export const kioskSessions = pgTable(
  'kiosk_sessions',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    cardId: uuid()
      .notNull()
      .references(() => stampCards.id, { onDelete: 'cascade' }),
    locationId: uuid()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    deviceLabel: text(),
    secretHash: text().notNull(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('kiosk_sessions_org_idx').on(table.orgId, table.cardId)],
)
