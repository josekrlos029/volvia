import {
  type Database,
  and,
  automations,
  campaigns,
  count,
  customerCards,
  customers,
  desc,
  eq,
  gte,
  isNull,
  organizations,
  outbox,
  reviewRequests,
  sql,
  surveyResponses,
  surveys,
} from '@volvia/db'
import { REVIEW_REQUEST_COOLDOWN_DAYS, type VisitFrequency } from '@volvia/shared'
import type {
  AutomationInput,
  AutomationType,
  CampaignInput,
  Entitlements,
  SurveyInput,
} from '@volvia/shared'
import { AppError } from '../../lib/errors'
import { OUTBOX_KINDS } from '../../lib/outbox'
import { assertWithinLimit } from '../../plugins/auth'
import { resolveAudienceSize } from './audience'

// ── Campaigns ────────────────────────────────────────────────────────────────

export async function listCampaigns(db: Database, orgId: string) {
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.orgId, orgId))
    .orderBy(desc(campaigns.startsAt))
    .limit(100)
}

/** Campaigns are metered per calendar month, so the count resets with the billing view. */
export async function campaignsThisMonth(db: Database, orgId: string): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const [row] = await db
    .select({ value: count() })
    .from(campaigns)
    .where(and(eq(campaigns.orgId, orgId), gte(campaigns.createdAt, monthStart)))
  return row?.value ?? 0
}

export async function createCampaign(
  db: Database,
  input: { orgId: string; entitlements: Entitlements; data: CampaignInput },
) {
  const used = await campaignsThisMonth(db, input.orgId)
  assertWithinLimit(input.entitlements, 'campaignsPerMonth', used)

  const now = new Date()
  const [created] = await db
    .insert(campaigns)
    .values({
      orgId: input.orgId,
      name: input.data.name,
      template: input.data.template,
      headline: input.data.headline,
      body: input.data.body,
      offer: input.data.offer,
      audience: input.data.audience,
      startsAt: input.data.startsAt,
      endsAt: input.data.endsAt,
      sendPush: input.data.sendPush,
      activeWeekdays: input.data.activeWeekdays,
      activeHours: input.data.activeHours,
      // A campaign whose window already began starts immediately on launch.
      status: input.data.startsAt <= now ? 'scheduled' : 'scheduled',
    })
    .returning()

  return created!
}

export async function launchCampaign(db: Database, orgId: string, campaignId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)))
    .limit(1)
  if (!campaign) throw new AppError('NOT_FOUND', { message: 'campaign not found' })
  if (campaign.status === 'running') return campaign
  if (campaign.status === 'finished' || campaign.status === 'cancelled') {
    throw new AppError('CONFLICT', { message: 'this campaign already ended' })
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(campaigns)
      .set({ status: 'scheduled', updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId))
      .returning()

    // The scheduler picks it up within the minute; going through the outbox keeps
    // launching a campaign the same code path whether it is immediate or scheduled.
    await tx.insert(outbox).values({
      orgId,
      kind: OUTBOX_KINDS.campaignStart,
      payload: { campaignId },
      runAt: campaign.startsAt,
    })

    return updated!
  })
}

export async function cancelCampaign(db: Database, orgId: string, campaignId: string) {
  const [updated] = await db
    .update(campaigns)
    .set({ status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.orgId, orgId)))
    .returning()
  if (!updated) throw new AppError('NOT_FOUND', { message: 'campaign not found' })
  return updated
}

export async function previewAudience(
  db: Database,
  orgId: string,
  audience: CampaignInput['audience'],
  frequency: VisitFrequency,
) {
  return { size: await resolveAudienceSize(db, orgId, audience, frequency) }
}

// ── Surveys ──────────────────────────────────────────────────────────────────

