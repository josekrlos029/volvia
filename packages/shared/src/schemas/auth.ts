import { z } from 'zod'
import { emailSchema, localeSchema } from './common'

/**
 * Password policy: length over composition rules. 12+ characters, and we reject
 * the handful of obvious strings rather than forcing symbol soup.
 */
export const passwordSchema = z
  .string()
  .min(12, 'password_too_short')
  .max(200)
  .refine((value) => !/^(?:password|contrasena|contraseña|12345678|qwerty)/i.test(value), {
    message: 'password_too_common',
  })

export const SOCIAL_PROVIDERS = ['google', 'apple'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]
export const socialProviderSchema = z.enum(SOCIAL_PROVIDERS)

/**
 * A business is created with a password *or* with a social identity that has just
 * proved who the person is. `socialToken` is the single-use token the API issued when
 * Google or Apple came back with an address that had no account yet.
 */
export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema.optional(),
    socialToken: z.string().min(16).max(400).optional(),
    name: z.string().trim().min(2).max(120),
    businessName: z.string().trim().min(2).max(120),
    locale: localeSchema.optional(),
    country: z.string().length(2).optional(),
    timezone: z.string().optional(),
    marketingOptIn: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.password) || Boolean(value.socialToken), {
    path: ['password'],
    message: 'password_required',
  })
export type RegisterInput = z.infer<typeof registerSchema>

/** What a native app sends after the platform sign-in sheet: the provider's ID token. */
export const nativeAppleSignInSchema = z.object({
  identityToken: z.string().min(16).max(4000),
  /** Apple only hands the name to the app, and only the first time. */
  name: z.string().trim().max(120).optional(),
})
export const nativeGoogleSignInSchema = z.object({
  idToken: z.string().min(16).max(4000),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
})

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  locale: localeSchema.optional(),
  /** Where to land after the link is consumed; validated against an allowlist server-side. */
  redirectTo: z.string().max(300).optional(),
})

export const tokenConsumeSchema = z.object({ token: z.string().min(16).max(400) })

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  locale: localeSchema.optional(),
})

export const passwordResetSchema = z.object({
  token: z.string().min(16).max(400),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
})

export const ROLES = ['owner', 'admin', 'staff'] as const
export type Role = (typeof ROLES)[number]
export const roleSchema = z.enum(ROLES)

/** Ordered by privilege so guards can compare numerically. */
export const ROLE_RANK: Record<Role, number> = { staff: 0, admin: 1, owner: 2 }

export function roleAtLeast(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required]
}

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  locale: localeSchema,
  emailVerified: z.boolean(),
  isSuperadmin: z.boolean(),
  memberships: z.array(
    z.object({
      orgId: z.string().uuid(),
      orgName: z.string(),
      orgSlug: z.string(),
      role: roleSchema,
      locationId: z.string().uuid().nullable(),
    }),
  ),
})
export type SessionUser = z.infer<typeof sessionUserSchema>
