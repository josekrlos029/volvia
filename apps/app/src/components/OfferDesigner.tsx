'use client'

import {
  CAMPAIGN_BANNER_LABELS,
  CAMPAIGN_BANNER_PRESETS,
  type CampaignPassOverrideInput,
  STAMP_STYLES,
  type StampStyle,
  presetBannerDataUri,
} from '@volvia/shared'
import { CardPreview, type PreviewDesign, type PreviewOffer } from './CardPreview'
import { ImageUpload } from './ImageUpload'

const STAMP_STYLE_LABELS: Record<StampStyle | 'hidden', string> = {
  circle: 'Redondos',
  rounded: 'Redondeados',
  square: 'Cuadrados',
  badge: 'Con aro',
  hidden: 'Ocultos tras el banner',
}

/** A neutral card to preview on when the business has not designed one yet. */
const FALLBACK_DESIGN: PreviewDesign = {
  backgroundColor: '#1E3A8A',
  foregroundColor: '#FFFFFF',
  accentColor: '#FB923C',
  emptyStampColor: '#3A56A6',
  stampStyle: 'circle',
  banner: { kind: 'solid' },
  bannerPattern: 'none',
  bannerPatternOpacity: 0,
  headline: '',
  subheadline: '',
}

export function previewOfferFrom(
  value: CampaignPassOverrideInput,
  message: string | null,
): PreviewOffer {
  return {
    headerLabel: value.header,
    bannerPreset: value.banner?.kind === 'preset' ? value.banner.value : null,
    bannerUrl: value.banner?.kind === 'image' ? value.banner.url : null,
    hideStamps: value.stampStyle === 'hidden',
    stampStyle:
      value.stampStyle && value.stampStyle !== 'hidden' ? (value.stampStyle as StampStyle) : null,
    message,
  }
}

/**
 * How a campaign or a birthday takes the card over while it runs: a header, a line
 * of text, a banner behind the stamps, a stamp style, and whether the first visit
 * ends it. Shared by the campaign composer and the birthday automation, with a live
 * preview beside it so the business sees the pass it is about to change.
 */
export function OfferDesigner({
  value,
  onChange,
  design,
  businessName,
  cardName,
  stampsRequired = 8,
  rewardPositions = [8],
  previewMessage,
  idPrefix = 'offer',
}: {
  value: CampaignPassOverrideInput
  onChange: (next: CampaignPassOverrideInput) => void
  design?: PreviewDesign | null
  businessName: string
  cardName?: string
  stampsRequired?: number
  rewardPositions?: number[]
  previewMessage: string | null
  idPrefix?: string
}) {
  const previewDesign = design ?? FALLBACK_DESIGN
  const colours = {
    accent: previewDesign.accentColor,
    foreground: previewDesign.foregroundColor,
    background: previewDesign.backgroundColor,
  }

  function pickBanner(next: CampaignPassOverrideInput['banner']) {
    // Hiding the stamps without a banner would leave a blank strip; a banner with the
    // grid on top is the default once one is chosen.
    const stampStyle = next === null && value.stampStyle === 'hidden' ? null : value.stampStyle
    onChange({ ...value, banner: next, stampStyle })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Encabezado de la tarjeta
            <input
              id={`${idPrefix}-header`}
              value={value.header ?? ''}
              onChange={(event) => onChange({ ...value, header: event.target.value || null })}
              maxLength={30}
              placeholder={businessName}
              className={fieldClass}
            />
            <span className="font-normal text-[var(--color-ink-muted)]">
              Sustituye el nombre del negocio mientras dura. Si hay una recompensa lista, manda
              ella.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Texto en la tarjeta
            <input
              id={`${idPrefix}-text`}
              value={value.text ?? ''}
              onChange={(event) => onChange({ ...value, text: event.target.value || null })}
              maxLength={60}
              placeholder="Cada visita cuenta por dos"
              className={fieldClass}
            />
            <span className="font-normal text-[var(--color-ink-muted)]">
              Ocupa el sitio de la descripción de la recompensa.
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium">Banner detrás de los sellos</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => pickBanner(null)}
              aria-pressed={value.banner === null}
              className={swatchClass(value.banner === null)}
              style={{ background: previewDesign.backgroundColor }}
            >
              <span className="sr-only">Sin banner</span>
            </button>
            {CAMPAIGN_BANNER_PRESETS.map((preset) => {
              const active = value.banner?.kind === 'preset' && value.banner.value === preset
              return (
                <button
                  key={preset}
                  type="button"
                  title={CAMPAIGN_BANNER_LABELS[preset]}
                  onClick={() => pickBanner({ kind: 'preset', value: preset })}
                  aria-pressed={active}
                  className={swatchClass(active)}
                  style={{
                    backgroundImage: presetBannerDataUri(preset, 120, 40, colours),
                    backgroundSize: 'cover',
                  }}
                >
                  <span className="sr-only">{CAMPAIGN_BANNER_LABELS[preset]}</span>
                </button>
              )
            })}
          </div>
          <ImageUpload
            kind="banner"
            value={value.banner?.kind === 'image' ? value.banner.url : null}
            onChange={(url) => pickBanner(url ? { kind: 'image', url } : null)}
            label="Subir una foto"
            help="Se recorta a lo ancho de la tarjeta. Una foto apaisada funciona mejor."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Sellos durante la campaña
            <select
              id={`${idPrefix}-stamps`}
              value={value.stampStyle ?? ''}
              onChange={(event) =>
                onChange({
                  ...value,
                  stampStyle: (event.target.value ||
                    null) as CampaignPassOverrideInput['stampStyle'],
                })
              }
              className={fieldClass}
            >
              <option value="">Como siempre</option>
              {STAMP_STYLES.map((style) => (
                <option key={style} value={style}>
                  {STAMP_STYLE_LABELS[style]}
                </option>
              ))}
              <option value="hidden" disabled={value.banner === null}>
                {STAMP_STYLE_LABELS.hidden}
              </option>
            </select>
            <span className="font-normal text-[var(--color-ink-muted)]">
              Con los sellos ocultos, el conteo sigue a la vista en una esquina.
            </span>
          </label>

          <label className="flex items-start gap-3 pt-6 text-[14px]">
            <input
              id={`${idPrefix}-ends`}
              type="checkbox"
              checked={value.endsOnFirstStamp}
              onChange={(event) => onChange({ ...value, endsOnFirstStamp: event.target.checked })}
              className="mt-0.5 h-[18px] w-[18px] accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-medium">Termina con la primera visita</span>
              <span className="mt-0.5 block text-[13px] text-[var(--color-ink-muted)]">
                El primer sello o canje devuelve la tarjeta a la normalidad para ese cliente. Si no
                viene, termina en la fecha.
              </span>
            </span>
          </label>
        </div>
      </div>

      <aside>
        <p className="mb-2 text-[13px] font-medium text-[var(--color-ink-muted)]">
          Así se verá mientras dure
        </p>
        <CardPreview
          design={previewDesign}
          businessName={businessName}
          cardName={cardName ?? ''}
          stampsRequired={stampsRequired}
          rewardPositions={rewardPositions}
          offer={previewOfferFrom(value, previewMessage)}
        />
      </aside>
    </div>
  )
}

function swatchClass(active: boolean): string {
  return [
    'h-10 w-[72px] rounded-[8px] border-2 transition-colors',
    active ? 'border-[var(--color-primary)]' : 'border-[var(--color-line)] hover:border-[#B9BFB9]',
  ].join(' ')
}

const fieldClass =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] font-normal focus:border-[var(--color-primary)] focus:outline-none'
