import { sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { customerCards } from './customers'
import { walletPlatformEnum } from './enums'
import { organizations } from './org'

/** One row per issued wallet pass (a customer card can hold both an Apple and a Google pass). */
export const walletPasses = pgTable(
  'wallet_passes',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerCardId: uuid()
      .notNull()
      .references(() => customerCards.id, { onDelete: 'cascade' }),
    platform: walletPlatformEnum().notNull(),
    /** Apple: pass serialNumber. Google: the loyalty object id. */
    serial: text().notNull(),
    /** Bumped on every change; Apple uses it as the `lastUpdated` tag. */
    version: text().notNull().default('1'),
    lastPushedAt: timestamp({ withTimezone: true }),
    installedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('wallet_passes_serial_key').on(table.platform, table.serial),
    uniqueIndex('wallet_passes_card_platform_key').on(table.customerCardId, table.platform),
    index('wallet_passes_org_idx').on(table.orgId),
  ],
)

/** Device registrations from the Apple PassKit web service, used to send update pushes. */
export const applePassRegistrations = pgTable(
  'apple_pass_registrations',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    passId: uuid()
      .notNull()
      .references(() => walletPasses.id, { onDelete: 'cascade' }),
    deviceLibraryIdentifier: text().notNull(),
    pushToken: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('apple_registrations_key').on(table.passId, table.deviceLibraryIdentifier),
    index('apple_registrations_device_idx').on(table.deviceLibraryIdentifier),
  ],
)

/** Raw device logs Apple posts when a pass fails to update — invaluable when debugging. */
export const applePassLogs = pgTable('apple_pass_logs', {
  id: uuid().primaryKey().default(sql`gen_random_uuid()`),
  entries: jsonb().$type<string[]>().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
