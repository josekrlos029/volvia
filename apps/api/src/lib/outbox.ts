import { outbox } from '@volvia/db'
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
