import { and, eq, invites, isNull, organizations } from '@volvia/db'
import {
  ALLOWED_IMAGE_TYPES,
  DEFAULT_ORG_SETTINGS,
  MAX_UPLOAD_BYTES,
  acceptInviteSchema,
  inviteMemberSchema,
  locationSchema,
  passwordSchema,
  profileQuestionListSchema,
  roleSchema,
  updateLocationSchema,
  updateOrgSchema,
} from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../env'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { inviteTemplate } from '../../lib/email'
import { invalidateEntitlements } from '../../lib/entitlements'
import { AppError } from '../../lib/errors'
import { redisKeys } from '../../lib/redis'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import { setAuthCookies } from '../auth/cookies'
import { issueSession } from '../auth/issue'
import {
  acceptInvite,
  claimInvite,
  countSeats,
  createLocation,
  deleteLocation,
  getOrg,
  inviteMember,
  listLocations,
  listMembers,
  listProfileQuestions,
  previewInvite,
  removeMember,
  replaceProfileQuestions,
  suggestSlug,
  updateLocation,
  updateMember,
  updateOrg,
} from './service'

export async function orgRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/',
    { preHandler: [app.requireOrg('staff')], schema: { tags: ['org'] } },
    async (request) => {
      const org = await getOrg(app.db, request.org!.orgId)
      const entitlements = request.org!.entitlements
      return {
        ...org,
        // Filled in, so the dashboard never has to guess a default.
        settings: { ...DEFAULT_ORG_SETTINGS, ...org.settings },
        entitlements: {
          plan: entitlements.plan,
          effectivePlan: entitlements.effectivePlan,
          inPremiumTrial: entitlements.inPremiumTrial,
          trialCustomersRemaining: entitlements.trialCustomersRemaining,
          // The dashboard disables what the plan does not include, rather than
          // hiding it, so the business can see what upgrading would unlock.
          features: Object.fromEntries(
            (
              [
                'wallet_passes',
                'custom_branding',
                'custom_stamp_icons',
                'premium_card_display',
                'customer_contact_details',
                'birthday_automation',
                'customer_messages',
                'custom_segments',
                'campaigns',
                'surveys',
                'google_review_requests',
                'full_analytics',
                'csv_export',
                'team_accounts',
                'kiosk_mode',
                'multi_location',
                'priority_support',
              ] as const
            ).map((feature) => [feature, entitlements.has(feature)]),
          ),
          limits: {
            locations: entitlements.limit('locations'),
            activeCards: entitlements.limit('activeCards'),
            staffSeats: entitlements.limit('staffSeats'),
            campaignsPerMonth: entitlements.limit('campaignsPerMonth'),
            messagesPerMonth: entitlements.limit('messagesPerMonth'),
          },
        },
        publicUrl: `${env.PASS_URL}/b/${org.slug}`,
      }
    },
  )

  app.patch(
    '/',
    { preHandler: [app.requireOrg('admin')], schema: { body: updateOrgSchema, tags: ['org'] } },
    async (request) => {
      const previous = await getOrg(app.db, request.org!.orgId)
      const org = await updateOrg(app.db, request.org!.orgId, request.body)
      // The public page is cached by slug; both the old and new keys must go.
      await app.redis.del(redisKeys.businessPage(previous.slug), redisKeys.businessPage(org.slug))
      return org
    },
  )

  app.get(
    '/slug-available',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { querystring: z.object({ name: z.string().min(2).max(120) }), tags: ['org'] },
    },
    async (request) => ({ slug: await suggestSlug(app.db, request.query.name) }),
  )

  app.patch(
    '/onboarding',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { body: z.record(z.string(), z.boolean()), tags: ['org'] },
    },
    async (request) => {
      const org = await getOrg(app.db, request.org!.orgId)
      const [updated] = await app.db
        .update(organizations)
        .set({ onboarding: { ...org.onboarding, ...request.body }, updatedAt: new Date() })
        .where(eq(organizations.id, request.org!.orgId))
        .returning({ onboarding: organizations.onboarding })
      return updated!
    },
  )

  /**
   * Images upload straight from the browser to object storage with a short-lived
   * signed URL, so a 5 MB logo never travels through the API container.
   */
  app.post(
    '/uploads',
    {
      preHandler: [app.requireOrg('admin')],
      config: { rateLimit: rateLimits.upload },
      schema: {
        body: z.object({
          kind: z.enum(['logo', 'banner', 'cover', 'stamp']),
          contentType: z.enum(ALLOWED_IMAGE_TYPES),
          contentLength: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
        }),
        tags: ['org'],
      },
    },
    async (request) => {
      if (request.body.kind === 'stamp' && !request.org!.entitlements.has('custom_stamp_icons')) {
        throw new AppError('FEATURE_NOT_IN_PLAN', {
          message: 'custom stamp icons are not included in your plan',
          upgradeTo: request.org!.entitlements.upgradeForFeature('custom_stamp_icons') ?? undefined,
        })
      }
      return app.storage.createUploadTarget({ orgId: request.org!.orgId, ...request.body })
    },
  )

  // ── Locations ──────────────────────────────────────────────────────────────
  app.get(
    '/locations',
    { preHandler: [app.requireOrg('staff')], schema: { tags: ['org'] } },
    async (request) => listLocations(app.db, request.org!.orgId),
  )

  app.post(
    '/locations',
    { preHandler: [app.requireOrg('admin')], schema: { body: locationSchema, tags: ['org'] } },
    async (request, reply) => {
      const org = await getOrg(app.db, request.org!.orgId)
      const location = await createLocation(app.db, {
        orgId: org.id,
        entitlements: request.org!.entitlements,
        data: request.body,
        timezone: org.timezone,
      })
      return reply.status(201).send(location)
    },
  )

  app.patch(
    '/locations/:locationId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: {
        params: z.object({ locationId: z.string().uuid() }),
        body: updateLocationSchema,
        tags: ['org'],
      },
    },
    async (request) =>
      updateLocation(app.db, request.org!.orgId, request.params.locationId, request.body),
  )

  app.delete(
    '/locations/:locationId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { params: z.object({ locationId: z.string().uuid() }), tags: ['org'] },
    },
    async (request) => deleteLocation(app.db, request.org!.orgId, request.params.locationId),
  )

  // ── Team ───────────────────────────────────────────────────────────────────
  app.get(
    '/members',
    { preHandler: [app.requireOrg('admin')], schema: { tags: ['org'] } },
    async (request) => {
      const [members, pending, seats] = await Promise.all([
        listMembers(app.db, request.org!.orgId),
        app.db
          .select({
            id: invites.id,
            email: invites.email,
            role: invites.role,
            expiresAt: invites.expiresAt,
          })
          .from(invites)
          .where(
            and(
              eq(invites.orgId, request.org!.orgId),
              isNull(invites.acceptedAt),
              isNull(invites.revokedAt),
            ),
          ),
        countSeats(app.db, request.org!.orgId),
      ])
      return { members, pending, seats, seatLimit: request.org!.entitlements.limit('staffSeats') }
    },
  )

  app.post(
    '/members/invite',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('team_accounts')],
      schema: { body: inviteMemberSchema, tags: ['org'] },
    },
    async (request, reply) => {
      const org = await getOrg(app.db, request.org!.orgId)
      const { token, inviteId } = await inviteMember(app.db, {
        orgId: org.id,
        entitlements: request.org!.entitlements,
        invitedBy: request.auth!.userId,
        email: request.body.email,
        role: request.body.role,
        locationId: request.body.locationId,
      })

      await app.mailer.send({
        to: request.body.email,
        template: inviteTemplate(org.locale, `${env.APP_URL}/invite?token=${token}`, org.name),
      })

      await audit(app.db, {
        orgId: org.id,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.memberInvited,
        targetType: 'invite',
        targetId: inviteId,
        meta: { role: request.body.role },
        ip: request.ip,
      })

      return reply.status(201).send({ inviteId, sent: true })
    },
  )

  app.post(
    '/members/accept',
    {
      schema: { body: acceptInviteSchema, tags: ['org'] },
      preHandler: [app.requireAuth],
    },
    async (request) =>
      acceptInvite(app.db, { token: request.body.token, userId: request.auth!.userId }),
  )

  app.delete(
    '/invites/:inviteId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { params: z.object({ inviteId: z.string().uuid() }), tags: ['org'] },
    },
    async (request) => {
      await app.db
        .update(invites)
        .set({ revokedAt: new Date() })
        .where(and(eq(invites.id, request.params.inviteId), eq(invites.orgId, request.org!.orgId)))
      return { revoked: true }
    },
  )

  app.patch(
    '/members/:membershipId',
    {
      preHandler: [app.requireOrg('owner')],
      schema: {
        params: z.object({ membershipId: z.string().uuid() }),
        body: z.object({
          role: roleSchema.optional(),
          locationId: z.string().uuid().nullable().optional(),
        }),
        tags: ['org'],
      },
    },
    async (request) => {
      const updated = await updateMember(
        app.db,
        request.org!.orgId,
        request.params.membershipId,
        request.body,
      )
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.memberRoleChanged,
        targetType: 'membership',
        targetId: request.params.membershipId,
        meta: { role: request.body.role },
        ip: request.ip,
      })
      return updated
    },
  )

  app.delete(
    '/members/:membershipId',
    {
      preHandler: [app.requireOrg('owner')],
      schema: { params: z.object({ membershipId: z.string().uuid() }), tags: ['org'] },
    },
    async (request) => {
      const result = await removeMember(app.db, request.org!.orgId, request.params.membershipId)
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.memberRemoved,
        targetType: 'membership',
        targetId: request.params.membershipId,
        ip: request.ip,
      })
      return result
    },
  )

  /**
   * Closing the business.
   *
   * A soft delete: the organisation disappears from every query the product makes, its
   * public page and cards stop resolving, and the data stays recoverable for as long as
   * the retention policy says. The owner has to type the name, because this is the one
   * action in the dashboard nobody should be able to take by mis-clicking.
   */
  app.post(
    '/close',
    {
      preHandler: [app.requireOrg('owner')],
      schema: {
        body: z.object({ confirmName: z.string().min(1).max(120) }),
        response: { 200: z.object({ deleted: z.boolean() }) },
        tags: ['org'],
      },
    },
    async (request) => {
      const org = await getOrg(app.db, request.org!.orgId)
      if (request.body.confirmName.trim().toLowerCase() !== org.name.trim().toLowerCase()) {
        throw new AppError('VALIDATION_FAILED', {
          message: 'the name does not match the business name',
        })
      }

      await app.db
        .update(organizations)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(organizations.id, org.id))

      await invalidateEntitlements(app.redis, org.id)
      await audit(app.db, {
        orgId: org.id,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.orgDeleted,
        targetType: 'organization',
        targetId: org.id,
        ip: request.ip,
      })

      return { deleted: true }
    },
  )

  // ── Profile questions ──────────────────────────────────────────────────────
  app.get(
    '/profile-questions',
    { preHandler: [app.requireOrg('admin')], schema: { tags: ['org'] } },
    async (request) => listProfileQuestions(app.db, request.org!.orgId),
  )

  app.put(
    '/profile-questions',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { body: profileQuestionListSchema, tags: ['org'] },
    },
    async (request) => {
      const saved = await replaceProfileQuestions(app.db, request.org!.orgId, request.body)
      await invalidateEntitlements(app.redis, request.org!.orgId)
      return saved
    },
  )
}

