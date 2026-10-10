import { auditLogs } from '@volvia/db'
import type { Database } from '@volvia/db'

export interface AuditEntry {
  orgId?: string | null
  actorUserId?: string | null
  actorType?: 'user' | 'system' | 'customer' | 'kiosk'
  action: string
  targetType?: string
  targetId?: string
  meta?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Records a sensitive action. Never include personal data in `meta` — ids and counts
 * only, so the audit trail can be kept long after a customer exercises deletion.
 */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    orgId: entry.orgId ?? null,
    actorUserId: entry.actorUserId ?? null,
    actorType: entry.actorType ?? 'user',
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    meta: entry.meta ?? {},
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
  })
}

export const AUDIT_ACTIONS = {
  authLogin: 'auth.login',
  authLoginFailed: 'auth.login_failed',
  authRegister: 'auth.register',
  authPasswordReset: 'auth.password_reset',
  authRefreshReuse: 'auth.refresh_reuse_detected',
  memberInvited: 'member.invited',
  memberAccepted: 'member.accepted',
  memberRemoved: 'member.removed',
  memberRoleChanged: 'member.role_changed',
  cardCreated: 'card.created',
  cardUpdated: 'card.updated',
  cardPublished: 'card.published',
  cardArchived: 'card.archived',
  stampAdded: 'stamp.added',
  stampAdjusted: 'stamp.adjusted',
  rewardRedeemed: 'reward.redeemed',
  customerDeleted: 'customer.deleted',
  customerExported: 'customer.exported',
  kioskOpened: 'kiosk.opened',
  kioskRevoked: 'kiosk.revoked',
  campaignLaunched: 'campaign.launched',
  messageSent: 'message.sent',
  segmentCreated: 'segment.created',
  segmentDeleted: 'segment.deleted',
  planChanged: 'plan.changed',
  orgDeleted: 'org.deleted',
} as const
