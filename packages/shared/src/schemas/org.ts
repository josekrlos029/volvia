import { z } from 'zod'
import { CURRENCIES } from '../plans'
import { DEFAULT_VISIT_FREQUENCY, VISIT_FREQUENCIES } from '../segments'
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
  'telegram',
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

const clockSchema = z.string().regex(/^\d{2}:\d{2}$/)

/** When a business may reach its customers' phones, unless it says otherwise: never past midnight. */
export const DEFAULT_NOTIFICATION_HOURS = { from: '08:00', to: '23:59' }

export const notificationHoursSchema = z
  .object({ from: clockSchema, to: clockSchema })
  .nullable()
  .default(DEFAULT_NOTIFICATION_HOURS)
export type NotificationHours = z.infer<typeof notificationHoursSchema>

/**
 * Everything that is a preference rather than an identity, kept in one jsonb column so
 * adding a setting never needs a migration.
 */
export const orgSettingsSchema = z.object({
  /**
   * The window, in the business's own timezone, inside which messages and campaign
   * pushes may reach a phone. Anything due outside it waits for the next opening.
   * Null means any time, which a bar may genuinely want.
   */
  notificationHours: notificationHoursSchema,
  /** How often a good customer is expected back. Drives the community segments. */
  visitFrequency: z.enum(VISIT_FREQUENCIES).default(DEFAULT_VISIT_FREQUENCY),
  /** Legal entity shown on the public page and in the privacy notice. */
  legalName: z.string().trim().max(160).default(''),
  taxId: z.string().trim().max(40).default(''),
  legalAddress: z.string().trim().max(200).default(''),
  privacyEmail: z.string().trim().max(160).default(''),
  /** Stops asking customers for a public review without unlinking the Google listing. */
  reviewRequestsPaused: z.boolean().default(false),
  /** What the button on the public page says. Empty means the default wording. */
  pageCtaLabel: z.string().trim().max(40).default(''),
})
export type OrgSettings = z.infer<typeof orgSettingsSchema>

export const DEFAULT_ORG_SETTINGS: OrgSettings = orgSettingsSchema.parse({})

export const updateOrgSchema = z.object({
  settings: orgSettingsSchema.partial().optional(),
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

const locationFieldsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).nullable().default(null),
  city: z.string().trim().max(80).nullable().default(null),
  timezone: timezoneSchema.optional(),
  phone: z.string().trim().max(30).nullable().default(null),
  googlePlaceId: z.string().trim().max(120).nullable().default(null),
  /** WGS84 decimal degrees. Feeds the wallet "you are near the shop" relevance. */
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
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

/**
 * Half a coordinate is worse than none: the pass would point at the equator. On a
 * partial update both keys must travel together too, otherwise `{ latitude: null }`
 * alone would leave a stale longitude behind.
 */
const coordinatesTravelTogether = (value: {
  latitude?: number | null
  longitude?: number | null
}): boolean =>
  'latitude' in value === 'longitude' in value &&
  (value.latitude == null) === (value.longitude == null)

const COORDINATES_MESSAGE = {
  message: 'latitude and longitude must be set together',
  path: ['longitude'],
}

export const locationSchema = locationFieldsSchema.refine(
  coordinatesTravelTogether,
  COORDINATES_MESSAGE,
)
export type LocationInput = z.infer<typeof locationSchema>

export const updateLocationSchema = locationFieldsSchema
  .partial()
  .refine(coordinatesTravelTogether, COORDINATES_MESSAGE)
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>

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

/** What the marketing site's contact form sends. */
export const CONTACT_TOPICS = ['question', 'demo', 'help', 'press'] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  businessName: z.string().trim().max(120).default(''),
  topic: z.enum(CONTACT_TOPICS).default('question'),
  message: z.string().trim().min(10).max(2000),
  locale: localeSchema.default('es'),
  /**
   * Must stay empty. A field no person can see, filled in only by the scripts that
   * submit every form they find.
   */
  website: z.string().max(200).default(''),
})
export type ContactRequest = z.infer<typeof contactRequestSchema>
