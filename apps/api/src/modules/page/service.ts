import { createHash } from 'node:crypto'
import {
  type Database,
  type PageSectionKind,
  analyticsDaily,
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  organizations,
  pageItems,
  pageSections,
  sql,
} from '@volvia/db'
import { PAGE_SECTION_KINDS, type ReplacePageModuleInput } from '@volvia/shared'
import type { RedisClient } from '../../lib/redis'
import { orgDay } from '../../lib/time'

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

export type PageSectionRow = typeof pageSections.$inferSelect & {
  items: Array<typeof pageItems.$inferSelect>
}

/** Every section of the page with its items, grouped by kind and in display order. */
export async function loadPageSections(
  db: Tx,
  orgId: string,
  options: { activeOnly?: boolean } = {},
): Promise<Record<PageSectionKind, PageSectionRow[]>> {
  const sectionRows = await db
    .select()
    .from(pageSections)
    .where(
      and(
        eq(pageSections.orgId, orgId),
        ...(options.activeOnly ? [eq(pageSections.isActive, true)] : []),
      ),
    )
    .orderBy(asc(pageSections.position), asc(pageSections.createdAt))

  const ids = sectionRows.map((section) => section.id)
  const itemRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(pageItems)
          .where(
            and(
              inArray(pageItems.sectionId, ids),
              ...(options.activeOnly ? [eq(pageItems.isActive, true)] : []),
            ),
          )
          .orderBy(asc(pageItems.position), asc(pageItems.createdAt))

  const grouped = Object.fromEntries(
    PAGE_SECTION_KINDS.map((kind) => [kind, [] as PageSectionRow[]]),
  ) as Record<PageSectionKind, PageSectionRow[]>
  for (const section of sectionRows) {
    grouped[section.kind]?.push({
      ...section,
      items: itemRows.filter((item) => item.sectionId === section.id),
    })
  }
  return grouped
}

/**
 * Saves everything of one kind at once: the whole menu, all the products.
 *
 * Sections and items that come back with their id are updated in place, so an item's
 * picture and position survive an edit; anything left out is deleted. Nothing else in
 * the product references these rows, which is what makes deleting safe.
 */
export async function replacePageModule(
  db: Database,
  orgId: string,
  kind: PageSectionKind,
  input: ReplacePageModuleInput,
): Promise<PageSectionRow[]> {
  return db.transaction(async (tx) => {
    const existingSections = await tx
      .select({ id: pageSections.id })
      .from(pageSections)
      .where(and(eq(pageSections.orgId, orgId), eq(pageSections.kind, kind)))
    const knownSections = new Set(existingSections.map((row) => row.id))
    const keptSections = new Set<string>()

    for (const [position, section] of input.sections.entries()) {
      const values = {
        title: section.title,
        description: section.description,
        position,
        isActive: section.isActive,
        updatedAt: new Date(),
      }
      let sectionId: string
      if (section.id && knownSections.has(section.id)) {
        await tx.update(pageSections).set(values).where(eq(pageSections.id, section.id))
        sectionId = section.id
      } else {
        const [created] = await tx
          .insert(pageSections)
          .values({ orgId, kind, ...values })
          .returning({ id: pageSections.id })
        sectionId = created!.id
      }
      keptSections.add(sectionId)

      const existingItems = await tx
        .select({ id: pageItems.id })
        .from(pageItems)
        .where(eq(pageItems.sectionId, sectionId))
      const knownItems = new Set(existingItems.map((row) => row.id))
      const keptItems = new Set<string>()

      for (const [itemPosition, item] of section.items.entries()) {
        const itemValues = {
          title: item.title,
          description: item.description,
          priceAmount: item.priceAmount,
          imageUrl: item.imageUrl,
          durationMinutes: item.durationMinutes,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          publishedAt: item.publishedAt,
          buttonLabel: item.buttonLabel,
          buttonUrl: item.buttonUrl,
          askVia: item.askVia,
          position: itemPosition,
          isActive: item.isActive,
          updatedAt: new Date(),
        }
        if (item.id && knownItems.has(item.id)) {
          await tx.update(pageItems).set(itemValues).where(eq(pageItems.id, item.id))
          keptItems.add(item.id)
        } else {
          const [created] = await tx
            .insert(pageItems)
            .values({ orgId, sectionId, ...itemValues })
            .returning({ id: pageItems.id })
          keptItems.add(created!.id)
        }
      }

      const droppedItems = existingItems.filter((row) => !keptItems.has(row.id))
      if (droppedItems.length > 0) {
        await tx.delete(pageItems).where(
          inArray(
            pageItems.id,
            droppedItems.map((row) => row.id),
          ),
        )
      }
    }

    const droppedSections = existingSections.filter((row) => !keptSections.has(row.id))
    if (droppedSections.length > 0) {
      await tx.delete(pageSections).where(
        inArray(
          pageSections.id,
          droppedSections.map((row) => row.id),
        ),
      )
    }

    const all = await loadPageSections(tx, orgId)
    return all[kind]
  })
}

/** Opens of the public page in the last thirty days of the business's calendar. */
export async function pageViewsLast30Days(db: Database, orgId: string): Promise<number> {
  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  const since = orgDay(new Date(Date.now() - 30 * 86_400_000), org?.timezone ?? 'UTC')
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${analyticsDaily.pageViews}), 0)::int` })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.orgId, orgId),
        isNull(analyticsDaily.cardId),
        isNull(analyticsDaily.locationId),
        gte(analyticsDaily.day, since),
      ),
    )
  return row?.value ?? 0
}

/** A visitor is one browser per day: the same phone reloading does not count twice. */
export function pageViewKey(slug: string, ip: string, userAgent: string): string {
  const visitor = createHash('sha1').update(`${ip}|${userAgent}`).digest('hex').slice(0, 16)
  return `pageview:${slug}:${visitor}`
}

/**
 * Counts an open of the public page, once per visitor and day, into the org-wide
 * daily row. Nothing about the visitor is stored: the key is a hash with a day's life.
 */
export async function recordPageView(
  db: Database,
  redis: RedisClient,
  input: { slug: string; ip: string; userAgent: string },
): Promise<boolean> {
  const [org] = await db
    .select({ id: organizations.id, timezone: organizations.timezone })
    .from(organizations)
    .where(and(eq(organizations.slug, input.slug), isNull(organizations.deletedAt)))
    .limit(1)
  if (!org) return false

  const fresh = await redis.set(
    pageViewKey(input.slug, input.ip, input.userAgent),
    '1',
    'EX',
    86_400,
    'NX',
  )
  if (fresh !== 'OK') return false

  const now = new Date()
  await db
    .insert(analyticsDaily)
    .values({
      orgId: org.id,
      cardId: null,
      locationId: null,
      day: orgDay(now, org.timezone),
      pageViews: 1,
      hourly: Array.from({ length: 24 }, () => 0),
    })
    .onConflictDoUpdate({
      target: [
        analyticsDaily.orgId,
        analyticsDaily.cardId,
        analyticsDaily.locationId,
        analyticsDaily.day,
      ],
      set: { pageViews: sql`${analyticsDaily.pageViews} + 1`, updatedAt: now },
    })
  return true
}
