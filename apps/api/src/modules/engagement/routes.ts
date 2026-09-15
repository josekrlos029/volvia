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
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import {
  birthdayReach,
  cancelCampaign,
  createCampaign,
  launchCampaign,
  listAutomations,
  listCampaigns,
  listSurveyResponses,
  listSurveys,
  previewAudience,
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
    async (request) => listCampaigns(app.db, request.org!.orgId),
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
    async (request) => previewAudience(app.db, request.org!.orgId, request.body),
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
        tags: ['public'],
      },
    },
    async (request) =>
      submitSurveyResponse(app.db, {
        surveyId: request.params.surveyId,
        cardToken: request.body.cardToken ?? null,
        answers: request.body.answers,
      }),
  )
}
