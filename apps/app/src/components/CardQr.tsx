'use client'

import { useState } from 'react'
import { buttonClass } from './ui'

/**
 * The QR a business prints. Downloading matters more than looking at it, so the
 * download options are the primary actions and the preview is just confirmation.
 */
export function CardQr({
  cardId,
  joinUrl,
  cardName,
}: { cardId: string; joinUrl: string; cardName: string }) {
  const [copied, setCopied] = useState(false)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-[220px] rounded-[12px] border border-[var(--color-line)] bg-white p-3">
        {/* Served by the API so the QR always encodes the current join link. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${apiUrl}/v1/cards/${cardId}/qr?format=svg&size=440`}
          alt={`Código QR para unirse a ${cardName}`}
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={`${apiUrl}/v1/cards/${cardId}/qr?format=png&size=1024`}
          download={`volvia-${cardName.toLowerCase().replace(/\s+/g, '-')}.png`}
          className={buttonClass('secondary', 'sm')}
        >
          Descargar PNG
        </a>
        <a
          href={`${apiUrl}/v1/cards/${cardId}/qr?format=svg&size=1024`}
          download={`volvia-${cardName.toLowerCase().replace(/\s+/g, '-')}.svg`}
          className={buttonClass('secondary', 'sm')}
        >
          Descargar SVG para imprimir
        </a>
        <button type="button" onClick={copyLink} className={buttonClass('ghost', 'sm')}>
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
      </div>

      <p className="break-all rounded-[9px] bg-[var(--color-surface-muted)] px-3 py-2 text-[12px] text-[var(--color-ink-muted)]">
        {joinUrl}
      </p>
    </div>
  )
}
