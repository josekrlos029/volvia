import {
  type Database,
  and,
  authIdentities,
  authTokens,
  eq,
  isNull,
  locations,
  memberships,
  organizations,
  sql,
  users,
} from '@volvia/db'
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  type Locale,
  MAGIC_LINK_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
  type RegisterInput,
  type SessionUser,
} from '@volvia/shared'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { AppError } from '../../lib/errors'
import { hashPassword, verifyPassword } from '../../lib/passwords'
import { hashToken, randomToken, slugify } from '../../lib/tokens'

export interface AuthDeps {
  db: Database
}

/** Slugs are public URLs, so collisions are resolved deterministically at signup. */
async function uniqueOrgSlug(db: Database, name: string): Promise<string> {
  const base = slugify(name) || 'negocio'
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  return `${base}-${randomToken(4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`
}

export async function findUserByEmail(db: Database, email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1)
  return user ?? null
}

/**
 * Registers the person *and* their business in one transaction: a Volvia account
 * without an organisation is meaningless, and a half-created signup is worse than none.
 */
export async function registerOwner(
  db: Database,
  input: RegisterInput,
  meta: { ip: string; userAgent: string },
) {
  const existing = await findUserByEmail(db, input.email)
  if (existing) throw new AppError('EMAIL_TAKEN', { message: 'that email already has an account' })

  const passwordHash = await hashPassword(input.password)
  const slug = await uniqueOrgSlug(db, input.businessName)

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        locale: input.locale ?? 'es',
        marketingOptIn: input.marketingOptIn,
      })
      .returning()

    const [org] = await tx
      .insert(organizations)
      .values({
        name: input.businessName,
        slug,
        country: input.country ?? 'CO',
        currency: (input.country ?? 'CO') === 'CO' ? 'cop' : 'usd',
        timezone: input.timezone ?? 'America/Bogota',
        locale: input.locale ?? 'es',
        contactEmail: input.email.toLowerCase(),
        onboarding: { businessProfile: false, firstCard: false, cardPublished: false },
      })
      .returning()

    await tx.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' })

    // Every business starts with one location; multi-location is a plan feature.
    await tx.insert(locations).values({
      orgId: org!.id,
      name: input.businessName,
      timezone: input.timezone ?? 'America/Bogota',
    })

    await audit(tx, {
      orgId: org!.id,
      actorUserId: user!.id,
      action: AUDIT_ACTIONS.authRegister,
      targetType: 'organization',
      targetId: org!.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return { user: user!, org: org! }
  })
}

export async function verifyCredentials(db: Database, email: string, password: string) {
  const user = await findUserByEmail(db, email)
  // Always run a hash comparison so a missing account and a wrong password take the
  // same time — otherwise the endpoint enumerates registered emails.
  const digest =
    user?.passwordHash ??
    '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  const ok = await verifyPassword(password, digest)
  if (!user || !user.passwordHash || !ok) {
    throw new AppError('INVALID_CREDENTIALS', { message: 'email or password is incorrect' })
  }
  return user
}

export type TokenPurpose = 'magic_link' | 'email_verification' | 'password_reset' | 'invite'

const TTL_BY_PURPOSE: Record<TokenPurpose, number> = {
  magic_link: MAGIC_LINK_TTL_SECONDS,
  email_verification: EMAIL_VERIFICATION_TTL_SECONDS,
  password_reset: PASSWORD_RESET_TTL_SECONDS,
  invite: 7 * 24 * 60 * 60,
}

/** Issues a single-use token and stores only its hash. Returns the plaintext once. */
export async function issueAuthToken(
  db: Database,
  input: {
    purpose: TokenPurpose
    userId?: string | null
    email?: string | null
    payload?: Record<string, unknown>
    ip?: string
  },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + TTL_BY_PURPOSE[input.purpose] * 1000)

  await db.insert(authTokens).values({
    tokenHash: hashToken(token),
    purpose: input.purpose,
    userId: input.userId ?? null,
    email: input.email?.toLowerCase() ?? null,
    payload: input.payload ?? {},
    expiresAt,
    createdIp: input.ip ?? null,
  })

  return { token, expiresAt }
}

/** Consumes a token atomically: the same link can never be used twice. */
export async function consumeAuthToken(db: Database, token: string, purpose: TokenPurpose) {
  const hash = hashToken(token)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.tokenHash, hash), eq(authTokens.purpose, purpose)))
      .for('update')
      .limit(1)

    if (!row) throw new AppError('TOKEN_EXPIRED', { message: 'link is invalid' })
    if (row.consumedAt) throw new AppError('TOKEN_EXPIRED', { message: 'link was already used' })
    if (row.expiresAt.getTime() < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', { message: 'link has expired' })
    }

    await tx.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, row.id))
    return row
  })
}

export async function markEmailVerified(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId))
}

/**
 * Sets a new password and bumps `tokenVersion`, which invalidates every access token
 * already issued for this user. Callers should also revoke the Redis sessions.
 */
export async function setPassword(db: Database, userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password)
  await db
    .update(users)
    .set({
      passwordHash,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function linkGoogleIdentity(
  db: Database,
  input: { userId: string; providerUserId: string; profile: Record<string, unknown> },
): Promise<void> {
  await db
    .insert(authIdentities)
    .values({
      userId: input.userId,
      provider: 'google',
      providerUserId: input.providerUserId,
      profile: input.profile,
    })
    .onConflictDoNothing()
}

export async function findUserByGoogleId(db: Database, providerUserId: string) {
  const [row] = await db
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(
      and(eq(authIdentities.provider, 'google'), eq(authIdentities.providerUserId, providerUserId)),
    )
    .limit(1)
  return row?.user ?? null
}

/** The `/auth/me` payload: identity plus every organisation the user can act in. */
export async function buildSessionUser(db: Database, userId: string): Promise<SessionUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new AppError('UNAUTHENTICATED', { message: 'account unavailable' })

  const rows = await db
    .select({
      orgId: memberships.orgId,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      role: memberships.role,
      locationId: memberships.locationId,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, userId), isNull(organizations.deletedAt)))

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale as Locale,
    emailVerified: Boolean(user.emailVerifiedAt),
    memberships: rows,
  }
}
