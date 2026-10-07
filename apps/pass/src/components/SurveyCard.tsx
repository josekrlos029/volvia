'use client'

import { browserApiUrl } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useState } from 'react'

export type SurveyQuestion =
  | { type: 'rating'; prompt: string; scale: 5 }
  | { type: 'text'; prompt: string; maxLength: number }
  | { type: 'choice'; prompt: string; options: string[]; allowMultiple: boolean }

export interface PendingSurvey {
  id: string
  name: string
  isAnonymous: boolean
  questions: SurveyQuestion[]
}

interface Answer {
  questionIndex: number
  rating?: number
  text?: string
  choices?: string[]
}

type Stage = 'asking' | 'sending' | 'thanks' | 'dismissed'

/** An anonymous survey stores no customer, so only this browser can remember it. */
function remembered(surveyId: string): boolean {
  try {
    return localStorage.getItem(`volvia.survey.${surveyId}`) === 'done'
  } catch {
    return false
  }
}

function remember(surveyId: string): void {
  try {
    localStorage.setItem(`volvia.survey.${surveyId}`, 'done')
  } catch {
    // A private window simply asks again next time; nothing breaks.
  }
}

/**
 * The survey the business configured, asked on the customer's own card.
 *
 * Shown under the stamps rather than over them: the card is what the customer came
 * for, and a questionnaire in the way of it would get dismissed, not answered.
 */
export function SurveyCard({
  survey,
  cardToken,
  locale,
  accentColor,
}: {
  survey: PendingSurvey
  cardToken: string
  /** Only the locale crosses the server/client boundary; the copy is imported here. */
  locale: string
  accentColor: string
}) {
  const copy = t(locale)
  const [stage, setStage] = useState<Stage>(() =>
    survey.isAnonymous && remembered(survey.id) ? 'dismissed' : 'asking',
  )
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [error, setError] = useState<string | null>(null)
  const [review, setReview] = useState<{ requestId: string | null; url: string } | null>(null)

  if (stage === 'dismissed') return null

  const firstRatingIndex = survey.questions.findIndex((question) => question.type === 'rating')

  function setAnswer(index: number, patch: Partial<Answer>) {
    setAnswers((current) => ({
      ...current,
      [index]: { ...current[index], questionIndex: index, ...patch },
    }))
  }

  async function submit() {
    // A rating steers whether we ask for a public review, so it is the one required answer.
    if (firstRatingIndex >= 0 && answers[firstRatingIndex]?.rating === undefined) {
      setError(copy.survey.ratingRequired)
      return
    }

    setError(null)
    setStage('sending')

    try {
      const response = await fetch(`${browserApiUrl}/p/survey/${survey.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardToken, answers: Object.values(answers) }),
      })
      if (!response.ok) throw new Error('survey failed')

      const body = (await response.json()) as {
        reviewUrl: string | null
        reviewRequestId: string | null
      }
      remember(survey.id)
      if (body.reviewUrl) setReview({ requestId: body.reviewRequestId, url: body.reviewUrl })
      setStage('thanks')
    } catch {
      setStage('asking')
      setError(copy.survey.error)
    }
  }

  if (stage === 'thanks') {
    return (
      <section className="rounded-[14px] border border-[var(--color-line)] bg-white p-4">
        <h2 className="text-[16px] font-medium leading-snug">
          {review ? copy.survey.reviewTitle : copy.survey.thanksTitle}
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-[var(--color-ink-muted)]">
          {review ? copy.survey.reviewBody : copy.survey.thanksBody}
        </p>

        {review ? (
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={review.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => {
                // Fire and forget: the click must not wait on our analytics.
                if (review.requestId) {
                  void fetch(`${browserApiUrl}/p/review/${review.requestId}/click`, {
                    method: 'POST',
                    keepalive: true,
                  }).catch(() => {})
                }
              }}
              className="inline-flex w-full items-center justify-center rounded-[10px] px-4 py-3 text-[15px] font-medium text-white"
              style={{ backgroundColor: accentColor }}
            >
              {copy.survey.reviewCta}
            </a>
            <button
              type="button"
              onClick={() => setStage('dismissed')}
              className="py-1.5 text-[14px] text-[var(--color-ink-muted)] underline underline-offset-2"
            >
              {copy.survey.reviewLater}
            </button>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-[14px] border border-[var(--color-line)] bg-white p-4">
      <h2 className="text-[16px] font-medium leading-snug">{copy.survey.title}</h2>
      <p className="mt-1 text-[14px] leading-snug text-[var(--color-ink-muted)]">
        {survey.isAnonymous ? copy.survey.anonymous : copy.survey.intro}
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {survey.questions.map((question, index) => (
          <fieldset key={`${question.type}-${index}`} className="flex flex-col gap-2.5">
            <legend className="text-[14px] font-medium">
              {question.prompt}
              {question.type === 'text' ? (
                <span className="ml-1.5 font-normal text-[var(--color-ink-muted)]">
                  {copy.survey.optional}
                </span>
              ) : null}
            </legend>

            {question.type === 'rating' ? (
              <>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const chosen = answers[index]?.rating === value
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={copy.survey.ratingLegend(value)}
                        aria-pressed={chosen}
                        onClick={() => setAnswer(index, { rating: value })}
                        className={`tabular h-12 flex-1 rounded-[10px] border text-[16px] font-medium transition-transform duration-150 active:scale-[0.97] ${
                          chosen
                            ? 'border-transparent text-white'
                            : 'border-[var(--color-line)] bg-white text-[var(--color-ink)]'
                        }`}
                        style={chosen ? { backgroundColor: accentColor } : undefined}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[12px] text-[var(--color-ink-muted)]">
                  <span>{copy.survey.ratingLow}</span>
                  <span>{copy.survey.ratingHigh}</span>
                </div>
              </>
            ) : null}

            {question.type === 'text' ? (
              <textarea
                rows={3}
                maxLength={question.maxLength}
                placeholder={copy.survey.textPlaceholder}
                value={answers[index]?.text ?? ''}
                onChange={(event) => setAnswer(index, { text: event.target.value })}
                className="w-full resize-none rounded-[10px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[15px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
              />
            ) : null}

            {question.type === 'choice' ? (
              <div className="flex flex-col gap-2">
                {question.options.map((option) => {
                  const current = answers[index]?.choices ?? []
                  const chosen = current.includes(option)
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() =>
                        setAnswer(index, {
                          choices: question.allowMultiple
                            ? chosen
                              ? current.filter((value) => value !== option)
                              : [...current, option]
                            : [option],
                        })
                      }
                      className={`rounded-[10px] border px-3.5 py-3 text-left text-[15px] transition-transform duration-150 active:scale-[0.99] ${
                        chosen
                          ? 'border-transparent text-white'
                          : 'border-[var(--color-line)] bg-white'
                      }`}
                      style={chosen ? { backgroundColor: accentColor } : undefined}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </fieldset>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={stage === 'sending'}
          className="flex-1 rounded-[10px] px-4 py-3 text-[15px] font-medium text-white transition-transform duration-150 active:scale-[0.985] disabled:opacity-60"
          style={{ backgroundColor: accentColor }}
        >
          {stage === 'sending' ? copy.survey.submitting : copy.survey.submit}
        </button>
        <button
          type="button"
          onClick={() => setStage('dismissed')}
          className="px-2 py-3 text-[14px] text-[var(--color-ink-muted)] underline underline-offset-2"
        >
          {copy.survey.skip}
        </button>
      </div>
    </section>
  )
}
