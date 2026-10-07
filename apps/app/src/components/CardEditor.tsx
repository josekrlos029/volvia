'use client'

import { api } from '@/lib/api-client'
import {
  BANNER_PATTERNS,
  type CardMessages,
  MAX_CARD_MESSAGE_VARIANTS,
  MAX_INITIAL_STAMPS,
  STAMP_STYLES,
  pickCardMessage,
} from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { STAMP_RADIUS, hexWithAlpha, patternLayer } from '@volvia/ui'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CardPreview, type PreviewDesign } from './CardPreview'
import { type ProfileQuestion, SignupFormEditor } from './SignupFormEditor'
import { buttonClass } from './ui'

interface Reward {
  atStamp: number
  title: string
  description: string
}

export interface CardEditorValue {
  name: string
  signupQuestionIds: string[]
  stampsRequired: number
  design: PreviewDesign
  rewards: Reward[]
  terms: string
  collectBirthday: boolean
  initialStamps: number
  messages: CardMessages
  rules: { cooldownMinutes: number; dailyCap: number; kioskEnabled: boolean }
}

interface CardEditorProps {
  businessName: string
  initial: CardEditorValue
  cardId?: string
  canCustomiseBranding: boolean
  canUseKiosk: boolean
  /** The business's own signup questions, shared across its cards. */
  profileQuestions: ProfileQuestion[]
  /** A card with holders cannot change the deal people are already working towards. */
  lengthLocked: boolean
}

const STAMP_CHOICES = [4, 5, 6, 8, 9, 10, 12]

/** None, or a head start small enough that the reward is still earned. */
const HEAD_START_CHOICES = Array.from({ length: MAX_INITIAL_STAMPS + 1 }, (_, value) => value)

const STAMP_STYLE_LABELS: Record<(typeof STAMP_STYLES)[number], string> = {
  circle: 'Redondo',
  rounded: 'Redondeado',
  square: 'Cuadrado',
  badge: 'Con aro',
}

const BANNER_KIND_LABELS = {
  solid: 'Color plano',
  gradient: 'Degradado',
  image: 'Imagen',
} as const

const PATTERN_LABELS: Record<string, string> = {
  none: 'Sin textura',
  dots: 'Puntos',
  grid: 'Cuadrícula',
  diagonal: 'Diagonales',
  chevron: 'Galones',
  waves: 'Olas',
  confetti: 'Confeti',
  cross: 'Cruces',
  circles: 'Círculos',
  triangles: 'Triángulos',
  stripes: 'Rayas',
  zigzag: 'Zigzag',
  scales: 'Escamas',
  noise: 'Granulado',
}

