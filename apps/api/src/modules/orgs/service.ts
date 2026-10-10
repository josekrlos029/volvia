import {
  type Database,
  and,
  count,
  eq,
  invites,
  isNull,
  locations,
  memberships,
  organizations,
  profileQuestions,
  users,
} from '@volvia/db'
import {
  type Entitlements,
  INVITE_TTL_SECONDS,
  type LocationInput,
  type ProfileQuestionInput,
  type Role,
  type UpdateLocationInput,
  type UpdateOrgInput,
} from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { enqueueWalletUpdatesForOrg } from '../../lib/outbox'
import { hashPassword } from '../../lib/passwords'
import { hashToken, randomToken, slugify } from '../../lib/tokens'
import { assertWithinLimit } from '../../plugins/auth'

export async function getOrg(db: Database, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
  if (!org) throw new AppError('ORG_NOT_FOUND', { message: 'organization not found' })
  return org
}

/** Slug changes break existing public links, so collisions are rejected, not renamed. */
export async function updateOrg(db: Database, orgId: string, input: UpdateOrgInput) {
  if (input.slug) {
    const [taken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, input.slug))
      .limit(1)
    if (taken && taken.id !== orgId) {
      throw new AppError('CONFLICT', { message: 'that address is already taken' })
    }
  }

  // Settings arrive as a patch — saving one preference must not wipe the rest.
  const { settings, ...fields } = input
  const merged = settings
    ? { settings: { ...(await getOrg(db, orgId)).settings, ...settings } }
    : {}

  const [updated] = await db
    .update(organizations)
    .set({ ...fields, ...merged, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning()

  if (!updated) throw new AppError('ORG_NOT_FOUND', { message: 'organization not found' })
  return updated
}

export async function suggestSlug(db: Database, name: string): Promise<string> {
  const base = slugify(name) || 'negocio'
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  return `${base}-${randomToken(3)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`
}

// ── Locations ────────────────────────────────────────────────────────────────

export async function listLocations(db: Database, orgId: string) {
  return db
    .select()
    .from(locations)
    .where(and(eq(locations.orgId, orgId), isNull(locations.deletedAt)))
    .orderBy(locations.createdAt)
}

export async function createLocation(
  db: Database,
  input: { orgId: string; entitlements: Entitlements; data: LocationInput; timezone: string },
) {
  const [existing] = await db
    .select({ value: count() })
    .from(locations)
    .where(and(eq(locations.orgId, input.orgId), isNull(locations.deletedAt)))

  assertWithinLimit(input.entitlements, 'locations', existing?.value ?? 0)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(locations)
      .values({
        orgId: input.orgId,
        name: input.data.name,
        address: input.data.address,
        city: input.data.city,
        phone: input.data.phone,
        // Falls back to the organisation's timezone so daily rollups stay consistent.
        timezone: input.data.timezone ?? input.timezone,
        googlePlaceId: input.data.googlePlaceId,
        latitude: input.data.latitude,
        longitude: input.data.longitude,
        hours: input.data.hours,
        isActive: input.data.isActive,
      })
      .returning()

    // A new pin changes every pass of the business, so each installed one is refreshed.
    if (isPassRelevant(created!)) {
      await enqueueWalletUpdatesForOrg(tx, input.orgId, { reason: 'location' })
    }
    return created!
  })
}

/** Whether a location contributes a point to the wallet passes of the business. */
function isPassRelevant(location: {
  latitude: number | null
  longitude: number | null
  isActive: boolean
  deletedAt: Date | null
}): boolean {
  return (
    location.isActive &&
    location.deletedAt === null &&
    location.latitude !== null &&
    location.longitude !== null
  )
}

export async function updateLocation(
  db: Database,
  orgId: string,
  locationId: string,
  data: UpdateLocationInput,
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.orgId, orgId)))
      .for('update')
      .limit(1)
    if (!before) throw new AppError('NOT_FOUND', { message: 'location not found' })

    const [updated] = await tx
      .update(locations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(locations.id, locationId))
      .returning()

    // Renaming a branch or changing its hours is invisible to the pass; only the pin
    // (or the branch going on or off the map) is worth waking every phone for.
    const pinChanged =
      before.latitude !== updated!.latitude ||
      before.longitude !== updated!.longitude ||
      isPassRelevant(before) !== isPassRelevant(updated!)
    if (pinChanged && (isPassRelevant(before) || isPassRelevant(updated!))) {
      await enqueueWalletUpdatesForOrg(tx, orgId, { reason: 'location' })
    }
    return updated!
  })
}

