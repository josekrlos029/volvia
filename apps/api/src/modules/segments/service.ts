import { type Database, and, asc, count, customerSegments, customers, eq, isNull } from '@volvia/db'
import {
  type CustomerSegment,
  type CustomerSegmentInput,
  MAX_CUSTOM_SEGMENTS,
  SUGGESTED_SEGMENTS,
  SUGGESTED_SEGMENT_KEYS,
  type SegmentDefinition,
  type SuggestedSegmentKey,
  type VisitFrequency,
  segmentDefinitionSchema,
} from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { segmentDefinitionConditions } from '../../lib/segments'

/** Where a list or an audience gets its base from, in order of precedence. */
export interface SegmentReference {
  segmentId?: string | null
  suggested?: SuggestedSegmentKey | string | null
  segment?: CustomerSegment | string
}

/**
 * Turns whatever the caller pointed at into one definition.
 *
 * A saved segment wins over a suggested one, which wins over a plain bucket. The
 * worker passes `allowDeleted` because a scheduled message must still go out after
 * its owner removed the segment it was aimed at; the API never does.
 */
export async function resolveSegmentDefinition(
  db: Database,
  orgId: string,
  reference: SegmentReference,
  options: { allowDeleted?: boolean } = {},
): Promise<SegmentDefinition> {
  if (reference.segmentId) {
    const [row] = await db
      .select({ definition: customerSegments.definition, deletedAt: customerSegments.deletedAt })
      .from(customerSegments)
      .where(and(eq(customerSegments.id, reference.segmentId), eq(customerSegments.orgId, orgId)))
      .limit(1)
    if (!row || (row.deletedAt && !options.allowDeleted)) {
      throw new AppError('NOT_FOUND', { message: 'segment not found' })
    }
    // Written as jsonb, possibly by an older version: validated on the way out.
    return segmentDefinitionSchema.parse(row.definition)
  }

  if (reference.suggested) {
    const suggested = SUGGESTED_SEGMENTS[reference.suggested as SuggestedSegmentKey]
    if (!suggested) throw new AppError('NOT_FOUND', { message: 'suggested segment not found' })
    return suggested.definition
  }

  return segmentDefinitionSchema.parse({ base: reference.segment ?? 'all', filters: {} })
}

export async function countDefinition(
  db: Database,
  orgId: string,
  definition: SegmentDefinition,
  frequency: VisitFrequency,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(customers)
    .where(
      and(
        eq(customers.orgId, orgId),
        isNull(customers.deletedAt),
        ...segmentDefinitionConditions(definition, frequency),
      ),
    )
  return row?.value ?? 0
}

export async function listSegments(db: Database, orgId: string, frequency: VisitFrequency) {
  const rows = await db
    .select()
    .from(customerSegments)
    .where(and(eq(customerSegments.orgId, orgId), isNull(customerSegments.deletedAt)))
    .orderBy(asc(customerSegments.name))

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      count: await countDefinition(
        db,
        orgId,
        segmentDefinitionSchema.parse(row.definition),
        frequency,
      ),
    })),
  )
}

/** The suggested segments with how many people each one holds right now. */
export async function suggestedWithCounts(db: Database, orgId: string, frequency: VisitFrequency) {
  return Promise.all(
    SUGGESTED_SEGMENT_KEYS.map(async (key) => {
      const suggested = SUGGESTED_SEGMENTS[key]
      return {
        key,
        name: suggested.name,
        description: suggested.description,
        definition: suggested.definition,
        count: await countDefinition(db, orgId, suggested.definition, frequency),
      }
    }),
  )
}

export async function getSegment(
  db: Database,
  orgId: string,
  segmentId: string,
  frequency: VisitFrequency,
) {
  const [row] = await db
    .select()
    .from(customerSegments)
    .where(
      and(
        eq(customerSegments.id, segmentId),
        eq(customerSegments.orgId, orgId),
        isNull(customerSegments.deletedAt),
      ),
    )
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', { message: 'segment not found' })
  return {
    ...row,
    count: await countDefinition(
      db,
      orgId,
      segmentDefinitionSchema.parse(row.definition),
      frequency,
    ),
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

export async function createSegment(db: Database, orgId: string, data: CustomerSegmentInput) {
  const [existing] = await db
    .select({ value: count() })
    .from(customerSegments)
    .where(and(eq(customerSegments.orgId, orgId), isNull(customerSegments.deletedAt)))
  if ((existing?.value ?? 0) >= MAX_CUSTOM_SEGMENTS) {
    throw new AppError('VALIDATION_FAILED', {
      message: `a business can keep at most ${MAX_CUSTOM_SEGMENTS} segments`,
    })
  }

  try {
    const [created] = await db
      .insert(customerSegments)
      .values({
        orgId,
        name: data.name,
        description: data.description,
        definition: data.definition,
      })
      .returning()
    return created!
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('CONFLICT', { message: 'a segment with that name already exists' })
    }
    throw error
  }
}

export async function updateSegment(
  db: Database,
  orgId: string,
  segmentId: string,
  data: CustomerSegmentInput,
) {
  try {
    const [updated] = await db
      .update(customerSegments)
      .set({
        name: data.name,
        description: data.description,
        definition: data.definition,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerSegments.id, segmentId),
          eq(customerSegments.orgId, orgId),
          isNull(customerSegments.deletedAt),
        ),
      )
      .returning()
    if (!updated) throw new AppError('NOT_FOUND', { message: 'segment not found' })
    return updated
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('CONFLICT', { message: 'a segment with that name already exists' })
    }
    throw error
  }
}

export async function deleteSegment(db: Database, orgId: string, segmentId: string): Promise<void> {
  const [deleted] = await db
    .update(customerSegments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(customerSegments.id, segmentId),
        eq(customerSegments.orgId, orgId),
        isNull(customerSegments.deletedAt),
      ),
    )
    .returning({ id: customerSegments.id })
  if (!deleted) throw new AppError('NOT_FOUND', { message: 'segment not found' })
}
