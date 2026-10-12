import { relations, sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './org'

/** The kinds of content a business can put on its public page. */
export type PageSectionKind = 'menu' | 'products' | 'services' | 'portfolio' | 'updates' | 'events'

/**
 * A block of the public page: "Entradas" on the menu, the products, the services.
 * The menu is the only kind with several sections; the rest have one each.
 */
export const pageSections = pgTable(
  'page_sections',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text().$type<PageSectionKind>().notNull(),
    title: text().notNull().default(''),
    description: text().notNull().default(''),
    position: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('page_sections_org_kind_idx').on(table.orgId, table.kind, table.position)],
)

/** One dish, product, service, piece of work, post or event. Fields not used by a kind stay null. */
export const pageItems = pgTable(
  'page_items',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sectionId: uuid()
      .notNull()
      .references(() => pageSections.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text().notNull().default(''),
    /** Minor units of the organisation's currency; null when there is no price to show. */
    priceAmount: integer(),
    imageUrl: text(),
    /** Services: how long an appointment takes. */
    durationMinutes: integer(),
    /** Events: when it happens. */
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    /** Updates: the date shown on the post. */
    publishedAt: timestamp({ withTimezone: true }),
    /** An optional button on the item, pointing at the business's own site. */
    buttonLabel: text(),
    buttonUrl: text(),
    /** Lets the customer ask about this item from the page. */
    askVia: text().$type<'whatsapp' | 'sms'>(),
    position: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('page_items_section_idx').on(table.sectionId, table.position)],
)

export const pageSectionsRelations = relations(pageSections, ({ one, many }) => ({
  org: one(organizations, { fields: [pageSections.orgId], references: [organizations.id] }),
  items: many(pageItems),
}))

export const pageItemsRelations = relations(pageItems, ({ one }) => ({
  section: one(pageSections, { fields: [pageItems.sectionId], references: [pageSections.id] }),
}))