/** Soft delete: stamp history references the location, so the row must survive. */
export async function deleteLocation(db: Database, orgId: string, locationId: string) {
  const remaining = await db
    .select({ value: count() })
    .from(locations)
    .where(and(eq(locations.orgId, orgId), isNull(locations.deletedAt)))

  if ((remaining[0]?.value ?? 0) <= 1) {
    throw new AppError('CONFLICT', { message: 'a business needs at least one location' })
  }

  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(locations)
      .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(locations.id, locationId), eq(locations.orgId, orgId), isNull(locations.deletedAt)),
      )
      .returning()

    // The branch had a pin: the passes still point at it until they are rebuilt.
    if (deleted && deleted.latitude !== null && deleted.longitude !== null) {
      await enqueueWalletUpdatesForOrg(tx, orgId, { reason: 'location' })
    }
    return { deleted: true }
  })
}

// ── Team ─────────────────────────────────────────────────────────────────────

export async function listMembers(db: Database, orgId: string) {
  return db
    .select({
      id: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      locationId: memberships.locationId,
      joinedAt: memberships.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(memberships.createdAt)
}

export async function countSeats(db: Database, orgId: string): Promise<number> {
  const [staff, pending] = await Promise.all([
    db.select({ value: count() }).from(memberships).where(eq(memberships.orgId, orgId)),
    db
      .select({ value: count() })
      .from(invites)
      .where(and(eq(invites.orgId, orgId), isNull(invites.acceptedAt), isNull(invites.revokedAt))),
  ])
  // Pending invites hold a seat, otherwise a business could invite past its limit.
  return (staff[0]?.value ?? 0) + (pending[0]?.value ?? 0)
}

export async function inviteMember(
  db: Database,
  input: {
    orgId: string
    entitlements: Entitlements
    invitedBy: string
    email: string
    role: Role
    locationId: string | null
  },
): Promise<{ token: string; inviteId: string }> {
  // The owner's own seat is free; extra seats are what the plan limits.
  const seats = await countSeats(db, input.orgId)
  assertWithinLimit(input.entitlements, 'staffSeats', seats - 1)

  const [existingMember] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, input.orgId), eq(users.email, input.email.toLowerCase())))
    .limit(1)
  if (existingMember) {
    throw new AppError('CONFLICT', { message: 'that person is already on the team' })
  }

  const token = randomToken(32)
  const [invite] = await db
    .insert(invites)
    .values({
      orgId: input.orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      locationId: input.locationId,
      invitedBy: input.invitedBy,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_SECONDS * 1000),
    })
    .returning()

  return { token, inviteId: invite!.id }
}

export async function acceptInvite(
  db: Database,
  input: { token: string; userId: string },
): Promise<{ orgId: string; role: Role }> {
  const hash = hashToken(input.token)

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hash))
      .for('update')
      .limit(1)

    if (!invite) throw new AppError('TOKEN_EXPIRED', { message: 'invitation is invalid' })
    if (invite.acceptedAt)
      throw new AppError('CONFLICT', { message: 'invitation was already used' })
    if (invite.revokedAt) throw new AppError('FORBIDDEN', { message: 'invitation was revoked' })
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', { message: 'invitation has expired' })
    }

    await tx
      .insert(memberships)
      .values({
        orgId: invite.orgId,
        userId: input.userId,
        role: invite.role,
        locationId: invite.locationId,
      })
      .onConflictDoNothing()

    await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id))

    return { orgId: invite.orgId, role: invite.role }
  })
}

/**
 * Public view of an invitation, for the screen the invited person lands on before they
 * have an account. Returns no identifiers — only what the page needs to say who is
 * inviting them and whether they still have to pick a password.
 */
