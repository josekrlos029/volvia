'use client'

import { browserApiUrl } from '@/lib/api'
import { t } from '@/lib/i18n'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Field, inputClass } from './Field'

interface Question {
  id: string
  prompt: string
  type: string
  options: string[]
  isRequired: boolean
}

interface JoinFormProps {
  joinSlug: string
  /** Only the locale crosses the server/client boundary; the copy is imported here. */
  locale: string
  collectBirthday: boolean
  questions: Question[]
  accentColor: string
}

interface FormErrors {
  firstName?: string
  email?: string
  form?: string
}

export function JoinForm({
  joinSlug,
  locale,
  collectBirthday,
  questions,
  accentColor,
}: JoinFormProps) {
  const copy = t(locale)
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    const firstName = String(form.get('firstName') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()

    // Validate before the round trip so the customer is not waiting to be told
    // their name is missing.
    const nextErrors: FormErrors = {}
    if (!firstName) nextErrors.firstName = copy.join.required
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) nextErrors.email = copy.join.invalidEmail
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const month = Number(form.get('birthdayMonth') ?? 0)
    const day = Number(form.get('birthdayDay') ?? 0)

    const answers: Record<string, string> = {}
    for (const question of questions) {
      const value = String(form.get(`q-${question.id}`) ?? '').trim()
      if (value) answers[question.id] = value
    }

    setErrors({})
    setSubmitting(true)

    try {
      const response = await fetch(`${browserApiUrl}/p/join/${joinSlug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName,
          email,
          birthday: month && day ? { month, day } : null,
          marketingConsent: form.get('consent') === 'on',
          answers,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(
          response.status,
          body?.error ?? { code: 'INTERNAL', message: copy.join.error },
        )
      }

      const { token } = (await response.json()) as { token: string }
      router.push(`/c/${token}?welcome=1`)
    } catch (error) {
      setErrors({ form: error instanceof ApiError ? error.message : copy.join.error })
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field label={copy.join.firstName} htmlFor="firstName" error={errors.firstName}>
        <input
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          enterKeyHint="next"
          placeholder={copy.join.firstNamePlaceholder}
          className={inputClass}
          aria-invalid={Boolean(errors.firstName)}
          required
        />
      </Field>

      <Field
        label={copy.join.email}
        htmlFor="email"
        help={copy.join.emailHelp}
        error={errors.email}
      >
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="next"
          placeholder={copy.join.emailPlaceholder}
          className={inputClass}
          aria-invalid={Boolean(errors.email)}
          required
        />
      </Field>

      {collectBirthday ? (
        <Field label={copy.join.birthday} htmlFor="birthdayDay" help={copy.join.birthdayHelp}>
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <input
              id="birthdayDay"
              name="birthdayDay"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              placeholder={copy.join.day}
              className={inputClass}
              aria-label={copy.join.day}
            />
            <select
              id="birthdayMonth"
              name="birthdayMonth"
              className={inputClass}
              aria-label={copy.join.month}
              defaultValue=""
            >
              <option value="">{copy.join.month}</option>
              {copy.months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </Field>
      ) : null}

      {questions.map((question) => (
        <Field key={question.id} label={question.prompt} htmlFor={`q-${question.id}`}>
          {question.type === 'single_choice' && question.options.length > 0 ? (
            <select
              id={`q-${question.id}`}
              name={`q-${question.id}`}
              className={inputClass}
              defaultValue=""
            >
              <option value="">{copy.join.choose}</option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`q-${question.id}`}
              name={`q-${question.id}`}
              type="text"
              maxLength={280}
              className={inputClass}
              required={question.isRequired}
            />
          )}
        </Field>
      ))}

      <label className="flex items-start gap-3 text-[14px] leading-snug text-[var(--color-ink)]">
        <input
          type="checkbox"
          name="consent"
          defaultChecked
          className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-[var(--color-line)] accent-[var(--color-primary)]"
        />
        <span>{copy.join.consent}</span>
      </label>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-[10px] bg-[#FBEBEA] px-3.5 py-3 text-[14px] text-[var(--color-danger)]"
        >
          {errors.form}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        style={{ background: accentColor }}
        className={[
          'w-full rounded-[10px] px-4 py-3.5 text-[16px] font-semibold text-[#14171A]',
          'transition-transform duration-150 active:scale-[0.985]',
          'disabled:cursor-progress disabled:opacity-70',
        ].join(' ')}
      >
        {submitting ? copy.join.submitting : copy.join.submit}
      </button>

      <p className="text-center text-[12px] leading-snug text-[var(--color-ink-muted)]">
        {copy.join.terms}
      </p>
    </form>
  )
}
