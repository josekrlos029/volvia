'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

const COPY = {
  es: {
    label: 'Enlace o identificador de tu ficha de Google',
    help: 'Pega la dirección de tu ficha en Google Maps, o el Place ID si ya lo tienes.',
    placeholder: 'https://maps.app.goo.gl/… o ChIJ…',
    invalid: 'No reconocemos eso. Pega el enlace de tu ficha en Google Maps.',
    businessLabel: 'Nombre del negocio (sale impreso)',
    download: 'Descargar para imprimir',
    copy: 'Copiar el enlace de reseña',
    copied: 'Enlace copiado',
    printTitle: 'Déjanos tu reseña',
    printBody: 'Escanea y cuéntanos cómo te fue.',
  },
  en: {
    label: 'Link or ID of your Google listing',
    help: 'Paste your Google Maps listing address, or the Place ID if you already have it.',
    placeholder: 'https://maps.app.goo.gl/… or ChIJ…',
    invalid: 'We do not recognise that. Paste the link to your Google Maps listing.',
    businessLabel: 'Business name (it gets printed)',
    download: 'Download to print',
    copy: 'Copy the review link',
    copied: 'Link copied',
    printTitle: 'Leave us a review',
    printBody: 'Scan and tell us how it went.',
  },
} as const

/**
 * Turns a Google listing into a printable review QR.
 *
 * Everything happens in the browser: the shop's listing never reaches our servers,
 * which is both the honest thing to do and the reason this needs no account.
 */
function reviewUrlFrom(input: string): string | null {
  const value = input.trim()
  if (!value) return null

  // A Place ID pasted straight in.
  if (/^ChI[A-Za-z0-9_-]{10,}$/.test(value)) {
    return `https://search.google.com/local/writereview?placeid=${value}`
  }

  // Any Google Maps or share link: send people to the listing's review flow.
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)/i.test(value)) {
    const placeId = value.match(/place_id[:=]([A-Za-z0-9_-]+)/)?.[1]
    return placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : value
  }

  return null
}

export function ReviewQrGenerator({ locale }: { locale: 'es' | 'en' }) {
  const copy = COPY[locale]
  const [input, setInput] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reviewUrl = reviewUrlFrom(input)
  const showError = input.trim().length > 6 && reviewUrl === null

  useEffect(() => {
    if (!reviewUrl) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(reviewUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 600,
      color: { dark: '#10120F', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [reviewUrl])

  const field = 'field'

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-[14px]">
          {copy.label}
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={copy.placeholder}
            className={field}
          />
          <span className="text-[13px] font-normal text-[var(--color-ink-muted)]">{copy.help}</span>
        </label>

        <label className="flex flex-col gap-2 text-[14px]">
          {copy.businessLabel}
          <input
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            maxLength={40}
            className={field}
          />
        </label>

        {showError ? (
          <p role="alert" className="text-[14px] text-[var(--color-danger)]">
            {copy.invalid}
          </p>
        ) : null}

        {reviewUrl ? (
          <div className="flex flex-wrap gap-3">
            {dataUrl ? (
              <a
                href={dataUrl}
                download={`resenas-${(businessName || 'negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                className="btn-primary"
              >
                {copy.download}
              </a>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(reviewUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2_000)
                } catch {
                  setCopied(false)
                }
              }}
              className="btn-ghost"
            >
              {copied ? copy.copied : copy.copy}
            </button>
          </div>
        ) : null}
      </div>

      {/* The printable card, previewed exactly as it downloads. */}
      <div className="flex justify-center lg:justify-end">
        <div className="w-full max-w-[320px] rounded-[16px] border border-[var(--color-line)] bg-white p-7 text-center">
          <p className="text-[13px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
            {businessName || copy.printTitle}
          </p>
          <div className="mt-5 grid aspect-square place-items-center rounded-[16px] bg-[var(--color-surface-muted)]">
            {dataUrl ? (
              /* A data URL built in this browser: next/image has nothing to optimise. */
              <img src={dataUrl} alt="" className="h-full w-full rounded-[16px]" />
            ) : (
              <span className="px-6 text-[14px] leading-snug text-[var(--color-ink-muted)]">
                {copy.help}
              </span>
            )}
          </div>
          <p className="mt-5 text-[17px] leading-snug">{copy.printTitle}</p>
          <p className="mt-1.5 text-[14px] leading-snug text-[var(--color-ink-muted)]">
            {copy.printBody}
          </p>
        </div>
      </div>
    </div>
  )
}
