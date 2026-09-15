import { describe, expect, it } from 'vitest'
import { evaluateStamp, rewardsCrossed } from '../src/modules/loyalty/rules'

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
