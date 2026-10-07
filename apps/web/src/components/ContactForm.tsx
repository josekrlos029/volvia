'use client'

import { CONTACT_TOPICS } from '@volvia/shared'
import { useState } from 'react'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const COPY = {
  es: {
    name: 'Tu nombre',
    email: 'Tu correo',
    business: 'Tu negocio',
    businessHelp: 'Opcional, pero ayuda a contestarte mejor.',
    topic: 'Sobre qué',
    message: 'Cuéntanos',
    messagePlaceholder:
      'Qué negocio tienes, qué estás intentando resolver y qué te falta por entender.',
    submit: 'Enviar',
    submitting: 'Enviando',
    sentTitle: 'Recibido',
    sentBody:
      'Te contesta una persona, normalmente el mismo día. Revisa también la carpeta de no deseados.',
    error: 'No pudimos enviarlo. Prueba otra vez o escríbenos directo a hola@somosvolvia.com.',
    topics: {
      question: 'Una duda antes de empezar',
      demo: 'Ver una demostración',
      help: 'Ayuda con mi cuenta',
      press: 'Prensa o alianzas',
    },
  },
  en: {
    name: 'Your name',
    email: 'Your email',
    business: 'Your business',
    businessHelp: 'Optional, but it helps us answer properly.',
    topic: 'About what',
    message: 'Tell us',
    messagePlaceholder:
      'What kind of shop you run, what you are trying to solve, and what is still unclear.',
    submit: 'Send',
    submitting: 'Sending',
    sentTitle: 'Got it',
    sentBody: 'A person answers, usually the same day. Check your spam folder too.',
    error: 'We could not send it. Try again, or write to us directly at hola@somosvolvia.com.',
    topics: {
      question: 'A question before starting',
      demo: 'See a demo',
      help: 'Help with my account',
      press: 'Press or partnerships',
    },
  },
} as const

const field = 'field'

/**
 * The contact form.
 *
 * It reaches a person, not a ticket queue, and the page says so. The hidden field is
 * the only spam defence that does not punish a real visitor with a puzzle.
 */
export function ContactForm({
  locale,
  defaultTopic = 'question',
}: {
  locale: 'es' | 'en'
  defaultTopic?: (typeof CONTACT_TOPICS)[number]
}) {
  const copy = COPY[locale]
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (state === 'sent') {
    return (
      <div className="rounded-[16px] border border-[var(--color-primary)]/40 bg-[var(--color-surface)] p-6">
        <h2 className="text-[18px]">{copy.sentTitle}</h2>
        <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          {copy.sentBody}
        </p>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)

        setError(null)
        setState('sending')
        try {
          const response = await fetch(`${apiUrl}/p/contact`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: String(form.get('name') ?? '').trim(),
              email: String(form.get('email') ?? '').trim(),
              businessName: String(form.get('businessName') ?? '').trim(),
              topic: String(form.get('topic') ?? 'question'),
              message: String(form.get('message') ?? '').trim(),
              locale,
              website: String(form.get('website') ?? ''),
            }),
          })
          if (!response.ok) throw new Error('contact failed')
          setState('sent')
        } catch {
          setState('idle')
          setError(copy.error)
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-[14px]">
          {copy.name}
          <input name="name" required minLength={2} maxLength={80} className={field} />
        </label>
        <label className="flex flex-col gap-2 text-[14px]">
          {copy.email}
          <input name="email" type="email" required className={field} />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-[14px]">
        {copy.business}
        <input name="businessName" maxLength={120} className={field} />
        <span className="text-[13px] font-normal text-[var(--color-ink-muted)]">
          {copy.businessHelp}
        </span>
      </label>

      <label className="flex flex-col gap-2 text-[14px]">
        {copy.topic}
        <select name="topic" defaultValue={defaultTopic} className={field}>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {copy.topics[topic]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-[14px]">
        {copy.message}
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder={copy.messagePlaceholder}
          className={field}
        />
      </label>

      {/* Invisible to people, irresistible to the scripts that fill every form. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[16px] bg-[#FBEBEA] px-3.5 py-3 text-[14px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={state === 'sending'} className="btn-primary self-start">
        {state === 'sending' ? copy.submitting : copy.submit}
      </button>
    </form>
  )
}