/** Switching banner type keeps the card's own colours instead of inventing new ones. */
function defaultBanner(
  kind: 'solid' | 'gradient' | 'image',
  design: PreviewDesign,
): PreviewDesign['banner'] {
  if (kind === 'gradient') {
    return { kind: 'gradient', from: design.backgroundColor, to: design.accentColor, angle: 160 }
  }
  if (kind === 'image') {
    return { kind: 'image', url: design.banner.kind === 'image' ? design.banner.url : '' }
  }
  return { kind: 'solid' }
}

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
  profileQuestions,
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

  // The preview shows a half-filled card, so it shows the line that moment would get.
  const previewMessage = useMemo(() => {
    const shown = Math.max(value.initialStamps, Math.floor(value.stampsRequired / 2))
    return pickCardMessage(
      {
        variants: value.messages.variants.filter((line) => line.trim().length > 0),
        perStamp: Object.fromEntries(
          Object.entries(value.messages.perStamp).filter(([, line]) => line.trim().length > 0),
        ),
      },
      shown,
    )
  }, [value.messages, value.initialStamps, value.stampsRequired])

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
      initialStamps: value.initialStamps,
      messages: {
        variants: value.messages.variants.map((line) => line.trim()).filter(Boolean),
        perStamp: Object.fromEntries(
          Object.entries(value.messages.perStamp)
            .map(([stamp, line]) => [stamp, line.trim()] as const)
            .filter(([, line]) => line.length > 0),
        ),
      },
      inactivityExpiryDays: null,
      signupQuestionIds: value.signupQuestionIds,
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

          <Labelled
            label="Sellos de regalo al unirse"
            htmlFor="initial-stamps"
            help={
              lengthLocked
                ? 'No se puede cambiar: ya hay clientes con sellos en esta tarjeta.'
                : 'Una tarjeta que empieza en cero se siente como una tarea. Con uno o dos ya hechos, se siente empezada.'
            }
          >
            <div className="flex flex-wrap gap-2">
              {HEAD_START_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={lengthLocked}
                  onClick={() => update({ initialStamps: choice })}
                  className={[
                    'tabular h-10 w-11 rounded-[9px] border text-[14px] font-medium transition-colors',
                    value.initialStamps === choice
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

          <Labelled
            label="Forma del sello"
            htmlFor="stamp-style"
            help="La misma forma que verá el cliente en su teléfono."
          >
            <div className="flex flex-wrap gap-2">
              {STAMP_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  disabled={!canCustomiseBranding}
                  onClick={() => updateDesign({ stampStyle: style })}
                  aria-label={STAMP_STYLE_LABELS[style]}
                  aria-pressed={value.design.stampStyle === style}
                  className={[
                    'flex h-11 w-14 items-center justify-center rounded-[9px] border transition-colors',
                    value.design.stampStyle === style
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/25'
                      : 'border-[var(--color-line)] bg-white',
                    canCustomiseBranding ? '' : 'cursor-not-allowed opacity-50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5"
                    style={{
                      background: value.design.accentColor,
                      borderRadius: STAMP_RADIUS[style],
                      boxShadow:
                        style === 'badge'
                          ? `0 0 0 2px ${hexWithAlpha(value.design.accentColor, 0.4)}`
                          : undefined,
                    }}
                  />
                </button>
              ))}
            </div>
          </Labelled>

          <Labelled
            label="Fondo de la tarjeta"
            htmlFor="banner-kind"
            help="Un color plano, un degradado entre dos colores, o una foto tuya."
          >
            <div className="flex flex-wrap gap-2">
              {(['solid', 'gradient', 'image'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={!canCustomiseBranding}
                  onClick={() => updateDesign({ banner: defaultBanner(kind, value.design) })}
                  aria-pressed={value.design.banner.kind === kind}
                  className={[
                    'rounded-[9px] border px-3 py-2 text-[13px] font-medium transition-colors',
                    value.design.banner.kind === kind
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-[var(--color-line)] bg-white',
                    canCustomiseBranding ? '' : 'cursor-not-allowed opacity-50',
                  ].join(' ')}
                >
                  {BANNER_KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          </Labelled>

          {value.design.banner.kind === 'gradient' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Labelled label="Desde" htmlFor="gradient-from">
                <input
                  id="gradient-from"
                  type="color"
                  value={value.design.banner.from}
                  onChange={(event) =>
                    updateDesign({
                      banner: { ...value.design.banner, from: event.target.value } as never,
                    })
                  }
                  className="h-10 w-full rounded-[9px] border border-[var(--color-line)]"
                />
              </Labelled>
              <Labelled label="Hasta" htmlFor="gradient-to">
                <input
                  id="gradient-to"
                  type="color"
                  value={value.design.banner.to}
                  onChange={(event) =>
                    updateDesign({
                      banner: { ...value.design.banner, to: event.target.value } as never,
                    })
                  }
                  className="h-10 w-full rounded-[9px] border border-[var(--color-line)]"
                />
              </Labelled>
              <Labelled label="Inclinación" htmlFor="gradient-angle">
                <input
                  id="gradient-angle"
                  type="range"
                  min={0}
                  max={360}
                  value={value.design.banner.angle}
                  onChange={(event) =>
                    updateDesign({
                      banner: {
                        ...value.design.banner,
                        angle: Number(event.target.value),
                      } as never,
                    })
                  }
                  className="w-full"
                />
              </Labelled>
            </div>
          ) : null}

          {value.design.banner.kind === 'image' ? (
            <Labelled
              label="Dirección de la imagen"
              htmlFor="banner-url"
              help="Pega el enlace de una foto tuya. Se recorta al ancho de la tarjeta."
            >
              <input
                id="banner-url"
                value={value.design.banner.url}
                onChange={(event) =>
                  updateDesign({
                    banner: { kind: 'image', url: event.target.value } as never,
                  })
                }
                placeholder="https://..."
                className={fieldClass}
              />
            </Labelled>
          ) : null}

          <Labelled
            label="Textura encima"
            htmlFor="banner-pattern"
            help="Se dibuja con los colores de tu tarjeta, así que si cambias la paleta la textura te sigue."
          >
            <div className="flex flex-wrap gap-2">
              {BANNER_PATTERNS.map((pattern) => {
                const layer = patternLayer(pattern, value.design.foregroundColor, 65)
                return (
                  <button
                    key={pattern}
                    type="button"
                    disabled={!canCustomiseBranding}
                    onClick={() => updateDesign({ bannerPattern: pattern })}
                    aria-label={PATTERN_LABELS[pattern] ?? pattern}
                    aria-pressed={value.design.bannerPattern === pattern}
                    title={PATTERN_LABELS[pattern] ?? pattern}
                    className={[
                      'h-10 w-10 overflow-hidden rounded-[9px] border transition-colors',
                      value.design.bannerPattern === pattern
                        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/25'
                        : 'border-[var(--color-line)]',
                      canCustomiseBranding ? '' : 'cursor-not-allowed opacity-50',
                    ].join(' ')}
                    style={{
                      background: value.design.backgroundColor,
                      ...(layer ?? {}),
                    }}
                  />
                )
              })}
            </div>
          </Labelled>

          {value.design.bannerPattern !== 'none' ? (
            <Labelled
              label={`Intensidad de la textura: ${value.design.bannerPatternOpacity}%`}
              htmlFor="pattern-opacity"
            >
              <input
                id="pattern-opacity"
                type="range"
                min={0}
                max={60}
                value={value.design.bannerPatternOpacity}
                onChange={(event) =>
                  updateDesign({ bannerPatternOpacity: Number(event.target.value) })
                }
                className="w-full"
              />
            </Labelled>
          ) : null}

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

        <Section
          title="Lo que dice la tarjeta"
          action={
            value.messages.variants.length < MAX_CARD_MESSAGE_VARIANTS ? (
              <button
                type="button"
                onClick={() =>
                  update({
                    messages: {
                      ...value.messages,
                      variants: [...value.messages.variants, ''],
                    },
                  })
                }
                className={buttonClass('secondary', 'sm')}
              >
                Añadir frase
              </button>
            ) : null
          }
        >
          <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            Una línea debajo de los sellos. Si escribes varias, van rotando entre visitas, así la
            tarjeta no dice siempre lo mismo.
          </p>

          {value.messages.variants.length === 0 ? (
            <p className="rounded-[9px] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-[13px] text-[var(--color-ink-muted)]">
              Sin frases, la tarjeta solo muestra los sellos. Está bien, pero una frase tuya suena a
              tu negocio.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {value.messages.variants.map((variant, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the list is reordered by position
                <li key={index} className="flex items-center gap-2">
                  <input
                    value={variant}
                    onChange={(event) =>
                      update({
                        messages: {
                          ...value.messages,
                          variants: value.messages.variants.map((line, i) =>
                            i === index ? event.target.value : line,
                          ),
                        },
                      })
                    }
                    maxLength={90}
                    placeholder="Gracias por volver, la casa invita pronto"
                    aria-label={`Frase ${index + 1}`}
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        messages: {
                          ...value.messages,
                          variants: value.messages.variants.filter((_, i) => i !== index),
                        },
                      })
                    }
                    aria-label={`Quitar la frase ${index + 1}`}
                    className={buttonClass('ghost', 'sm')}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-[var(--color-line)] pt-4">
            <p className="text-[13px] font-medium">Frases para un momento exacto</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
              Estas mandan sobre las anteriores. Sirven para los dos momentos que más importan: el
              primer sello y el que falta para la recompensa.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {[0, value.stampsRequired - 1].map((stamp) => (
                <label key={stamp} className="flex items-center gap-3 text-[13px]">
                  <span className="tabular w-28 shrink-0 text-[var(--color-ink-muted)]">
                    {stamp === 0 ? 'Recién unido' : `Con ${stamp} sellos`}
                  </span>
                  <input
                    value={value.messages.perStamp[String(stamp)] ?? ''}
                    onChange={(event) =>
                      update({
                        messages: {
                          ...value.messages,
                          perStamp: {
                            ...value.messages.perStamp,
                            [String(stamp)]: event.target.value,
                          },
                        },
                      })
                    }
                    maxLength={90}
                    placeholder={
                      stamp === 0 ? 'Bienvenido, tu primer café cuenta' : '¡Una más y es tuyo!'
                    }
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>
          </div>
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

        <Section title="Qué pides al darse de alta">
          <SignupFormEditor
            questions={profileQuestions}
            selectedIds={value.signupQuestionIds}
            collectBirthday={value.collectBirthday}
            onChange={update}
          />
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
          initialStamps={value.initialStamps}
          message={previewMessage}
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
