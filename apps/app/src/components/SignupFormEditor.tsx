'use client'

import { api } from '@/lib/api-client'
import { MAX_PROFILE_QUESTIONS, PROFILE_QUESTION_TYPES } from '@volvia/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass } from './ui'

export interface ProfileQuestion {
  id: string
  prompt: string
  type: string
  options: string[]
  isRequired: boolean
}

interface Draft {
  id?: string
  prompt: string
  type: string
  options: string[]
  isRequired: boolean
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Respuesta corta',
  single_choice: 'Elegir una opción',
  date: 'Una fecha',
}

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * How hard the signup form is to get through.
 *
 * Every extra field costs signups, and a business cannot feel that from the inside —
 * they only see the data they wanted. Putting a number on it makes the trade visible
 * at the moment they are about to add one more question.
 */
function ease(fieldCount: number): { label: string; help: string; tone: string; score: number } {
  if (fieldCount <= 2) {
    return {
      score: 100,
      label: 'Muy fácil',
      tone: 'bg-[#E4F1EA] text-[var(--color-success)]',
      help: 'Casi nadie abandona un formulario así.',
    }
  }
  if (fieldCount === 3) {
    return {
      score: 75,
      label: 'Fácil',
      tone: 'bg-[#E4F1EA] text-[var(--color-success)]',
      help: 'Buen equilibrio entre lo que pides y lo que la gente completa.',
    }
  }
  if (fieldCount === 4) {
    return {
      score: 50,
      label: 'Empieza a pesar',
      tone: 'bg-[var(--color-accent-soft)] text-[var(--color-warning)]',
      help: 'Cada campo de más cuesta altas. Quita lo que no vayas a usar.',
    }
  }
  return {
    score: 25,
    label: 'Pesado',
    tone: 'bg-[#FBEBEA] text-[var(--color-danger)]',
    help: 'Mucha gente se irá a medio llenar. Pide el resto más adelante.',
  }
}

/**
 * The form a customer fills in at the counter, with their phone in one hand.
 *
 * Questions belong to the business and are reused across cards; each card then chooses
 * which of them to ask. That way a question written once can be asked on the card
 * where it makes sense and left off the one where it does not.
 */
export function SignupFormEditor({
  questions,
  selectedIds,
  collectBirthday,
  onChange,
}: {
  questions: ProfileQuestion[]
  selectedIds: string[]
  collectBirthday: boolean
  onChange: (patch: { signupQuestionIds?: string[]; collectBirthday?: boolean }) => void
}) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>(questions)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Name and email are always asked; the rest is the business's choice.
  const fieldCount = 2 + (collectBirthday ? 1 : 0) + selectedIds.length
  const meter = ease(fieldCount)

  async function saveQuestions(next: Draft[]) {
    setSaving(true)
    setError(null)
    try {
      // The endpoint replaces the whole list, so it takes the array itself.
      await api.put(
        '/v1/org/profile-questions',
        next.map((draft) => ({
          prompt: draft.prompt.trim(),
          type: draft.type,
          options: draft.options.filter((option) => option.trim().length > 0),
          isRequired: draft.isRequired,
          askOn: 'signup',
        })),
      )
      router.refresh()
    } catch {
      setError('No pudimos guardar las preguntas.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-[10px] px-3.5 py-3 ${meter.tone}`}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] font-semibold">Alta {meter.label.toLowerCase()}</p>
          <p className="tabular text-[13px]">{fieldCount} campos</p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
          <div
            className="h-full rounded-full bg-current transition-[width] duration-300"
            style={{ width: `${meter.score}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] leading-snug">{meter.help}</p>
      </div>

      <ul className="flex flex-col gap-2 text-[14px]">
        <li className="flex items-center justify-between gap-3 rounded-[9px] bg-[var(--color-surface-muted)] px-3.5 py-2.5">
          <span>Nombre y correo</span>
          <span className="text-[13px] text-[var(--color-ink-muted)]">Siempre</span>
        </li>
        <li>
          <label className="flex items-center justify-between gap-3 rounded-[9px] border border-[var(--color-line)] px-3.5 py-2.5">
            <span>Cumpleaños</span>
            <input
              type="checkbox"
              checked={collectBirthday}
              onChange={(event) => onChange({ collectBirthday: event.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>
        </li>
        {questions.map((question) => (
          <li key={question.id}>
            <label className="flex items-center justify-between gap-3 rounded-[9px] border border-[var(--color-line)] px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="block truncate">{question.prompt}</span>
                <span className="block text-[13px] text-[var(--color-ink-muted)]">
                  {TYPE_LABELS[question.type] ?? question.type}
                </span>
              </span>
              <input
                type="checkbox"
                checked={selectedIds.includes(question.id)}
                onChange={(event) =>
                  onChange({
                    signupQuestionIds: event.target.checked
                      ? [...selectedIds, question.id]
                      : selectedIds.filter((id) => id !== question.id),
                  })
                }
                className="size-4 shrink-0 accent-[var(--color-primary)]"
              />
            </label>
          </li>
        ))}
      </ul>

      <details className="rounded-[10px] border border-[var(--color-line)]">
        <summary className="cursor-pointer px-3.5 py-2.5 text-[14px] font-medium">
          Tus preguntas
        </summary>
        <div className="border-t border-[var(--color-line)] p-3.5">
          <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            Hasta {MAX_PROFILE_QUESTIONS}. Escríbelas una vez y elige en cada tarjeta cuáles
            preguntar.
          </p>

          <ul className="flex flex-col gap-3">
            {drafts.map((draft, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: drafts are positional until saved
              <li key={index} className="flex flex-col gap-2">
                <input
                  value={draft.prompt}
                  onChange={(event) =>
                    setDrafts(
                      drafts.map((item, i) =>
                        i === index ? { ...item, prompt: event.target.value } : item,
                      ),
                    )
                  }
                  maxLength={140}
                  placeholder="¿Cómo nos conociste?"
                  aria-label={`Pregunta ${index + 1}`}
                  className={field}
                />
                <div className="flex items-center gap-2">
                  <select
                    value={draft.type}
                    onChange={(event) =>
                      setDrafts(
                        drafts.map((item, i) =>
                          i === index ? { ...item, type: event.target.value } : item,
                        ),
                      )
                    }
                    aria-label={`Tipo de la pregunta ${index + 1}`}
                    className={field}
                  >
                    {PROFILE_QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type] ?? type}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDrafts(drafts.filter((_, i) => i !== index))}
                    aria-label={`Quitar la pregunta ${index + 1}`}
                    className={buttonClass('ghost', 'sm')}
                  >
                    Quitar
                  </button>
                </div>

                {draft.type === 'single_choice' ? (
                  <input
                    value={draft.options.join(', ')}
                    onChange={(event) =>
                      setDrafts(
                        drafts.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                options: event.target.value.split(',').map((o) => o.trim()),
                              }
                            : item,
                        ),
                      )
                    }
                    placeholder="Opciones separadas por coma"
                    aria-label={`Opciones de la pregunta ${index + 1}`}
                    className={field}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          {error ? (
            <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {drafts.length < MAX_PROFILE_QUESTIONS ? (
              <button
                type="button"
                onClick={() =>
                  setDrafts([
                    ...drafts,
                    { prompt: '', type: 'text', options: [], isRequired: false },
                  ])
                }
                className={buttonClass('secondary', 'sm')}
              >
                Añadir pregunta
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => saveQuestions(drafts.filter((draft) => draft.prompt.trim()))}
              className={buttonClass('primary', 'sm')}
            >
              {saving ? 'Guardando' : 'Guardar preguntas'}
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}
