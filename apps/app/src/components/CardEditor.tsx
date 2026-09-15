'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CardPreview, type PreviewDesign } from './CardPreview'
import { buttonClass } from './ui'

interface Reward {
  atStamp: number
  title: string
  description: string
}

export interface CardEditorValue {
  name: string
  stampsRequired: number
  design: PreviewDesign
  rewards: Reward[]
  terms: string
  collectBirthday: boolean
  rules: { cooldownMinutes: number; dailyCap: number; kioskEnabled: boolean }
}

interface CardEditorProps {
  businessName: string
  initial: CardEditorValue
  cardId?: string
  canCustomiseBranding: boolean
  canUseKiosk: boolean
  /** A card with holders cannot change length without moving everyone's finish line. */
  lengthLocked: boolean
}

const STAMP_CHOICES = [4, 5, 6, 8, 9, 10, 12]

const PALETTES = [
  { name: 'Carbón', background: '#14171A', accent: '#E9A23B', empty: '#31363A' },
  { name: 'Bosque', background: '#123227', accent: '#7FD1A8', empty: '#2A4A3E' },
  { name: 'Vino', background: '#2A1216', accent: '#E9A23B', empty: '#472328' },
  { name: 'Arena', background: '#F4EEE4', accent: '#16624A', empty: '#D8CFC0' },
  { name: 'Índigo', background: '#141B2E', accent: '#8FA8FF', empty: '#2C3550' },
]

