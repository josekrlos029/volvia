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
import { authTokenPurposeEnum, localeEnum } from './enums'

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    email: text().notNull(),
    /** Null for accounts that only ever used Google or a magic link. */
    passwordHash: text(),
    name: text().notNull(),
    locale: localeEnum().notNull().default('es'),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    lastLoginAt: timestamp({ withTimezone: true }),
    /** Bumped to invalidate every issued refresh token for this user at once. */
    tokenVersion: integer().notNull().default(1),
    marketingOptIn: boolean().notNull().default(false),
    /** Volvia staff: may act as owner in any organisation. Only ever set by hand in the database. */
    isSuperadmin: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex('users_email_key').on(sql`lower(${table.email})`)],
)

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    providerUserId: text().notNull(),
    profile: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_identities_provider_key').on(table.provider, table.providerUserId),
    index('auth_identities_user_idx').on(table.userId),
  ],
)

/**
 * Single-use tokens for magic links, email verification, password reset and invites.
 * Only the SHA-256 of the token is stored, so a database leak cannot be replayed.
 */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    tokenHash: text().notNull(),
    purpose: authTokenPurposeEnum().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    email: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdIp: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_tokens_hash_key').on(table.tokenHash),
    index('auth_tokens_user_idx').on(table.userId, table.purpose),
    index('auth_tokens_expiry_idx').on(table.expiresAt),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  identities: many(authIdentities),
  tokens: many(authTokens),
}))

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, { fields: [authIdentities.userId], references: [users.id] }),
}))
