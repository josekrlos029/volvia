import type { StampRules, StampSource } from '@volvia/shared'

export interface StampAttempt {
  now: Date
  rules: StampRules
  source: StampSource
  /** When this customer last got a stamp on this card, in any location. */
  lastStampAt: Date | null
  /** Stamps already applied to this customer's card today, in the org's timezone. */
  stampsToday: number
  requestedCount: number
  /** Minor units of the org currency; required when the rule mode is `min_spend`. */
  purchaseAmount?: number
}

export type StampDecision =
  | { allowed: true; granted: number }
  | {
      allowed: false
      reason: 'cooldown' | 'daily_cap' | 'below_min_spend' | 'missing_amount'
      retryAfterSeconds?: number
      detail?: string
    }

/**
 * Decides whether a scan may add stamps, and how many.
 *
 * Pure and side-effect free so every anti-fraud rule can be unit tested without a
 * database: cooldown between visits, the daily cap (stricter for self-serve kiosk
 * scans), how many stamps a single scan may add, and spend thresholds.
 */
export function evaluateStamp(attempt: StampAttempt): StampDecision {
  const { rules, now, source } = attempt

  if (rules.mode === 'min_spend') {
    if (attempt.purchaseAmount === undefined) {
      return { allowed: false, reason: 'missing_amount', detail: 'purchaseAmount is required' }
    }
    if (attempt.purchaseAmount < (rules.minSpendAmount ?? 0)) {
      return { allowed: false, reason: 'below_min_spend' }
    }
  }

  // Manual adjustments and imports are deliberate acts by the business, so they
  // bypass the anti-fraud rules that exist to police the counter. A remote stamp is
  // the counter without the customer in front of it: it needs them most.
  const enforced = source === 'staff_scan' || source === 'kiosk' || source === 'remote'

  if (enforced && rules.cooldownMinutes > 0 && attempt.lastStampAt) {
    const elapsedSeconds = (now.getTime() - attempt.lastStampAt.getTime()) / 1000
    const cooldownSeconds = rules.cooldownMinutes * 60
    if (elapsedSeconds < cooldownSeconds) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterSeconds: Math.ceil(cooldownSeconds - elapsedSeconds),
      }
    }
  }

  if (enforced) {
    // A customer stamping their own card at a kiosk gets the tighter cap.
    const cap = source === 'kiosk' ? Math.min(rules.kioskDailyCap, rules.dailyCap) : rules.dailyCap
    if (attempt.stampsToday >= cap) {
      return { allowed: false, reason: 'daily_cap' }
    }
    const remaining = cap - attempt.stampsToday
    const granted = Math.min(attempt.requestedCount, rules.maxStampsPerScan, remaining)
    return granted > 0 ? { allowed: true, granted } : { allowed: false, reason: 'daily_cap' }
  }

  return { allowed: true, granted: Math.max(1, attempt.requestedCount) }
}

/**
 * Works out which reward positions a stamp run crosses.
 *
 * Positions are 1-based within a cycle. A run that completes the card wraps: the card
 * resets to zero and any leftover stamps carry into the next cycle, so a double-stamp
 * on the last slot is never silently thrown away.
 */
export function rewardsCrossed(input: {
  from: number
  granted: number
  stampsRequired: number
  rewardPositions: number[]
}): { unlocked: number[]; finalCount: number; cyclesCompleted: number } {
  const unlocked: number[] = []
  let current = input.from
  let cyclesCompleted = 0

  for (let i = 0; i < input.granted; i += 1) {
    current += 1
    if (input.rewardPositions.includes(current)) unlocked.push(current)
    if (current >= input.stampsRequired) {
      current = 0
      cyclesCompleted += 1
    }
  }

  return { unlocked, finalCount: current, cyclesCompleted }
}

export interface VoidAttempt {
  now: Date
  windowMinutes: number
  /** Admins and owners may undo any scan; staff only their own, and only briefly. */
  isAdmin: boolean
  actorUserId: string
  event: { actorUserId: string | null; source: StampSource; createdAt: Date; delta: number }
  /** True when nothing else was written to the card after this scan. */
  isLatestEvent: boolean
  /** A reward this scan unlocked has already been handed over. */
  unlockedRewardRedeemed: boolean
}

export type VoidDecision =
  | { allowed: true }
  | { allowed: false; reason: 'not_a_scan' | 'not_yours' | 'too_late' | 'card_moved_on' }

/**
 * Decides whether a scan may be taken back.
 *
 * Only the most recent write to a card is reversible: undoing an older one would mean
 * rewriting everything that happened after it, and a reward already in the customer's
 * hands cannot be un-given.
 */
export function evaluateVoid(attempt: VoidAttempt): VoidDecision {
  const { event } = attempt
  const reversible = event.source === 'staff_scan' || event.source === 'remote'
  if (!reversible || event.delta <= 0) return { allowed: false, reason: 'not_a_scan' }

  if (!attempt.isAdmin) {
    if (event.actorUserId !== attempt.actorUserId) return { allowed: false, reason: 'not_yours' }
    const ageMs = attempt.now.getTime() - event.createdAt.getTime()
    if (ageMs > attempt.windowMinutes * 60_000) return { allowed: false, reason: 'too_late' }
  }

  if (!attempt.isLatestEvent || attempt.unlockedRewardRedeemed) {
    return { allowed: false, reason: 'card_moved_on' }
  }
  return { allowed: true }
}