export function CardEditor({
  businessName,
  initial,
  cardId,
  canCustomiseBranding,
  canUseKiosk,
  lengthLocked,
}: CardEditorProps) {
  const router = useRouter()
  const [value, setValue] = useState<CardEditorValue>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rewardPositions = useMemo(
    () => value.rewards.map((reward) => reward.atStamp),
    [value.rewards],
  )

  function update(patch: Partial<CardEditorValue>) {
    setValue((current) => ({ ...current, ...patch }))
  }

  function updateDesign(patch: Partial<PreviewDesign>) {
    setValue((current) => ({ ...current, design: { ...current.design, ...patch } }))
  }

  /**
   * Changing the card length has to move the final reward with it, otherwise the card
   * silently ends up with a reward nobody can reach.
   */
  function setStampsRequired(next: number) {
    setValue((current) => {
      const rewards = current.rewards
        .filter((reward) => reward.atStamp < next)
        .concat(
          current.rewards.length > 0
            ? [{ ...current.rewards.at(-1)!, atStamp: next }]
            : [{ atStamp: next, title: '', description: '' }],
        )
      // Keep positions unique and ordered after the shuffle.
      const unique = new Map(rewards.map((reward) => [reward.atStamp, reward]))
      return {
        ...current,
        stampsRequired: next,
        rewards: [...unique.values()].sort((a, b) => a.atStamp - b.atStamp),
      }
    })
  }

  function updateReward(index: number, patch: Partial<Reward>) {
    setValue((current) => ({
      ...current,
      rewards: current.rewards.map((reward, i) => (i === index ? { ...reward, ...patch } : reward)),
    }))
  }

  function addReward() {
    setValue((current) => {
      const taken = new Set(current.rewards.map((reward) => reward.atStamp))
      const position = Array.from({ length: current.stampsRequired }, (_, i) => i + 1).find(
        (candidate) => !taken.has(candidate),
      )
      if (!position) return current
      return {
        ...current,
        rewards: [...current.rewards, { atStamp: position, title: '', description: '' }].sort(
          (a, b) => a.atStamp - b.atStamp,
        ),
      }
    })
  }

  function removeReward(index: number) {
    setValue((current) => ({ ...current, rewards: current.rewards.filter((_, i) => i !== index) }))
  }

  async function save() {
    setError(null)

    const finalReward = value.rewards.find((reward) => reward.atStamp === value.stampsRequired)
    if (!finalReward?.title.trim()) {
      setError('El último sello necesita una recompensa con nombre.')
      return
    }
    if (value.rewards.some((reward) => !reward.title.trim())) {
      setError('Todas las recompensas necesitan un nombre.')
      return
    }

    setSaving(true)
    const payload = {
      name: value.name,
      stampsRequired: value.stampsRequired,
      design: value.design,
      rules: value.rules,
      rewards: value.rewards.map((reward) => ({
        atStamp: reward.atStamp,
        title: reward.title.trim(),
        description: reward.description.trim(),
        kind: 'free_item' as const,
        isRepeating: true,
        expiresInDays: null,
      })),
      terms: value.terms,
      collectBirthday: value.collectBirthday,
      inactivityExpiryDays: null,
      signupQuestionIds: [],
    }

    try {
      if (cardId) {
        await api.patch(`/v1/cards/${cardId}`, payload)
        router.refresh()
      } else {
        const created = await api.post<{ id: string }>('/v1/cards', payload)
        router.push(`/cards/${created.id}`)
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.isPlanLimit
            ? `Tu plan no permite esto. ${caught.upgradeTo ? `Disponible desde el plan ${caught.upgradeTo}.` : ''}`
            : caught.message
          : 'No pudimos guardar la tarjeta.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="flex flex-col gap-5">
        <Section title="Lo básico">
          <Labelled label="Nombre de la tarjeta" htmlFor="card-name">
            <input
              id="card-name"
              value={value.name}
              onChange={(event) => update({ name: event.target.value })}
              maxLength={80}
              className={fieldClass}
              placeholder="Club de la casa"
            />
          </Labelled>

          <Labelled
            label="Sellos para completar"
            htmlFor="stamps"
            help={
              lengthLocked
                ? 'No se puede cambiar: ya hay clientes con sellos en esta tarjeta.'
                : 'Entre 6 y 10 funciona mejor para la mayoría de negocios.'
            }
          >
            <div className="flex flex-wrap gap-2">
              {STAMP_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={lengthLocked}
                  onClick={() => setStampsRequired(choice)}
                  className={[
                    'tabular h-10 w-11 rounded-[9px] border text-[14px] font-medium transition-colors',
                    value.stampsRequired === choice
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]',
                    lengthLocked ? 'cursor-not-allowed opacity-50' : '',
                  ].join(' ')}
                >
                  {choice}
                </button>
              ))}
            </div>
          </Labelled>
        </Section>

        <Section
          title="Recompensas"
          action={
            value.rewards.length < value.stampsRequired ? (
              <button type="button" onClick={addReward} className={buttonClass('secondary', 'sm')}>
                Añadir
              </button>
            ) : null
          }
        >
          <ul className="flex flex-col gap-4">
            {value.rewards.map((reward, index) => {
              const isFinal = reward.atStamp === value.stampsRequired
              return (
                // Keyed by position, not index: the list re-sorts when a position
                // changes, and an index key would rebind inputs to the wrong reward.
                <li
                  key={reward.atStamp}
                  className="rounded-[10px] border border-[var(--color-line)] p-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--color-ink-muted)]">
                      En el sello
                      <select
                        value={reward.atStamp}
                        onChange={(event) =>
                          updateReward(index, { atStamp: Number(event.target.value) })
                        }
                        disabled={isFinal}
                        className="tabular rounded-[7px] border border-[var(--color-line)] px-2 py-1 text-[13px] disabled:opacity-60"
                      >
                        {Array.from({ length: value.stampsRequired }, (_, i) => i + 1).map(
                          (position) => (
                            <option key={position} value={position}>
                              {position}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    {isFinal ? (
                      <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                        Recompensa final
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeReward(index)}
                        className="text-[13px] text-[var(--color-danger)] underline underline-offset-2"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <input
                    value={reward.title}
                    onChange={(event) => updateReward(index, { title: event.target.value })}
                    maxLength={80}
                    placeholder="Café gratis"
                    className={`${fieldClass} mt-3`}
                    aria-label={`Recompensa en el sello ${reward.atStamp}`}
                  />
                  <input
                    value={reward.description}
                    onChange={(event) => updateReward(index, { description: event.target.value })}
                    maxLength={200}
                    placeholder="Detalle opcional"
                    className={`${fieldClass} mt-2`}
                    aria-label="Detalle de la recompensa"
                  />
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title="Diseño">
          {!canCustomiseBranding ? (
            <p className="mb-4 rounded-[9px] bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-warning)]">
              Con el plan Gratis la tarjeta usa los colores por defecto. Los colores propios llegan
              con el plan Pro.
            </p>
          ) : null}

          <Labelled label="Paleta" htmlFor="palette">
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  type="button"
                  disabled={!canCustomiseBranding}
                  onClick={() =>
                    updateDesign({
                      backgroundColor: palette.background,
                      accentColor: palette.accent,
                      emptyStampColor: palette.empty,
                      foregroundColor: palette.background === '#F4EEE4' ? '#14171A' : '#FFFFFF',
                    })
                  }
                  aria-label={palette.name}
                  className={[
                    'flex h-10 w-14 items-center justify-center gap-1 rounded-[9px] border transition-colors',
                    value.design.backgroundColor === palette.background
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/25'
                      : 'border-[var(--color-line)]',
                    canCustomiseBranding ? '' : 'cursor-not-allowed opacity-50',
                  ].join(' ')}
                  style={{ background: palette.background }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: palette.accent }} />
                </button>
              ))}
            </div>
          </Labelled>

          <Labelled label="Título en la tarjeta" htmlFor="headline">
            <input
              id="headline"
              value={value.design.headline}
              onChange={(event) => updateDesign({ headline: event.target.value })}
              maxLength={60}
              placeholder={value.name}
              className={fieldClass}
            />
          </Labelled>

          <Labelled label="Línea de apoyo" htmlFor="subheadline">
            <input
              id="subheadline"
              value={value.design.subheadline}
              onChange={(event) => updateDesign({ subheadline: event.target.value })}
              maxLength={120}
              placeholder="Suma sellos y gana recompensas"
              className={fieldClass}
            />
          </Labelled>
        </Section>

        <Section title="Reglas de sellado">
          <Labelled
            label="Espera entre sellos"
            htmlFor="cooldown"
            help="Evita que una misma persona sume varios sellos en la misma visita."
          >
            <select
              id="cooldown"
              value={value.rules.cooldownMinutes}
              onChange={(event) =>
                update({ rules: { ...value.rules, cooldownMinutes: Number(event.target.value) } })
              }
              className={fieldClass}
            >
              <option value={0}>Sin espera</option>
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={240}>4 horas</option>
              <option value={1440}>1 día</option>
            </select>
          </Labelled>

          <Labelled label="Máximo de sellos por día" htmlFor="dailyCap">
            <select
              id="dailyCap"
              value={value.rules.dailyCap}
              onChange={(event) =>
                update({ rules: { ...value.rules, dailyCap: Number(event.target.value) } })
              }
              className={fieldClass}
            >
              {[1, 2, 3, 5, 10].map((cap) => (
                <option key={cap} value={cap}>
                  {cap}
                </option>
              ))}
            </select>
          </Labelled>

          <label className="flex items-start gap-3 text-[14px]">
            <input
              type="checkbox"
              checked={value.rules.kioskEnabled}
              disabled={!canUseKiosk}
              onChange={(event) =>
                update({ rules: { ...value.rules, kioskEnabled: event.target.checked } })
              }
              className="mt-0.5 h-[18px] w-[18px] accent-[var(--color-primary)] disabled:opacity-50"
            />
            <span>
              Modo kiosko
              <span className="block text-[13px] text-[var(--color-ink-muted)]">
                El cliente escanea una pantalla y se sella solo. El código cambia cada 30 segundos.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Términos">
          <textarea
            value={value.terms}
            onChange={(event) => update({ terms: event.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="Un sello por visita. No acumulable con otras promociones."
            className={fieldClass}
            aria-label="Términos del programa"
          />
        </Section>

        {error ? (
          <p
            role="alert"
            className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <button type="button" onClick={save} disabled={saving} className={buttonClass('primary')}>
            {saving ? 'Guardando' : cardId ? 'Guardar cambios' : 'Crear tarjeta'}
          </button>
        </div>
      </div>

      {/* The preview follows the form on desktop so a colour change is visible instantly. */}
      <aside className="lg:sticky lg:top-8">
        <p className="mb-2 text-[13px] font-medium text-[var(--color-ink-muted)]">
          Así la ve tu cliente
        </p>
        <CardPreview
          design={value.design}
          businessName={businessName}
          cardName={value.name}
          stampsRequired={value.stampsRequired}
          rewardPositions={rewardPositions}
        />
      </aside>
    </div>
  )
}

const fieldClass =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[12px] border border-[var(--color-line)] bg-white p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {action}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Labelled({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string
  htmlFor: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[14px] font-medium">
        {label}
      </label>
      {children}
      {help ? (
        <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">{help}</p>
      ) : null}
    </div>
  )
}
