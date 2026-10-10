import { describe, expect, it } from 'vitest'
import {
  PLANS,
  PREMIUM_TRIAL_CUSTOMER_LIMIT,
  minimumPlanFor,
  resolveEntitlements,
} from '../src/index'

const base = {
  plan: 'free' as const,
  subscriptionActive: false,
  totalCustomers: 0,
  extraLocations: 0,
}

describe('entitlements', () => {
  it('opens premium features while under the customer trial gate', () => {
    const e = resolveEntitlements(base)
    expect(e.inPremiumTrial).toBe(true)
    expect(e.has('surveys')).toBe(true)
    expect(e.has('wallet_passes')).toBe(true)
    expect(e.trialCustomersRemaining).toBe(PREMIUM_TRIAL_CUSTOMER_LIMIT)
  })

  it('closes premium features once the gate is crossed', () => {
    const e = resolveEntitlements({ ...base, totalCustomers: PREMIUM_TRIAL_CUSTOMER_LIMIT })
    expect(e.inPremiumTrial).toBe(false)
    expect(e.has('surveys')).toBe(false)
    expect(e.has('wallet_passes')).toBe(false)
    expect(e.trialCustomersRemaining).toBeNull()
  })

  it('falls back to free when the subscription is not active', () => {
    const e = resolveEntitlements({
      plan: 'business',
      subscriptionActive: false,
      totalCustomers: 500,
      extraLocations: 0,
    })
    expect(e.effectivePlan).toBe('free')
    expect(e.has('kiosk_mode')).toBe(false)
  })

  it('never lets the trial raise structural limits', () => {
    const e = resolveEntitlements(base)
    expect(e.limit('locations')).toBe(1)
    expect(e.limit('staffSeats')).toBe(1)
  })

  it('adds purchased locations on top of the plan allowance', () => {
    const e = resolveEntitlements({
      plan: 'multi',
      subscriptionActive: true,
      totalCustomers: 100,
      extraLocations: 2,
    })
    expect(e.limit('locations')).toBe(PLANS.multi.limits.locations! + 2)
    expect(e.allows('locations', 4)).toBe(true)
    expect(e.allows('locations', 5)).toBe(false)
  })

  it('treats unlimited as always allowed', () => {
    const e = resolveEntitlements({
      plan: 'pro',
      subscriptionActive: true,
      totalCustomers: 10_000,
      extraLocations: 0,
    })
    expect(e.limit('customers')).toBeNull()
    expect(e.allows('customers', 999_999)).toBe(true)
  })

  it('points at the cheapest plan that unlocks a feature', () => {
    expect(minimumPlanFor('wallet_passes')).toBe('pro')
    expect(minimumPlanFor('kiosk_mode')).toBe('business')
    expect(minimumPlanFor('multi_location')).toBe('multi')
  })
})

describe('custom segments', () => {
  it('are a business feature, while the suggested ones need no plan at all', () => {
    expect(minimumPlanFor('custom_segments')).toBe('business')
    expect(PLANS.pro.features).not.toContain('custom_segments')
    expect(PLANS.business.features).toContain('custom_segments')
  })
})
