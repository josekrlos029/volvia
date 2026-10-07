import {
  audienceSchema,
  automationSchema,
  campaignSchema,
  surveyResponseSchema,
  surveySchema,
} from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { redisKeys } from '../../lib/redis'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import {
  birthdayReach,
  campaignsThisMonth,
  cancelCampaign,
  createCampaign,
  launchCampaign,
  listAutomations,
  listCampaigns,
  listSurveyResponses,
  listSurveys,
  markReviewClicked,
  previewAudience,
  reviewStats,
  submitSurveyResponse,
  upsertAutomation,
  upsertSurvey,
} from './service'

export async function engagementRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  // ── Campaigns ──────────────────────────────────────────────────────────────
  app.get(
    '/campaigns',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('campaigns')],
      schema: { tags: ['engagement'] },
    },
    async (request) => {
      const limit = request.org!.entitlements.limit('campaignsPerMonth')
      return {
        campaigns: await listCampaigns(app.db, request.org!.orgId),
        // Shown as "3 de 10 este mes" rather than only refusing the eleventh.
        thisMonth: {
          used: await campaignsThisMonth(app.db, request.org!.orgId),
          limit,
        },
      }
    },
  )

  app.post(
    '/campaigns',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('campaigns')],
      schema: { body: campaignSchema, tags: ['engagement'] },
    },
    async (request, reply) => {
      const campaign = await createCampaign(app.db, {
        orgId: request.org!.orgId,
        entitlements: request.org!.entitlements,
        data: request.body,
      })
      return reply.status(201).send(campaign)
    },
  )

  app.post(
    '/campaigns/preview',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('campaigns')],
      schema: { body: audienceSchema, tags: ['engagement'] },
    },
    async (request) =>
      previewAudience(app.db, request.org!.orgId, request.body, request.org!.visitFrequency),
  )

  app.post(
    '/campaigns/:campaignId/launch',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('campaigns')],
      schema: { params: z.object({ campaignId: z.string().uuid() }), tags: ['engagement'] },
    },
    async (request) => {
      const campaign = await launchCampaign(app.db, request.org!.orgId, request.params.campaignId)
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.campaignLaunched,
        targetType: 'campaign',
        targetId: campaign.id,
        ip: request.ip,
      })
      return campaign
    },
  )

  app.post(
    '/campaigns/:campaignId/cancel',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('campaigns')],
      schema: { params: z.object({ campaignId: z.string().uuid() }), tags: ['engagement'] },
    },
    async (request) => cancelCampaign(app.db, request.org!.orgId, request.params.campaignId),
  )

  // ── Surveys ────────────────────────────────────────────────────────────────
  app.get(
    '/surveys',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('surveys')],
      schema: { tags: ['engagement'] },
    },
    async (request) => listSurveys(app.db, request.org!.orgId),
  )

  app.post(
    '/surveys',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('surveys')],
      schema: { body: surveySchema, tags: ['engagement'] },
    },
    async (request, reply) =>
      reply.status(201).send(await upsertSurvey(app.db, request.org!.orgId, request.body)),
  )

  app.put(
    '/surveys/:surveyId',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('surveys')],
      schema: {
        params: z.object({ surveyId: z.string().uuid() }),
        body: surveySchema,
        tags: ['engagement'],
      },
    },
    async (request) =>
      upsertSurvey(app.db, request.org!.orgId, request.body, request.params.surveyId),
  )

  app.get(
    '/surveys/:surveyId/responses',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('surveys')],
      schema: { params: z.object({ surveyId: z.string().uuid() }), tags: ['engagement'] },
    },
    async (request) => listSurveyResponses(app.db, request.org!.orgId, request.params.surveyId),
  )

  app.get(
    '/reviews',
    {
      preHandler: [app.requireOrg('admin')],
      schema: {
        response: {
          200: z.object({
            connected: z.boolean(),
            paused: z.boolean(),
            shown: z.number().int(),
            opened: z.number().int(),
            shownLast30: z.number().int(),
            openedLast30: z.number().int(),
          }),
        },
        tags: ['engagement'],
      },
    },
    async (request) => reviewStats(app.db, request.org!.orgId),
  )

  // ── Automations ────────────────────────────────────────────────────────────
  app.get(
    '/automations',
    { preHandler: [app.requireOrg('admin')], schema: { tags: ['engagement'] } },
    async (request) => ({
      automations: await listAutomations(app.db, request.org!.orgId),
      birthdayReachThisMonth: await birthdayReach(app.db, request.org!.orgId),
    }),
  )

  app.put(
    '/automations',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('birthday_automation')],
      schema: { body: automationSchema, tags: ['engagement'] },
    },
    async (request) => upsertAutomation(app.db, request.org!.orgId, request.body),
  )
}

/** Public survey endpoints: answered by customers, with no account. */
export async function publicSurveyRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.post(
    '/survey/:surveyId',
    {
      config: { rateLimit: rateLimits.join },
      schema: {
        params: z.object({ surveyId: z.string().uuid() }),
        body: surveyResponseSchema.extend({ cardToken: z.string().min(16).max(128).optional() }),
        response: {
          200: z.object({
            thanks: z.boolean(),
            reviewRequestId: z.string().uuid().nullable(),
            reviewUrl: z.string().nullable(),
          }),
        },
        tags: ['public'],
      },
    },
    async (request) => {
      const result = await submitSurveyResponse(app.db, {
        surveyId: request.params.surveyId,
        cardToken: request.body.cardToken ?? null,
        answers: request.body.answers,
      })

      // The answered survey must stop being offered on the next card load.
      if (request.body.cardToken) {
        await app.redis.del(redisKeys.cardState(request.body.cardToken))
      }

      return result
    },
  )

  app.post(
    '/review/:requestId/click',
    {
      config: { rateLimit: rateLimits.join },
      schema: {
        params: z.object({ requestId: z.string().uuid() }),
        response: { 204: z.null() },
        tags: ['public'],
      },
    },
    async (request, reply) => {
      await markReviewClicked(app.db, request.params.requestId)
      return reply.status(204).send(null)
    },
  )
}
