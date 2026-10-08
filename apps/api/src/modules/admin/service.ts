import {
  type Database,
  and,
  desc,
  eq,
  ilike,
  isNull,
  memberships,
  or,
  organizations,
  users,
} from '@volvia/db'

/** Every live organisation with its owner, newest first, for Volvia staff. */
export async function listAllOrgs(db: Database, query: string | undefined) {
  const term = query?.trim()
  const pattern = term ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : null

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      customerCount: organizations.customerCount,
      createdAt: organizations.createdAt,
      ownerEmail: users.email,
    })
    .from(organizations)
    .leftJoin(
      memberships,
      and(eq(memberships.orgId, organizations.id), eq(memberships.role, 'owner')),
    )
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        isNull(organizations.deletedAt),
        pattern
          ? or(
              ilike(organizations.name, pattern),
              ilike(organizations.slug, pattern),
              ilike(users.email, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(desc(organizations.createdAt))
    .limit(200)

  // A business with two owners joins twice; the first owner is enough to recognise it.
  const seen = new Set<string>()
  return rows.filter((row) => !seen.has(row.id) && seen.add(row.id))
}
