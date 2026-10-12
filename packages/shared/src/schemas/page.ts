import { z } from 'zod'
import { MAX_PAGE_ITEMS_PER_SECTION, MAX_PAGE_SECTIONS_PER_KIND } from '../constants'

export const PAGE_SECTION_KINDS = [
  'menu',
  'products',
  'services',
  'portfolio',
  'updates',
  'events',
] as const
export type PageSectionKindInput = (typeof PAGE_SECTION_KINDS)[number]

const optionalUrl = z.string().trim().url().max(500).nullable().default(null)

/** One thing on the page. Fields a kind does not use are simply left null. */
export const pageItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  priceAmount: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  imageUrl: optionalUrl,
  durationMinutes: z.number().int().min(5).max(480).nullable().default(null),
  startsAt: z.coerce.date().nullable().default(null),
  endsAt: z.coerce.date().nullable().default(null),
  publishedAt: z.coerce.date().nullable().default(null),
  buttonLabel: z.string().trim().max(30).nullable().default(null),
  buttonUrl: optionalUrl,
  askVia: z.enum(['whatsapp', 'sms']).nullable().default(null),
  isActive: z.boolean().default(true),
})
export type PageItemInput = z.infer<typeof pageItemSchema>

export const pageSectionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(60).default(''),
  description: z.string().trim().max(200).default(''),
  isActive: z.boolean().default(true),
  items: z.array(pageItemSchema).max(MAX_PAGE_ITEMS_PER_SECTION).default([]),
})
export type PageSectionInput = z.infer<typeof pageSectionSchema>

/** Everything of one kind, saved at once: the whole menu, all the products. */
export const replacePageModuleSchema = z.object({
  sections: z.array(pageSectionSchema).max(MAX_PAGE_SECTIONS_PER_KIND),
})
export type ReplacePageModuleInput = z.infer<typeof replacePageModuleSchema>

export const pageKindParamsSchema = z.object({ kind: z.enum(PAGE_SECTION_KINDS) })
