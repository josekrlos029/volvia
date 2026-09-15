import {
  type FeatureKey,
  type LimitKey,
  type LimitValue,
  PLANS,
  PREMIUM_TRIAL_CUSTOMER_LIMIT,
  type PlanId,
  minimumPlanFor,
  minimumPlanForLimit,
  withinLimit,
} from './plans'

/**
 * What a specific organisation can do right now.
 *
 * A brand-new business gets every premium feature until its cards have gathered
 * `PREMIUM_TRIAL_CUSTOMER_LIMIT` customers — that is the trial, and it is based on
 * traction rather than a countdown, so a business that sets up slowly is not punished.
 */
export interface OrgEntitlementInput {
  plan: PlanId
  /** `active` and `trialing` grant the plan; anything else falls back to free. */
  subscriptionActive: boolean
  totalCustomers: number
  /** Locations bought on top of the plan's included count. */
  extraLocations: number
}

export interface Entitlements {
  plan: PlanId
  /** The plan actually being enforced once subscription status is considered. */
  effectivePlan: PlanId
  inPremiumTrial: boolean
  trialCustomersRemaining: number | null
  has(feature: FeatureKey): boolean
  limit(key: LimitKey): LimitValue
  allows(key: LimitKey, current: number, adding?: number): boolean
  upgradeForFeature(feature: FeatureKey): PlanId | null
  upgradeForLimit(key: LimitKey, required: number): PlanId | null
}

export function resolveEntitlements(input: OrgEntitlementInput): Entitlements {
  const effectivePlan: PlanId = input.subscriptionActive ? input.plan : 'free'
  const inPremiumTrial =
    effectivePlan === 'free' && input.totalCustomers < PREMIUM_TRIAL_CUSTOMER_LIMIT
  const trialCustomersRemaining = inPremiumTrial
    ? PREMIUM_TRIAL_CUSTOMER_LIMIT - input.totalCustomers
    : null

  const limitFor = (key: LimitKey): LimitValue => {
    const base = PLANS[effectivePlan].limits[key]
    if (key === 'locations' && base !== null) return base + input.extraLocations
    // During the trial the business can try everything, but hard structural limits
    // (locations, seats) stay at the plan's real value so nothing breaks on downgrade.
    if (
      inPremiumTrial &&
      (key === 'activeCards' || key === 'campaignsPerMonth' || key === 'messagesPerMonth')
    ) {
      return PLANS.business.limits[key]
    }
    return base
  }

  return {
    plan: input.plan,
    effectivePlan,
    inPremiumTrial,
    trialCustomersRemaining,
    has: (feature) => inPremiumTrial || PLANS[effectivePlan].features.includes(feature),
    limit: limitFor,
    allows: (key, current, adding = 1) => withinLimit(limitFor(key), current, adding),
    upgradeForFeature: (feature) => minimumPlanFor(feature),
    upgradeForLimit: (key, required) => minimumPlanForLimit(key, required),
  }
}