export async function listSurveys(db: Database, orgId: string) {
  const rows = await db.select().from(surveys).where(eq(surveys.orgId, orgId))

  if (rows.length === 0) return []

  const stats = await db
    .select({
      surveyId: surveyResponses.surveyId,
      responses: count(),
      averageRating: sql<number>`avg(${surveyResponses.rating})::float`,
    })
    .from(surveyResponses)
    .where(eq(surveyResponses.orgId, orgId))
    .groupBy(surveyResponses.surveyId)

  const byId = new Map(stats.map((row) => [row.surveyId, row]))
  return rows.map((survey) => ({
    ...survey,
    responses: byId.get(survey.id)?.responses ?? 0,
    averageRating: byId.get(survey.id)?.averageRating
      ? Math.round(byId.get(survey.id)!.averageRating * 10) / 10
      : null,
  }))
}

export async function upsertSurvey(
  db: Database,
  orgId: string,
  data: SurveyInput,
  surveyId?: string,
) {
  const values = {
    orgId,
    name: data.name,
    trigger: data.trigger,
    triggerStamp: data.triggerStamp,
    cardIds: data.cardIds,
    questions: data.questions,
    isAnonymous: data.isAnonymous,
    routeToReviewFromRating: data.routeToReviewFromRating,
    isActive: data.isActive,
    updatedAt: new Date(),
  }

  if (surveyId) {
    const [updated] = await db
      .update(surveys)
      .set(values)
      .where(and(eq(surveys.id, surveyId), eq(surveys.orgId, orgId)))
      .returning()
    if (!updated) throw new AppError('NOT_FOUND', { message: 'survey not found' })
    return updated
  }

  const [created] = await db.insert(surveys).values(values).returning()
  return created!
}

export async function listSurveyResponses(db: Database, orgId: string, surveyId: string) {
  return db
    .select({
      id: surveyResponses.id,
      rating: surveyResponses.rating,
      answers: surveyResponses.answers,
      createdAt: surveyResponses.createdAt,
      // Null when the survey was answered anonymously.
      customerName: customers.firstName,
    })
    .from(surveyResponses)
    .leftJoin(customerCards, eq(customerCards.id, surveyResponses.customerCardId))
    .leftJoin(customers, eq(customers.id, customerCards.customerId))
    .where(and(eq(surveyResponses.orgId, orgId), eq(surveyResponses.surveyId, surveyId)))
    .orderBy(desc(surveyResponses.createdAt))
    .limit(500)
}

/**
 * Records a response and decides where the customer goes next.
 *
 * A happy customer is sent to the public Google review; an unhappy one is not. That is
 * the whole point of gating on the rating: private feedback reaches the business, and
 * the business is not nudging people into publishing complaints.
 */
export async function submitSurveyResponse(
  db: Database,
  input: {
    surveyId: string
    cardToken: string | null
    answers: Array<{ questionIndex: number; rating?: number; text?: string; choices?: string[] }>
  },
) {
  const [survey] = await db.select().from(surveys).where(eq(surveys.id, input.surveyId)).limit(1)
  if (!survey || !survey.isActive) {
    throw new AppError('NOT_FOUND', { message: 'survey not found' })
  }

  let customerCardId: string | null = null
  if (input.cardToken && !survey.isAnonymous) {
    const [card] = await db
      .select({ id: customerCards.id })
      .from(customerCards)
      .where(eq(customerCards.token, input.cardToken))
      .limit(1)
    customerCardId = card?.id ?? null
  }

  const rating = input.answers.find((answer) => answer.rating !== undefined)?.rating ?? null

  await db.insert(surveyResponses).values({
    orgId: survey.orgId,
    surveyId: survey.id,
    customerCardId,
    rating,
    answers: input.answers,
  })

  const [org] = await db
    .select({ googlePlaceId: organizations.googlePlaceId, settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, survey.orgId))
    .limit(1)

  const paused = org?.settings?.reviewRequestsPaused === true

  const happyEnough =
    survey.routeToReviewFromRating !== null &&
    rating !== null &&
    rating >= survey.routeToReviewFromRating &&
    Boolean(org?.googlePlaceId) &&
    !paused

  // Nobody should be asked for a public review twice in the same half year, however
  // many surveys they answer. An unhappy rating never reaches this branch at all.
  const askedRecently = customerCardId
    ? await db
        .select({ id: reviewRequests.id })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.customerCardId, customerCardId),
            gte(
              reviewRequests.shownAt,
              new Date(Date.now() - REVIEW_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000),
            ),
          ),
        )
        .limit(1)
    : []

  const shouldAskForReview = happyEnough && customerCardId !== null && askedRecently.length === 0

  let reviewRequestId: string | null = null
  if (shouldAskForReview) {
    const [created] = await db
      .insert(reviewRequests)
      .values({ orgId: survey.orgId, customerCardId, trigger: 'after_survey' })
      .returning({ id: reviewRequests.id })
    reviewRequestId = created?.id ?? null
  }

  return {
    thanks: true,
    reviewRequestId,
    reviewUrl: shouldAskForReview
      ? `https://search.google.com/local/writereview?placeid=${org!.googlePlaceId}`
      : null,
  }
}

