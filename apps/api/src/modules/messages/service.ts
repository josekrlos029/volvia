import {
  type Database,
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  messageDeliveries,
  messages,
  outbox,
  sql,
} from '@volvia/db'
import type { Entitlements, MessageInput, VisitFrequency } from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { OUTBOX_KINDS } from '../../lib/outbox'
import { assertWithinLimit } from '../../plugins/auth'
import { resolveAudienceDefinition, resolveAudienceReach } from '../engagement/audience'

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

export async function listMessages(db: Database, orgId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.orgId, orgId))
    .orderBy(desc(messages.createdAt))
    .limit(100)
}

/** Metered per calendar month, like campaigns. A draft costs nothing until it is sent. */
export async function messagesThisMonth(db: Database, orgId: string): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const [row] = await db
    .select({ value: count() })
    .from(messages)
    .where(
      and(
        eq(messages.orgId, orgId),
        gte(messages.createdAt, monthStart),
        inArray(messages.status, ['scheduled', 'sending', 'sent']),
      ),
    )
  return row?.value ?? 0
}

export async function getMessage(db: Database, orgId: string, messageId: string) {
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.orgId, orgId)))
    .limit(1)
  if (!message) throw new AppError('NOT_FOUND', { message: 'message not found' })

  const rows = await db
    .select({ status: messageDeliveries.status, value: count() })
    .from(messageDeliveries)
    .where(eq(messageDeliveries.messageId, messageId))
    .groupBy(messageDeliveries.status)

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.value]))
  return {
    ...message,
    deliveries: {
      queued: byStatus.queued ?? 0,
      delivered: byStatus.delivered ?? 0,
      failed: byStatus.failed ?? 0,
      skipped: byStatus.skipped_no_pass ?? 0,
    },
  }
}

/**
 * A message is marketing by definition, so consent is not optional: it is forced here
 * and forced again when the worker resolves the audience.
 */
export async function createMessage(db: Database, input: { orgId: string; data: MessageInput }) {
  const audience = { ...input.data.audience, consentOnly: true }
  // A bad segment id should fail now, in front of the person, not later in the worker.
  await resolveAudienceDefinition(db, input.orgId, audience)

  const [created] = await db
    .insert(messages)
    .values({
      orgId: input.orgId,
      headline: input.data.headline,
      body: input.data.body,
      audience,
      status: 'draft',
    })
    .returning()
  return created!
}

export async function previewMessageAudience(
  db: Database,
  orgId: string,
  audience: MessageInput['audience'],
  frequency: VisitFrequency,
) {
  return resolveAudienceReach(db, orgId, { ...audience, consentOnly: true }, frequency)
}

export async function sendMessage(
  db: Database,
  input: { orgId: string; entitlements: Entitlements; messageId: string; scheduledAt: Date | null },
) {
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, input.messageId), eq(messages.orgId, input.orgId)))
    .limit(1)
  if (!message) throw new AppError('NOT_FOUND', { message: 'message not found' })
  if (message.status !== 'draft' && message.status !== 'scheduled') {
    throw new AppError('CONFLICT', { message: 'this message already went out' })
  }

  // Re-scheduling something already counted must not count it twice.
  if (message.status === 'draft') {
    const used = await messagesThisMonth(db, input.orgId)
    assertWithinLimit(input.entitlements, 'messagesPerMonth', used)
  }

  const runAt = input.scheduledAt ?? new Date()

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(messages)
      .set({ status: 'scheduled', scheduledAt: runAt, error: null, updatedAt: new Date() })
      .where(eq(messages.id, message.id))
      .returning()

    await tx.insert(outbox).values({
      orgId: input.orgId,
      kind: OUTBOX_KINDS.messageSend,
      payload: { messageId: message.id },
      runAt,
    })

    return updated!
  })
}

/**
 * Only a scheduled message can be pulled back. The outbox row already written stays
 * where it is: when it drains, the handler finds a draft and does nothing.
 */
export async function cancelMessage(db: Database, orgId: string, messageId: string) {
  const [updated] = await db
    .update(messages)
    .set({ status: 'draft', scheduledAt: null, updatedAt: new Date() })
    .where(
      and(eq(messages.id, messageId), eq(messages.orgId, orgId), eq(messages.status, 'scheduled')),
    )
    .returning()
  if (!updated)
    throw new AppError('CONFLICT', { message: 'only a scheduled message can be cancelled' })
  return updated
}

/**
 * Records the outcome for one card and closes the message once nothing is left in
 * the queue. Only a queued row moves, so a retried wallet update cannot count twice.
 */
export async function settleDelivery(
  tx: Tx,
  input: {
    messageId: string
    customerCardId: string
    status: 'delivered' | 'failed' | 'skipped_no_pass'
    error?: string | null
  },
): Promise<void> {
  const [settled] = await tx
    .update(messageDeliveries)
    .set({
      status: input.status,
      deliveredAt: input.status === 'delivered' ? new Date() : null,
      error: input.error?.slice(0, 500) ?? null,
    })
    .where(
      and(
        eq(messageDeliveries.messageId, input.messageId),
        eq(messageDeliveries.customerCardId, input.customerCardId),
        eq(messageDeliveries.status, 'queued'),
      ),
    )
    .returning({ id: messageDeliveries.id })

  if (settled && input.status === 'delivered') {
    await tx
      .update(messages)
      .set({ deliveredCount: sql`${messages.deliveredCount} + 1`, updatedAt: new Date() })
      .where(eq(messages.id, input.messageId))
  }

  await tx
    .update(messages)
    .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(messages.id, input.messageId),
        eq(messages.status, 'sending'),
        sql`not exists (select 1 from ${messageDeliveries} where ${messageDeliveries.messageId} = ${messages.id} and ${messageDeliveries.status} = 'queued')`,
      ),
    )
}
