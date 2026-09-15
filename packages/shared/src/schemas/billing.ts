import { z } from 'zod'
import { CURRENCIES, PLAN_IDS } from '../plans'

export const BILLING_INTERVALS = ['monthly', 'yearly'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

export const PAYMENT_PROVIDERS = ['stripe', 'wompi'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const SUBSCRIPTION_STATUSES = [
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const checkoutSchema = z.object({
  plan: z.enum(PLAN_IDS).refine((p) => p !== 'free', 'cannot_checkout_free'),
  interval: z.enum(BILLING_INTERVALS).default('monthly'),
  /** Extra locations beyond the plan's included count (Multi only). */
  extraLocations: z.number().int().min(0).max(50).default(0),
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
  currency: z.enum(CURRENCIES).optional(),
  successPath: z.string().max(200).optional(),
  cancelPath: z.string().max(200).optional(),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>

export const subscriptionViewSchema = z.object({
  plan: z.enum(PLAN_IDS),
  status: z.enum(SUBSCRIPTION_STATUSES),
  interval: z.enum(BILLING_INTERVALS).nullable(),
  provider: z.enum(PAYMENT_PROVIDERS).nullable(),
  currency: z.enum(CURRENCIES),
  currentPeriodEnd: z.coerce.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  extraLocations: z.number().int(),
  /** Premium features stay on until the trial customer gate is crossed. */
  trialCustomersRemaining: z.number().int().nullable(),
})
export type SubscriptionView = z.infer<typeof subscriptionViewSchema>
