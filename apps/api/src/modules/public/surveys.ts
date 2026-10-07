import { type Database, and, eq, rewardGrants, surveyResponses, surveys } from '@volvia/db'
import type { PublicCardState } from '@volvia/shared'

/**
 * Decides whether this customer should be asked a survey right now.
 *
 * The trigger lives on the survey, so the customer-facing card never reasons about it:
 * it either receives a survey to show or it does not. A survey the customer already
 * answered never comes back, which is the difference between asking and nagging.
 */
export async function pickPendingSurvey(
  db: Database,
  input: { orgId: string; cardId: string; customerCardId: string; stampsCount: number },
): Promise<PublicCardState['pendingSurvey']> {
  const candidates = await db
    .select()
    .from(surveys)
    .where(and(eq(surveys.orgId, input.orgId), eq(surveys.isActive, true)))

  if (candidates.length === 0) return null

  // An empty card list means "every card of this business".
  const forThisCard = candidates.filter(
    (survey) => survey.cardIds.length === 0 || survey.cardIds.includes(input.cardId),
  )
  if (forThisCard.length === 0) return null

  const [answered, earnedReward] = await Promise.all([
    db
      .select({ surveyId: surveyResponses.surveyId })
      .from(surveyResponses)
      .where(eq(surveyResponses.customerCardId, input.customerCardId)),
    db
      .select({ id: rewardGrants.id })
      .from(rewardGrants)
      .where(eq(rewardGrants.customerCardId, input.customerCardId))
      .limit(1),
  ])

  const alreadyAnswered = new Set(answered.map((row) => row.surveyId))
  const hasEarnedReward = earnedReward.length > 0

  const due = forThisCard.find((survey) => {
    // An anonymous survey stores no customer, so the browser remembers instead.
    if (!survey.isAnonymous && alreadyAnswered.has(survey.id)) return false

    switch (survey.trigger) {
      case 'after_join':
        return true
      case 'after_reward':
        return hasEarnedReward
      case 'after_nth_stamp':
        return survey.triggerStamp !== null && input.stampsCount >= survey.triggerStamp
      default:
        // `manual` surveys are sent in a campaign, never shown on the card.
        return false
    }
  })

  if (!due) return null

  return {
    id: due.id,
    name: due.name,
    isAnonymous: due.isAnonymous,
    questions: due.questions,
  }
}
