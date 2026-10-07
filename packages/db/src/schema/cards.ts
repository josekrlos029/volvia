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
import type { CardDesign, CardMessages, StampRules } from '../types'
import { cardStatusEnum, rewardKindEnum } from './enums'
import { organizations } from './org'

export const stampCards = pgTable(
  'stamp_cards',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    status: cardStatusEnum().notNull().default('draft'),
    stampsRequired: integer().notNull().default(8),
    design: jsonb().$type<CardDesign>().notNull(),
    rules: jsonb().$type<StampRules>().notNull(),
    terms: text().notNull().default(''),
    /** Progress is wiped after this many days without a stamp; null = never. */
    inactivityExpiryDays: integer(),
    collectBirthday: boolean().notNull().default(true),
    /** Stamps granted on joining, so a new card never starts empty. */
    initialStamps: integer().notNull().default(0),
    messages: jsonb().$type<CardMessages>().notNull().default({ variants: [], perStamp: {} }),
    signupQuestionIds: jsonb().$type<string[]>().notNull().default([]),
    /** Public join handle used by the QR: /j/<joinSlug> */
    joinSlug: text().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('stamp_cards_join_slug_key').on(table.joinSlug),
    index('stamp_cards_org_idx').on(table.orgId, table.status),
  ],
)

export const rewards = pgTable(
  'rewards',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    cardId: uuid()
      .notNull()
      .references(() => stampCards.id, { onDelete: 'cascade' }),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** 1-based stamp position that unlocks this reward. */
    atStamp: integer().notNull(),
    title: text().notNull(),
    description: text().notNull().default(''),
    kind: rewardKindEnum().notNull().default('free_item'),
    isRepeating: boolean().notNull().default(true),
    expiresInDays: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('rewards_card_position_key').on(table.cardId, table.atStamp),
    index('rewards_org_idx').on(table.orgId),
  ],
)

export const stampCardsRelations = relations(stampCards, ({ one, many }) => ({
  org: one(organizations, { fields: [stampCards.orgId], references: [organizations.id] }),
  rewards: many(rewards),
}))

export const rewardsRelations = relations(rewards, ({ one }) => ({
  card: one(stampCards, { fields: [rewards.cardId], references: [stampCards.id] }),
}))
