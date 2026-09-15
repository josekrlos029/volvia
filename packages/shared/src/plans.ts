/**
 * Single source of truth for what each Volvia plan unlocks.
 *
 * Consumed by:
 *  - the API's `requireFeature` / `requireWithinLimit` guards
 *  - the admin dashboard's upgrade prompts and disabled states
 *  - the public pricing page table
 *
 * Nothing else may hardcode plan capabilities.
 */

export const PLAN_IDS = ['free', 'pro', 'business', 'multi'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export const FEATURE_KEYS = [
  'wallet_passes',
  'custom_branding',
  'custom_stamp_icons',
  'premium_card_display',
  'customer_contact_details',
  'birthday_automation',
  'customer_messages',
  'campaigns',
  'surveys',
  'google_review_requests',
  'full_analytics',
  'csv_export',
  'team_accounts',
  'kiosk_mode',
  'multi_location',
  'priority_support',
] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const LIMIT_KEYS = [
  'locations',
  'activeCards',
  'staffSeats',
  'campaignsPerMonth',
  'messagesPerMonth',
  'customers',
] as const
export type LimitKey = (typeof LIMIT_KEYS)[number]

/** `null` means unlimited. Kept JSON-safe on purpose (Infinity does not survive JSON). */
export type LimitValue = number | null

export type PlanLimits = Record<LimitKey, LimitValue>

export const CURRENCIES = ['usd', 'cop'] as const
export type Currency = (typeof CURRENCIES)[number]

export interface PlanPrice {
  /** Minor units (cents for USD, whole pesos * 100 for COP). */
  monthly: number
  /** Yearly total. Two months free versus paying monthly. */
  yearly: number
}

export interface PlanDefinition {
  id: PlanId
  /** i18n key, resolved by whichever surface renders it. */
  nameKey: string
  order: number
  features: readonly FeatureKey[]
  limits: PlanLimits
  price: Record<Currency, PlanPrice>
  /** Price of each location beyond `limits.locations`, `null` when not purchasable. */
  extraLocationPrice: Record<Currency, number> | null
}

const UNLIMITED = null

/**
 * Premium features stay open for a new business until this many customers have
 * joined one of its cards — after that the plan's real entitlements apply.
 */
export const PREMIUM_TRIAL_CUSTOMER_LIMIT = 30

const PRO_FEATURES = [
  'wallet_passes',
  'custom_branding',
  'custom_stamp_icons',
  'premium_card_display',
  'customer_contact_details',
] as const satisfies readonly FeatureKey[]

const BUSINESS_FEATURES = [
  ...PRO_FEATURES,
  'birthday_automation',
  'customer_messages',
  'campaigns',
  'surveys',
  'google_review_requests',
  'full_analytics',
  'csv_export',
  'team_accounts',
  'kiosk_mode',
] as const satisfies readonly FeatureKey[]

const MULTI_FEATURES = [
  ...BUSINESS_FEATURES,
  'multi_location',
  'priority_support',
] as const satisfies readonly FeatureKey[]

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    nameKey: 'plans.free.name',
    order: 0,
    features: [],
    limits: {
      locations: 1,
      activeCards: 1,
      staffSeats: 1,
      campaignsPerMonth: 0,
      messagesPerMonth: 0,
      customers: UNLIMITED,
    },
    price: { usd: { monthly: 0, yearly: 0 }, cop: { monthly: 0, yearly: 0 } },
    extraLocationPrice: null,
  },
  pro: {
    id: 'pro',
    nameKey: 'plans.pro.name',
    order: 1,
    features: PRO_FEATURES,
    limits: {
      locations: 1,
      activeCards: UNLIMITED,
      staffSeats: 1,
      campaignsPerMonth: 0,
      messagesPerMonth: 0,
      customers: UNLIMITED,
    },
    price: {
      usd: { monthly: 1900, yearly: 19_000 },
      cop: { monthly: 7_900_000, yearly: 79_000_000 },
    },
    extraLocationPrice: null,
  },
  business: {
    id: 'business',
    nameKey: 'plans.business.name',
    order: 2,
    features: BUSINESS_FEATURES,
    limits: {
      locations: 1,
      activeCards: UNLIMITED,
      staffSeats: UNLIMITED,
      campaignsPerMonth: 4,
      messagesPerMonth: 4,
      customers: UNLIMITED,
    },
    price: {
      usd: { monthly: 3900, yearly: 39_000 },
      cop: { monthly: 15_900_000, yearly: 159_000_000 },
    },
    extraLocationPrice: null,
  },
  multi: {
    id: 'multi',
    nameKey: 'plans.multi.name',
    order: 3,
    features: MULTI_FEATURES,
    limits: {
      locations: 3,
      activeCards: UNLIMITED,
      staffSeats: UNLIMITED,
      campaignsPerMonth: 8,
      messagesPerMonth: 8,
      customers: UNLIMITED,
    },
    price: {
      usd: { monthly: 9900, yearly: 99_000 },
      cop: { monthly: 39_900_000, yearly: 399_000_000 },
    },
    extraLocationPrice: { usd: 2900, cop: 11_900_000 },
  },
}

export const PLAN_LIST: readonly PlanDefinition[] = PLAN_IDS.map((id) => PLANS[id])

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value)
}

export function planHasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return PLANS[plan].features.includes(feature)
}

export function planLimit(plan: PlanId, key: LimitKey): LimitValue {
  return PLANS[plan].limits[key]
}

/** `true` when `current` (the count *before* adding one) still leaves room. */
export function withinLimit(limit: LimitValue, current: number, adding = 1): boolean {
  if (limit === null) return true
  return current + adding <= limit
}

/** The cheapest plan that includes `feature`, for "upgrade to X" prompts. */
export function minimumPlanFor(feature: FeatureKey): PlanId | null {
  const match = PLAN_LIST.find((plan) => plan.features.includes(feature))
  return match?.id ?? null
}

/** The cheapest plan whose `key` limit covers `required`. */
export function minimumPlanForLimit(key: LimitKey, required: number): PlanId | null {
  const match = PLAN_LIST.find((plan) => withinLimit(plan.limits[key], required - 1))
  return match?.id ?? null
}

export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return PLANS[to].order > PLANS[from].order
}
