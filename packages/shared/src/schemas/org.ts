import { z } from 'zod'
import { CURRENCIES } from '../plans'
import { roleSchema } from './auth'
import {
  countryCodeSchema,
  emailSchema,
  hexColorSchema,
  localeSchema,
  slugSchema,
  timezoneSchema,
} from './common'

export const BUSINESS_CATEGORIES = [
  'cafe',
  'restaurant',
  'bakery',
  'bar',
  'juice_bar',
  'ice_cream',
  'barber',
  'hair_salon',
  'nail_salon',
  'beauty',
  'spa',
  'fitness',
  'pet_grooming',
  'tattoo',
  'car_wash',
  'retail',
  'other',
] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]

export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
  'x',
  'youtube',
  'website',
  'menu',
  'booking',
] as const

export const socialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string().url().max(500),
  label: z.string().trim().max(40).optional(),
})

export const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: slugSchema.optional(),
  category: z.enum(BUSINESS_CATEGORIES).optional(),
  tagline: z.string().trim().max(120).optional(),
  about: z.string().trim().max(600).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  brandColor: hexColorSchema.optional(),
  country: countryCodeSchema.optional(),
  currency: z.enum(CURRENCIES).optional(),
  timezone: timezoneSchema.optional(),
  locale: localeSchema.optional(),
  socialLinks: z.array(socialLinkSchema).max(9).optional(),
  contactEmail: emailSchema.nullable().optional(),
  contactPhone: z.string().trim().max(30).nullable().optional(),
  /** Shown on the public business page and used by the review-request flow. */
  googlePlaceId: z.string().trim().max(120).nullable().optional(),
})
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).nullable().default(null),
  city: z.string().trim().max(80).nullable().default(null),
  timezone: timezoneSchema.optional(),
  phone: z.string().trim().max(30).nullable().default(null),
  googlePlaceId: z.string().trim().max(120).nullable().default(null),
  /** Weekly opening hours as `[{ day: 0-6, opens: 'HH:mm', closes: 'HH:mm' }]`. */
  hours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        opens: z.string().regex(/^\d{2}:\d{2}$/),
        closes: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(14)
    .default([]),
  isActive: z.boolean().default(true),
})
export type LocationInput = z.infer<typeof locationSchema>

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: roleSchema,
  /** Staff can be scoped to a single location. */
  locationId: z.string().uuid().nullable().default(null),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(400),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(12).max(200).optional(),
})

export const onboardingStateSchema = z.object({
  businessProfile: z.boolean(),
  firstCard: z.boolean(),
  cardPublished: z.boolean(),
  qrDownloaded: z.boolean(),
  firstCustomer: z.boolean(),
  firstStamp: z.boolean(),
})
export type OnboardingState = z.infer<typeof onboardingStateSchema>
