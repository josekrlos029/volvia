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
import type { SocialLink } from '../types'
import { currencyEnum, localeEnum, planEnum, roleEnum, subscriptionStatusEnum } from './enums'
import { users } from './identity'

export const organizations = pgTable(
  'organizations',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    name: text().notNull(),
    /** Public handle: volvia.co/b/<slug> */
    slug: text().notNull(),
    category: text().notNull().default('other'),
    tagline: text().notNull().default(''),
    about: text().notNull().default(''),
    logoUrl: text(),
    coverUrl: text(),
    brandColor: text().notNull().default('#16624A'),
    country: text().notNull().default('CO'),
    currency: currencyEnum().notNull().default('cop'),
    timezone: text().notNull().default('America/Bogota'),
    locale: localeEnum().notNull().default('es'),
    socialLinks: jsonb().$type<SocialLink[]>().notNull().default([]),
    contactEmail: text(),
    contactPhone: text(),
    googlePlaceId: text(),

    plan: planEnum().notNull().default('free'),
    subscriptionStatus: subscriptionStatusEnum().notNull().default('none'),
    extraLocations: integer().notNull().default(0),
    /** Denormalised customer count; drives the premium trial gate without a COUNT(*). */
    customerCount: integer().notNull().default(0),

    onboarding: jsonb().$type<Record<string, boolean>>().notNull().default({}),
    settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('organizations_slug_key').on(table.slug),
    index('organizations_plan_idx').on(table.plan),
  ],
)

export const locations = pgTable(
  'locations',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    address: text(),
    city: text(),
    phone: text(),
    timezone: text().notNull().default('America/Bogota'),
    googlePlaceId: text(),
    hours: jsonb()
      .$type<Array<{ day: number; opens: string; closes: string }>>()
      .notNull()
      .default([]),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('locations_org_idx').on(table.orgId)],
)

export const memberships = pgTable(
  'memberships',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum().notNull().default('staff'),
    /** Staff may be scoped to one location; null means every location. */
    locationId: uuid().references(() => locations.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('memberships_org_user_key').on(table.orgId, table.userId),
    index('memberships_user_idx').on(table.userId),
  ],
)

export const invites = pgTable(
  'invites',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    role: roleEnum().notNull().default('staff'),
    locationId: uuid().references(() => locations.id, { onDelete: 'set null' }),
    invitedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invites_token_key').on(table.tokenHash),
    index('invites_org_idx').on(table.orgId),
  ],
)

/** "Know your regulars": optional questions asked at signup or after a reward. */
export const profileQuestions = pgTable(
  'profile_questions',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    prompt: text().notNull(),
    type: text().notNull().default('text'),
    options: jsonb().$type<string[]>().notNull().default([]),
    isRequired: boolean().notNull().default(false),
    askOn: text().notNull().default('signup'),
    position: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('profile_questions_org_idx').on(table.orgId)],
)

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(locations),
  memberships: many(memberships),
  invites: many(invites),
  profileQuestions: many(profileQuestions),
}))

export const membershipsRelations = relations(memberships, ({ one }) => ({
  org: one(organizations, { fields: [memberships.orgId], references: [organizations.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  location: one(locations, { fields: [memberships.locationId], references: [locations.id] }),
}))

export const locationsRelations = relations(locations, ({ one }) => ({
  org: one(organizations, { fields: [locations.orgId], references: [organizations.id] }),
}))
