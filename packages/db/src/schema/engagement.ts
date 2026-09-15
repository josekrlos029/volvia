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
import type {
  AutomationConfig,
  CampaignAudience,
  CampaignOffer,
  SurveyAnswer,
  SurveyQuestion,
} from '../types'
import { customerCards, customers } from './customers'
import {
  automationTypeEnum,
  campaignStatusEnum,
  campaignTemplateEnum,
  messageStatusEnum,
  surveyTriggerEnum,
} from './enums'
import { organizations } from './org'

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    template: campaignTemplateEnum().notNull().default('custom'),
    status: campaignStatusEnum().notNull().default('draft'),
    headline: text().notNull(),
    body: text().notNull(),
    offer: jsonb().$type<CampaignOffer>().notNull(),
    audience: jsonb().$type<CampaignAudience>().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    sendPush: boolean().notNull().default(true),
    activeWeekdays: jsonb().$type<number[]>().notNull().default([]),
    activeHours: jsonb().$type<{ from: string; to: string } | null>(),
    /** Counters filled in as the campaign runs. */
    stats: jsonb()
      .$type<{ targeted: number; delivered: number; redeemed: number; stamps: number }>()
      .notNull()
      .default({ targeted: 0, delivered: 0, redeemed: 0, stamps: 0 }),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('campaigns_org_status_idx').on(table.orgId, table.status, table.startsAt)],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    headline: text().notNull(),
    body: text().notNull(),
    audience: jsonb().$type<CampaignAudience>().notNull(),
    status: messageStatusEnum().notNull().default('draft'),
    scheduledAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }),
    targetedCount: integer().notNull().default(0),
    deliveredCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_org_idx').on(table.orgId, table.status)],
)

export const surveys = pgTable(
  'surveys',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    trigger: surveyTriggerEnum().notNull().default('after_reward'),
    triggerStamp: integer(),
    cardIds: jsonb().$type<string[]>().notNull().default([]),
    questions: jsonb().$type<SurveyQuestion[]>().notNull(),
    isAnonymous: boolean().notNull().default(false),
    /** Ratings at or above this go to the Google review prompt; below stay private. */
    routeToReviewFromRating: integer(),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('surveys_org_idx').on(table.orgId, table.isActive)],
)

export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    surveyId: uuid()
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    /** Null when the survey is anonymous. */
    customerCardId: uuid().references(() => customerCards.id, { onDelete: 'set null' }),
    rating: integer(),
    answers: jsonb().$type<SurveyAnswer[]>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('survey_responses_survey_idx').on(table.surveyId, table.createdAt),
    index('survey_responses_org_idx').on(table.orgId, table.createdAt),
  ],
)

export const reviewRequests = pgTable(
  'review_requests',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerCardId: uuid().references(() => customerCards.id, { onDelete: 'set null' }),
    trigger: text().notNull().default('after_reward'),
    shownAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    clickedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('review_requests_org_idx').on(table.orgId, table.shownAt)],
)

export const automations = pgTable(
  'automations',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: automationTypeEnum().notNull(),
    isActive: boolean().notNull().default(false),
    config: jsonb().$type<AutomationConfig>().notNull(),
    lastRunAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('automations_org_type_idx').on(table.orgId, table.type)],
)

/** One row per (automation, customer, occurrence) so a birthday never fires twice. */
export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    automationId: uuid()
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** e.g. `2026` for a birthday, `2026-W12` for a weekly nudge. */
    occurrenceKey: text().notNull(),
    ranAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('automation_runs_org_idx').on(table.orgId, table.ranAt),
    uniqueIndex('automation_runs_occurrence_key').on(
      table.automationId,
      table.customerId,
      table.occurrenceKey,
    ),
  ],
)

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  org: one(organizations, { fields: [campaigns.orgId], references: [organizations.id] }),
}))

export const surveysRelations = relations(surveys, ({ one, many }) => ({
  org: one(organizations, { fields: [surveys.orgId], references: [organizations.id] }),
  responses: many(surveyResponses),
}))
