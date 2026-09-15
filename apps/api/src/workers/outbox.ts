import { type Database, and, eq, inArray, lte, outbox, sql } from '@volvia/db'
import type { FastifyBaseLogger } from 'fastify'
import { jobCounter, outboxDepth } from '../plugins/observability'

export interface OutboxHandlerContext {
  db: Database
  logger: FastifyBaseLogger
}

export type OutboxHandler = (
  payload: Record<string, unknown>,
  context: OutboxHandlerContext,
) => Promise<void>

/** Retry schedule: quick twice, then back off, then give up and park in `failed`. */
const MAX_ATTEMPTS = 6
const BACKOFF_SECONDS = [10, 30, 120, 600, 1_800, 3_600]
const BATCH_SIZE = 25
/** A row locked for longer than this is assumed abandoned by a crashed worker. */
const STALE_LOCK_SECONDS = 300

/**
 * Drains the transactional outbox.
 *
 * `for update skip locked` is what makes this safe to run on several Cloud Run
 * instances at once: each worker takes a disjoint batch, and nothing is processed twice.
 */
export async function drainOutbox(
  db: Database,
  handlers: Record<string, OutboxHandler>,
  logger: FastifyBaseLogger,
): Promise<{ processed: number; failed: number }> {
  const now = new Date()
  let processed = 0
  let failed = 0

  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, 'pending'), lte(outbox.runAt, now)))
      .orderBy(outbox.runAt)
      .limit(BATCH_SIZE)
      .for('update', { skipLocked: true })

    if (rows.length === 0) return []

    // Parameterised: never interpolate ids into SQL, even ids that came from the
    // database a moment ago.
    await tx
      .update(outbox)
      .set({ status: 'processing', lockedAt: now })
      .where(
        inArray(
          outbox.id,
          rows.map((row) => row.id),
        ),
      )

    return rows
  })

  for (const row of claimed) {
    const handler = handlers[row.kind]

    if (!handler) {
      logger.error({ kind: row.kind, id: row.id }, 'no handler for outbox kind')
      await db
        .update(outbox)
        .set({ status: 'failed', lastError: `no handler for ${row.kind}` })
        .where(eq(outbox.id, row.id))
      failed += 1
      continue
    }

    try {
      await handler(row.payload, { db, logger })
      await db
        .update(outbox)
        .set({ status: 'done', completedAt: new Date(), lockedAt: null })
        .where(eq(outbox.id, row.id))
      jobCounter.labels(row.kind, 'ok').inc()
      processed += 1
    } catch (error) {
      const attempts = row.attempts + 1
      const exhausted = attempts >= MAX_ATTEMPTS
      const delay = BACKOFF_SECONDS[Math.min(attempts, BACKOFF_SECONDS.length - 1)]!

      await db
        .update(outbox)
        .set({
          status: exhausted ? 'failed' : 'pending',
          attempts,
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
          runAt: new Date(Date.now() + delay * 1000),
          lockedAt: null,
        })
        .where(eq(outbox.id, row.id))

      jobCounter.labels(row.kind, exhausted ? 'failed' : 'retry').inc()
      logger.warn({ kind: row.kind, id: row.id, attempts, exhausted }, 'outbox job failed')
      failed += 1
    }
  }

  const [depth] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(outbox)
    .where(eq(outbox.status, 'pending'))
  outboxDepth.set(depth?.value ?? 0)

  return { processed, failed }
}

/** Returns rows stuck in `processing` — a worker died mid-job — back to the queue. */
export async function requeueStale(db: Database, logger: FastifyBaseLogger): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_SECONDS * 1000)
  const rows = await db
    .update(outbox)
    .set({ status: 'pending', lockedAt: null })
    .where(and(eq(outbox.status, 'processing'), lte(outbox.lockedAt, cutoff)))
    .returning({ id: outbox.id })

  if (rows.length > 0) logger.warn({ count: rows.length }, 'requeued stale outbox rows')
  return rows.length
}