/**
 * Marks that the customer actually went to Google. Shown-versus-clicked is the only
 * honest measure of whether these prompts are worth showing at all.
 */
export async function markReviewClicked(db: Database, requestId: string): Promise<void> {
  await db
    .update(reviewRequests)
    .set({ clickedAt: new Date() })
    .where(and(eq(reviewRequests.id, requestId), isNull(reviewRequests.clickedAt)))
}

/**
 * How the review prompts are doing.
 *
 * Shown and opened, not "sent": we never post a review, we only put the ask in front of
 * a customer who already said they were happy. The gap between the two numbers is the
 * only honest measure of whether the ask is worth making at all.
 */
export async function reviewStats(
  db: Database,
  orgId: string,
): Promise<{
  connected: boolean
  paused: boolean
  shown: number
  opened: number
  shownLast30: number
  openedLast30: number
}> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [[org], [totals], [recent]] = await Promise.all([
    db
      .select({ googlePlaceId: organizations.googlePlaceId, settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),
    db
      .select({
        shown: count(),
        opened: sql<number>`count(${reviewRequests.clickedAt})::int`,
      })
      .from(reviewRequests)
      .where(eq(reviewRequests.orgId, orgId)),
    db
      .select({
        shown: count(),
        opened: sql<number>`count(${reviewRequests.clickedAt})::int`,
      })
      .from(reviewRequests)
      .where(and(eq(reviewRequests.orgId, orgId), gte(reviewRequests.shownAt, since))),
  ])

  return {
    connected: Boolean(org?.googlePlaceId),
    paused: org?.settings?.reviewRequestsPaused === true,
    shown: totals?.shown ?? 0,
    opened: totals?.opened ?? 0,
    shownLast30: recent?.shown ?? 0,
    openedLast30: recent?.opened ?? 0,
  }
}

// ── Automations ──────────────────────────────────────────────────────────────

export async function listAutomations(db: Database, orgId: string) {
  return db.select().from(automations).where(eq(automations.orgId, orgId))
}

export async function upsertAutomation(db: Database, orgId: string, data: AutomationInput) {
  const [existing] = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.orgId, orgId), eq(automations.type, data.type as AutomationType)))
    .limit(1)

  const config = {
    offsetDays: data.offsetDays,
    headline: data.headline,
    body: data.body,
    offer: data.offer,
    sendEmail: data.sendEmail,
    sendPush: data.sendPush,
  }

  if (existing) {
    const [updated] = await db
      .update(automations)
      .set({ isActive: data.isActive, config, updatedAt: new Date() })
      .where(eq(automations.id, existing.id))
      .returning()
    return updated!
  }

  const [created] = await db
    .insert(automations)
    .values({ orgId, type: data.type, isActive: data.isActive, config })
    .returning()
  return created!
}

/** How many customers a birthday automation would reach this month. */
export async function birthdayReach(db: Database, orgId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(customers)
    .where(
      and(
        eq(customers.orgId, orgId),
        eq(customers.birthdayMonth, new Date().getMonth() + 1),
        sql`${customers.deletedAt} is null`,
      ),
    )
  return row?.value ?? 0
}
