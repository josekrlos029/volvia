import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants'
import { LOCALES } from '../locales'

export const uuidSchema = z.string().uuid()
export const emailSchema = z.string().trim().toLowerCase().email().max(254)

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug_invalid')

export const publicTokenSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'token_invalid')

export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'color_invalid')

export const localeSchema = z.enum(LOCALES)

/** IANA timezone; validated against the runtime's tz database rather than a static list. */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz })
        return true
      } catch {
        return false
      }
    },
    { message: 'timezone_invalid' },
  )

export const countryCodeSchema = z.string().length(2).toUpperCase()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})
export type Pagination = z.infer<typeof paginationSchema>

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    hasMore: z.boolean(),
  })
}

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc')

/** Birthday without a year — we never ask for age. */
export const birthdaySchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
})
export type Birthday = z.infer<typeof birthdaySchema>

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})