/**
 * Invitation screens, reachable without an account.
 *
 * A staff member invited by email has nowhere to sign in yet, so these two endpoints let
 * the invitation page name the business and then create the account bound to it. The
 * authenticated `POST /v1/org/members/accept` stays the path for people who already
 * have a Volvia account.
 */
export async function publicInviteRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/invite',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: {
        querystring: z.object({ token: z.string().min(16).max(400) }),
        response: {
          200: z.object({
            email: z.string().email(),
            orgName: z.string(),
            role: roleSchema,
            needsAccount: z.boolean(),
          }),
        },
        tags: ['public'],
      },
    },
    async (request) => previewInvite(app.db, request.query.token),
  )

  app.post(
    '/invite/accept',
    {
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: z.object({
          token: z.string().min(16).max(400),
          name: z.string().trim().min(2).max(120),
          password: passwordSchema,
        }),
        tags: ['public'],
      },
    },
    async (request, reply) => {
      const claimed = await claimInvite(app.db, request.body)
      await audit(app.db, {
        orgId: claimed.orgId,
        actorUserId: claimed.userId,
        action: AUDIT_ACTIONS.memberAccepted,
        targetType: 'membership',
        ip: request.ip,
        meta: { role: claimed.role },
      })

      const session = await issueSession(app, claimed.userId, claimed.email, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
      })
      setAuthCookies(reply, session)
      return reply.status(201).send(session)
    },
  )
}
