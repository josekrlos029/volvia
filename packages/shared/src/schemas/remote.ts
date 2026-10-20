import { z } from 'zod'
import { documentNumberSchema } from './common'
import { stampResultDesignSchema } from './loyalty'

/**
 * Remote stamping: a delivery business stamps a customer it never sees, from the
 * browser extension, by finding their card with what the order carries — the cédula,
 * the phone or the name.
 */

export const remoteLookupQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
})
export type RemoteLookupQuery = z.infer<typeof remoteLookupQuerySchema>

/** One row per card, not per customer: someone on two programmes appears twice. */
export const remoteLookupItemSchema = z.object({
  cardToken: z.string(),
  customerCardId: z.string().uuid(),
  customer: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    /** Last four digits only — enough to confirm, not enough to leak. */
    phoneTail: z.string().nullable(),
    documentTail: z.string().nullable(),
  }),
  stampsCount: z.number().int(),
  stampsRequired: z.number().int(),
  pendingRewards: z.number().int(),
  lastStampAt: z.coerce.date().nullable(),
  /** The card asks for a cédula and this customer has none yet: offer to save it. */
  missingDocument: z.boolean(),
  design: stampResultDesignSchema,
})
export type RemoteLookupItem = z.infer<typeof remoteLookupItemSchema>

export const remoteLookupResultSchema = z.object({
  items: z.array(remoteLookupItemSchema),
  /** Where a customer who has no card yet signs up, to paste into the chat. */
  joinUrl: z.string().nullable(),
})
export type RemoteLookupResult = z.infer<typeof remoteLookupResultSchema>

/** What the extension needs to know before showing the search box. */
export const remoteStatusSchema = z.object({
  enabled: z.boolean(),
  requireOrder: z.boolean(),
  businessName: z.string(),
  logoUrl: z.string().nullable(),
})
export type RemoteStatus = z.infer<typeof remoteStatusSchema>

export const saveDocumentSchema = z.object({ documentNumber: documentNumberSchema })

/**
 * Connecting the extension for someone who signs in with Google or Apple: the
 * extension shows a code, the person approves it in the dashboard where they are
 * already signed in, and the extension collects its tokens once.
 */
export const deviceStartResultSchema = z.object({
  /** Shown to the person, e.g. "KQ7R-M2XW". */
  userCode: z.string(),
  /** Secret the extension polls with; never shown. */
  pollToken: z.string(),
  expiresIn: z.number().int(),
  interval: z.number().int(),
})
export type DeviceStartResult = z.infer<typeof deviceStartResultSchema>

export const deviceApproveSchema = z.object({
  userCode: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^0-9A-Za-z]/g, '').toUpperCase())
    .pipe(z.string().length(8)),
})

export const devicePollSchema = z.object({ pollToken: z.string().min(20).max(200) })