export async function previewInvite(
  db: Database,
  token: string,
): Promise<{ email: string; orgName: string; role: Role; needsAccount: boolean }> {
  const [row] = await db
    .select({
      email: invites.email,
      role: invites.role,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt,
      expiresAt: invites.expiresAt,
      orgName: organizations.name,
    })
    .from(invites)
    .innerJoin(organizations, eq(organizations.id, invites.orgId))
    .where(eq(invites.tokenHash, hashToken(token)))
    .limit(1)

  if (!row) throw new AppError('TOKEN_EXPIRED', { message: 'invitation is invalid' })
  if (row.acceptedAt) throw new AppError('CONFLICT', { message: 'invitation was already used' })
  if (row.revokedAt) throw new AppError('FORBIDDEN', { message: 'invitation was revoked' })
  if (row.expiresAt.getTime() < Date.now()) {
    throw new AppError('TOKEN_EXPIRED', { message: 'invitation has expired' })
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, row.email), isNull(users.deletedAt)))
    .limit(1)

  return { email: row.email, orgName: row.orgName, role: row.role, needsAccount: !existing }
}

/**
 * Accepts an invitation for someone who has no account yet, creating the user and the
 * membership in one transaction.
 *
 * The address comes from the invitation and never from the request, so a leaked link
 * cannot be turned into an account for a different email. Following a link out of their
 * own inbox is proof enough that the address works, so it starts verified.
 */
export async function claimInvite(
  db: Database,
  input: { token: string; name: string; password: string },
): Promise<{ userId: string; email: string; orgId: string; role: Role }> {
  const hash = hashToken(input.token)
  const passwordHash = await hashPassword(input.password)

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hash))
      .for('update')
      .limit(1)

    if (!invite) throw new AppError('TOKEN_EXPIRED', { message: 'invitation is invalid' })
    if (invite.acceptedAt)
      throw new AppError('CONFLICT', { message: 'invitation was already used' })
    if (invite.revokedAt) throw new AppError('FORBIDDEN', { message: 'invitation was revoked' })
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', { message: 'invitation has expired' })
    }

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, invite.email), isNull(users.deletedAt)))
      .limit(1)
    if (existing) {
      throw new AppError('EMAIL_TAKEN', {
        message: 'that email already has an account — sign in to accept',
      })
    }

    const [user] = await tx
      .insert(users)
      .values({
        email: invite.email,
        passwordHash,
        name: input.name,
        emailVerifiedAt: new Date(),
      })
      .returning()

    await tx.insert(memberships).values({
      orgId: invite.orgId,
      userId: user!.id,
      role: invite.role,
      locationId: invite.locationId,
    })

    await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id))

    return { userId: user!.id, email: user!.email, orgId: invite.orgId, role: invite.role }
  })
}

/** The last owner cannot be removed or demoted — that would orphan the business. */
async function assertNotLastOwner(
  db: Database,
  orgId: string,
  membershipId: string,
): Promise<void> {
  const owners = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, 'owner')))

  if (owners.length === 1 && owners[0]!.id === membershipId) {
    throw new AppError('CONFLICT', { message: 'the business must keep at least one owner' })
  }
}

export async function updateMember(
  db: Database,
  orgId: string,
  membershipId: string,
  data: { role?: Role; locationId?: string | null },
) {
  if (data.role && data.role !== 'owner') {
    await assertNotLastOwner(db, orgId, membershipId)
  }

  const [updated] = await db
    .update(memberships)
    .set(data)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
    .returning()

  if (!updated) throw new AppError('NOT_FOUND', { message: 'member not found' })
  return updated
}

export async function removeMember(db: Database, orgId: string, membershipId: string) {
  await assertNotLastOwner(db, orgId, membershipId)
  await db
    .delete(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
  return { removed: true }
}

// ── Profile questions ────────────────────────────────────────────────────────

export async function listProfileQuestions(db: Database, orgId: string) {
  return db
    .select()
    .from(profileQuestions)
    .where(eq(profileQuestions.orgId, orgId))
    .orderBy(profileQuestions.position)
}

export async function replaceProfileQuestions(
  db: Database,
  orgId: string,
  questions: ProfileQuestionInput[],
) {
  return db.transaction(async (tx) => {
    // Deactivate rather than delete: existing answers reference these questions.
    await tx
      .update(profileQuestions)
      .set({ isActive: false })
      .where(eq(profileQuestions.orgId, orgId))

    if (questions.length === 0) return []

    return tx
      .insert(profileQuestions)
      .values(
        questions.map((question, index) => ({
          orgId,
          prompt: question.prompt,
          type: question.type,
          options: question.options,
          isRequired: question.isRequired,
          askOn: question.askOn,
          position: index,
          isActive: true,
        })),
      )
      .returning()
  })
}
