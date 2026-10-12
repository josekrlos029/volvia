'use client'

import { hexWithAlpha } from '@volvia/ui'
import { type PassArtwork, lockupSvg, stripSvg, tileSvg } from '@volvia/wallet/render'
import type { PreviewDesign } from './CardPreview'

type PassContentForArt = Parameters<typeof stripSvg>[0]

/**
 * The card as Apple Wallet and Google Wallet will show it.
 *
 * The pictures are drawn by the same functions the server uses to build the passes, so
 * the strip, the lockup and the round logo here are the real ones; only the text around
 * them is laid out by hand, following each wallet's fixed template.
 */
export function WalletPreview({
  platform,
  design,
  businessName,
  cardName,
  stampsRequired,
  filled,
  rewards,
}: {
  platform: 'apple' | 'google'
  design: PreviewDesign
  businessName: string
  cardName: string
  stampsRequired: number
  filled: number
  rewards: Array<{ atStamp: number; title: string }>
}) {
  const sorted = [...rewards].sort((a, b) => a.atStamp - b.atStamp)
  const next = sorted.find((reward) => reward.atStamp > filled) ?? null
  const complete = filled >= stampsRequired
  const rewardTitle = (complete ? sorted.at(-1)?.title : next?.title) || 'Tu recompensa'
  const remaining = Math.max((next?.atStamp ?? stampsRequired) - filled, 0)

  // Only what the drawing functions read; the rest of a pass does not reach the pictures.
  const content = {
    stampsCount: filled,
    stampsRequired,
    rewardPositions: sorted.map((reward) => reward.atStamp),
    backgroundColor: design.backgroundColor,
    foregroundColor: design.foregroundColor,
    labelColor: design.accentColor,
    emptyStampColor: design.emptyStampColor,
    stampIcon: design.stampIcon ?? { kind: 'preset', value: 'star' },
    stampStyle: design.stampStyle,
    offer: null,
  } as unknown as PassContentForArt

  // In the browser an inline SVG loads the uploaded files by URL; the server inlines bytes.
  const artwork: PassArtwork = {
    logo: design.logoUrl ? { mime: 'image/png', dataUri: design.logoUrl } : null,
    stampIcon:
      design.stampIcon?.kind === 'image'
        ? { mime: 'image/png', dataUri: design.stampIcon.value }
        : null,
    banner: null,
  }

  const fg = design.foregroundColor
  const muted = hexWithAlpha(fg, 0.7)

  if (platform === 'apple') {
    return (
      <div
        className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[14px] shadow-[0_12px_40px_-12px_rgba(15,23,42,0.45)]"
        style={{ background: design.backgroundColor, color: fg }}
      >
        <div className="flex items-center justify-between gap-3 px-3.5 pb-2.5 pt-3">
          <Svg markup={lockupSvg(content, 112, 35, artwork)} className="h-[35px] w-[112px]" />
          <div className="min-w-0 text-right">
            <p
              className="truncate text-[10px] font-semibold uppercase"
              style={{ color: design.accentColor }}
            >
              {businessName}
            </p>
            <p className="tabular text-[18px] leading-tight">
              {filled}/{stampsRequired}
            </p>
          </div>
        </div>
        <Svg
          markup={stripSvg(content, 750, 246, artwork)}
          className="block aspect-[375/123] w-full"
        />
        <div className="grid grid-cols-2 gap-3 px-3.5 py-3">
          <Field
            label={complete ? 'Recompensa lista' : 'Próxima recompensa'}
            value={rewardTitle}
            labelColor={design.accentColor}
          />
          {complete ? null : (
            <Field
              label="Te faltan"
              value={`${remaining} ${remaining === 1 ? 'sello' : 'sellos'}`}
              labelColor={design.accentColor}
              align="right"
            />
          )}
        </div>
        <QrPlaceholder />
      </div>
    )
  }

  return (
    <div
      className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[20px] shadow-[0_12px_40px_-12px_rgba(15,23,42,0.45)]"
      style={{ background: design.backgroundColor, color: fg }}
    >
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Svg
          markup={tileSvg(content, 64, artwork)}
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
        />
        <p className="truncate text-[14px]">{businessName}</p>
      </div>
      <p className="px-4 pb-3 pt-3 text-[20px] leading-tight">{design.headline || cardName}</p>
      <Svg
        markup={stripSvg(content, 1032, 336, artwork)}
        className="block aspect-[1032/336] w-full"
      />
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <Field label="Sellos" value={`${filled} / ${stampsRequired}`} labelColor={muted} />
        <Field
          label={complete ? 'Recompensa lista' : 'Próxima recompensa'}
          value={complete ? 'Lista' : rewardTitle}
          labelColor={muted}
          align="right"
        />
      </div>
      <QrPlaceholder />
    </div>
  )
}

function Svg({ markup, className }: { markup: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`[&>svg]:h-full [&>svg]:w-full ${className ?? ''}`}
      // The markup comes from our own renderer, built from validated colours and URLs.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, locally generated SVG
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

function Field({
  label,
  value,
  labelColor,
  align = 'left',
}: {
  label: string
  value: string
  labelColor: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={align === 'right' ? 'min-w-0 text-right' : 'min-w-0'}>
      <p className="truncate text-[10px] font-semibold uppercase" style={{ color: labelColor }}>
        {label}
      </p>
      <p className="truncate text-[14px] leading-snug">{value}</p>
    </div>
  )
}

/** The code is the customer's own; the preview only reserves its place. */
function QrPlaceholder() {
  return (
    <div className="flex justify-center pb-4 pt-1">
      <div className="grid h-[92px] w-[92px] place-items-center rounded-[8px] bg-white">
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0F172A]" aria-hidden="true">
          <path
            d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </div>
    </div>
  )
}
