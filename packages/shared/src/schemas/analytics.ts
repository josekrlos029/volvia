import { z } from 'zod'

export const analyticsRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Convenience presets the dashboard uses; resolved server-side in the org timezone. */
  preset: z.enum(['7d', '30d', '90d', '12m', 'custom']).default('30d'),
  cardId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
})
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>

export const overviewSchema = z.object({
  customers: z.object({ total: z.number(), new: z.number(), changePct: z.number().nullable() }),
  stamps: z.object({ total: z.number(), changePct: z.number().nullable() }),
  rewards: z.object({ unlocked: z.number(), redeemed: z.number(), redemptionRate: z.number() }),
  repeatRate: z.number(),
  averageVisitsPerCustomer: z.number(),
  /** Median days between a customer's visits — the single best health signal. */
  medianDaysBetweenVisits: z.number().nullable(),
  activeCards: z.number(),
})
export type Overview = z.infer<typeof overviewSchema>

export const timeseriesPointSchema = z.object({
  date: z.string(),
  stamps: z.number(),
  joins: z.number(),
  rewardsUnlocked: z.number(),
  rewardsRedeemed: z.number(),
})

export const busiestSchema = z.object({
  byWeekday: z.array(z.object({ weekday: z.number().int().min(0).max(6), stamps: z.number() })),
  byHour: z.array(z.object({ hour: z.number().int().min(0).max(23), stamps: z.number() })),
})

/** Cohort retention: share of each join-month cohort still stamping N months later. */
export const retentionSchema = z.object({
  cohorts: z.array(
    z.object({
      cohort: z.string(),
      size: z.number(),
      values: z.array(z.number().nullable()),
    }),
  ),
})
