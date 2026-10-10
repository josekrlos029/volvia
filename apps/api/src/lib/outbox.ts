import { customerCards, eq, outbox, walletPasses } from '@volvia/db'
import type { Database } from '@volvia/db'

/** Job kinds the outbox worker knows how to drain. */
export const OUTBOX_KINDS = {
  walletUpdate: 'wallet.update',
  walletPush: 'wallet.push',
  emailSend: 'email.send',
  campaignStart: 'campaign.start',
  campaignEnd: 'campaign.end',
  messageSend: 'message.send',
  automationRun: 'automation.run',
  analyticsRollup: 'analytics.rollup',
  reviewRequest: 'review.request',
} as const

export type OutboxKind = (typeof OUTBOX_KINDS)[keyof typeof OUTBOX_KINDS]

export interface EnqueueOptions {
  orgId?: string | null
  runAt?: Date
}

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Enqueue inside the same transaction as the state change it belongs to. That is the
 * whole point: a rolled-back stamp can never leave a queued wallet push behind, and a
 * committed stamp can never lose one.
 */
export async function enqueue(
  tx: Tx,
  kind: OutboxKind,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<void> {
  await tx.insert(outbox).values({
    kind,
    payload,
    orgId: options.orgId ?? null,
    runAt: options.runAt ?? new Date(),
  })
}

/**
 * One `wallet.update` per card of the business that has a pass installed, for changes
 * that alter every pass at once (a shop moving, for instance). Returns how many were
 * queued.
 */
export async function enqueueWalletUpdatesForOrg(
  tx: Tx,
  orgId: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const holders = await tx
    .selectDistinct({ customerCardId: walletPasses.customerCardId })
    .from(walletPasses)
    .where(eq(walletPasses.orgId, orgId))

  await fanOutWalletUpdates(
    tx,
    orgId,
    holders.map((holder) => holder.customerCardId),
    payload,
  )
  return holders.length
}

/**
 * One `wallet.update` per installed pass of one card design: what a change to the
 * card's look has to reach. Other cards of the same business are left alone.
 */
export async function enqueueWalletUpdatesForCard(
  tx: Tx,
  orgId: string,
  cardId: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const holders = await tx
    .selectDistinct({ customerCardId: walletPasses.customerCardId })
    .from(walletPasses)
    .innerJoin(customerCards, eq(customerCards.id, walletPasses.customerCardId))
    .where(eq(customerCards.cardId, cardId))

  await fanOutWalletUpdates(
    tx,
    orgId,
    holders.map((holder) => holder.customerCardId),
    payload,
  )
  return holders.length
}

/**
 * One wallet update per customer card, in chunks: a busy café can have thousands of
 * cardholders, and a single insert of that size would hold a lock far longer than the
 * drain loop expects.
 */
export async function fanOutWalletUpdates(
  tx: Tx,
  orgId: string,
  customerCardIds: readonly string[],
  payload: Record<string, unknown>,
  chunkSize = 500,
): Promise<void> {
  for (let index = 0; index < customerCardIds.length; index += chunkSize) {
    const chunk = customerCardIds.slice(index, index + chunkSize)
    await tx.insert(outbox).values(
      chunk.map((customerCardId) => ({
        orgId,
        kind: OUTBOX_KINDS.walletUpdate,
        payload: { ...payload, customerCardId },
      })),
    )
  }
}
