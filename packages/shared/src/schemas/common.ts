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

/**
 * A phone number as people type it: digits with optional +, spaces, dashes and
 * brackets. Stored normalised to digits with a leading + when one was given, so
 * "300 123 4567" and "3001234567" are the same customer.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9(][0-9 ()./-]{5,24}$/, 'phone_invalid')
  .transform((value) => {
    const digits = value.replace(/[^0-9]/g, '')
    return value.startsWith('+') ? `+${digits}` : digits
  })
  .pipe(z.string().min(7).max(16))

/**
 * A national ID (cédula) as people type it: dots, spaces and dashes are dropped and
 * letters upper-cased, so "1.065.123.456" and "1065123456" are the same customer.
 */
export const documentNumberSchema = z
  .string()
  .trim()
  .max(30)
  .transform((value) => value.replace(/[^0-9A-Za-z]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[0-9A-Z]{5,20}$/, 'document_invalid'))

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
