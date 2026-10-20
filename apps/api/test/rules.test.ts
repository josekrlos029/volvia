import { describe, expect, it } from 'vitest'
import { evaluateStamp, evaluateVoid, rewardsCrossed } from '../src/modules/loyalty/rules'

const rules = {
  mode: 'per_visit' as const,
  minSpendAmount: null,
  cooldownMinutes: 30,
  dailyCap: 3,
  maxStampsPerScan: 2,
  kioskEnabled: true,
  kioskDailyCap: 1,
}

const now = new Date('2026-09-02T15:00:00Z')

describe('evaluateStamp', () => {
  it('allows a first stamp', () => {
    expect(
      evaluateStamp({
        now,
        rules,
        source: 'staff_scan',
        lastStampAt: null,
        stampsToday: 0,
        requestedCount: 1,
      }),
    ).toEqual({ allowed: true, granted: 1 })
  })

  it('blocks a re-scan inside the cooldown and says when to retry', () => {
    const decision = evaluateStamp({
      now,
      rules,
      source: 'staff_scan',
      lastStampAt: new Date(now.getTime() - 10 * 60_000),
      stampsToday: 1,
      requestedCount: 1,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toBe('cooldown')
      expect(decision.retryAfterSeconds).toBe(20 * 60)
    }
  })

  it('enforces the daily cap', () => {
    const decision = evaluateStamp({
      now,
      rules,
      source: 'staff_scan',
      lastStampAt: new Date(now.getTime() - 120 * 60_000),
      stampsToday: 3,
      requestedCount: 1,
    })
    expect(decision).toMatchObject({ allowed: false, reason: 'daily_cap' })
  })

  it('applies the tighter kiosk cap', () => {
    const decision = evaluateStamp({
      now,
      rules,
      source: 'kiosk',
      lastStampAt: null,
      stampsToday: 1,
      requestedCount: 1,
    })
    expect(decision).toMatchObject({ allowed: false, reason: 'daily_cap' })
  })

  it('never grants more than maxStampsPerScan or the remaining cap', () => {
    const decision = evaluateStamp({
      now,
      rules,
      source: 'staff_scan',
      lastStampAt: null,
      stampsToday: 2,
      requestedCount: 5,
    })
    expect(decision).toEqual({ allowed: true, granted: 1 })
  })

  it('requires a purchase amount in min_spend mode', () => {
    const spendRules = { ...rules, mode: 'min_spend' as const, minSpendAmount: 10_000 }
    expect(
      evaluateStamp({
        now,
        rules: spendRules,
        source: 'staff_scan',
        lastStampAt: null,
        stampsToday: 0,
        requestedCount: 1,
      }),
    ).toMatchObject({ allowed: false, reason: 'missing_amount' })

    expect(
      evaluateStamp({
        now,
        rules: spendRules,
        source: 'staff_scan',
        lastStampAt: null,
        stampsToday: 0,
        requestedCount: 1,
        purchaseAmount: 9_000,
      }),
    ).toMatchObject({ allowed: false, reason: 'below_min_spend' })

    expect(
      evaluateStamp({
        now,
        rules: spendRules,
        source: 'staff_scan',
        lastStampAt: null,
        stampsToday: 0,
        requestedCount: 1,
        purchaseAmount: 10_000,
      }),
    ).toEqual({ allowed: true, granted: 1 })
  })

  it('lets manual corrections bypass counter rules', () => {
    const decision = evaluateStamp({
      now,
      rules,
      source: 'manual',
      lastStampAt: new Date(now.getTime() - 60_000),
      stampsToday: 10,
      requestedCount: 3,
    })
    expect(decision).toEqual({ allowed: true, granted: 3 })
  })
})

describe('rewardsCrossed', () => {
  it('unlocks a reward when its position is reached', () => {
    expect(
      rewardsCrossed({ from: 3, granted: 1, stampsRequired: 8, rewardPositions: [4, 8] }),
    ).toEqual({
      unlocked: [4],
      finalCount: 4,
      cyclesCompleted: 0,
    })
  })

  it('resets the card and carries leftover stamps into the next cycle', () => {
    expect(
      rewardsCrossed({ from: 7, granted: 2, stampsRequired: 8, rewardPositions: [8] }),
    ).toEqual({
      unlocked: [8],
      finalCount: 1,
      cyclesCompleted: 1,
    })
  })

  it('handles a run that crosses several rewards', () => {
    expect(
      rewardsCrossed({ from: 0, granted: 8, stampsRequired: 8, rewardPositions: [4, 8] }),
    ).toEqual({
      unlocked: [4, 8],
      finalCount: 0,
      cyclesCompleted: 1,
    })
  })
})

describe('remote stamps', () => {
  it('obey the cooldown like a scan at the counter', () => {
    const decision = evaluateStamp({
      now,
      rules,
      source: 'remote',
      lastStampAt: new Date(now.getTime() - 10 * 60_000),
      stampsToday: 1,
      requestedCount: 1,
    })
    expect(decision).toMatchObject({ allowed: false, reason: 'cooldown' })
  })

  it('obey the daily cap and the per-scan maximum', () => {
    expect(
      evaluateStamp({
        now,
        rules,
        source: 'remote',
        lastStampAt: null,
        stampsToday: 3,
        requestedCount: 1,
      }),
    ).toMatchObject({ allowed: false, reason: 'daily_cap' })
    expect(
      evaluateStamp({
        now,
        rules,
        source: 'remote',
        lastStampAt: null,
        stampsToday: 0,
        requestedCount: 10,
      }),
    ).toEqual({ allowed: true, granted: 2 })
  })
})

describe('evaluateVoid', () => {
  const now = new Date('2026-10-19T15:00:00Z')
  const base = {
    now,
    windowMinutes: 5,
    isAdmin: false,
    actorUserId: 'cashier',
    event: {
      actorUserId: 'cashier',
      source: 'staff_scan' as const,
      createdAt: new Date('2026-10-19T14:58:00Z'),
      delta: 2,
    },
    isLatestEvent: true,
    unlockedRewardRedeemed: false,
  }

  it('lets the cashier undo their own scan straight away', () => {
    expect(evaluateVoid(base)).toEqual({ allowed: true })
  })

  it('refuses after the window', () => {
    const late = { ...base, event: { ...base.event, createdAt: new Date('2026-10-19T14:54:00Z') } }
    expect(evaluateVoid(late)).toEqual({ allowed: false, reason: 'too_late' })
  })

  it("refuses someone else's scan, unless an admin asks", () => {
    const other = { ...base, actorUserId: 'colleague' }
    expect(evaluateVoid(other)).toEqual({ allowed: false, reason: 'not_yours' })
    expect(evaluateVoid({ ...other, isAdmin: true })).toEqual({ allowed: true })
  })

  it('lets an admin undo an old scan', () => {
    const old = { ...base, isAdmin: true, event: { ...base.event, createdAt: new Date(0) } }
    expect(evaluateVoid(old)).toEqual({ allowed: true })
  })

  it('never rewrites history behind a later write', () => {
    expect(evaluateVoid({ ...base, isLatestEvent: false })).toEqual({
      allowed: false,
      reason: 'card_moved_on',
    })
    expect(evaluateVoid({ ...base, isAdmin: true, unlockedRewardRedeemed: true })).toEqual({
      allowed: false,
      reason: 'card_moved_on',
    })
  })

  it('only undoes scans, not manual corrections or kiosk stamps', () => {
    expect(evaluateVoid({ ...base, event: { ...base.event, source: 'manual' } })).toEqual({
      allowed: false,
      reason: 'not_a_scan',
    })
    expect(evaluateVoid({ ...base, event: { ...base.event, source: 'kiosk' } })).toEqual({
      allowed: false,
      reason: 'not_a_scan',
    })
  })
})
