'use client'

import { useState } from 'react'
import { buttonClass } from './ui'

/**
 * The one link a business shares: on the counter as a QR, in a bio, in a WhatsApp.
 * It never changes, whatever the business edits on the page behind it.
 */
export function PageLinkCard({ publicUrl, views30d }: { publicUrl: string; views30d: number }) {
  const [copied, setCopied] = useState(false)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  const qr = (size: number) => `${apiUrl}/p/qr?data=${encodeURIComponent(publicUrl)}&size=${size}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="flex flex-col gap-3">
        <p className="break-all rounded-[9px] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-[14px]">
          {publicUrl}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLink} className={buttonClass('primary', 'sm')}>
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonClass('secondary', 'sm')}
          >
            Verla
          </a>
          <a
            href={qr(1024)}
            download="volvia-tu-pagina.svg"
            className={buttonClass('secondary', 'sm')}
          >
            Imprimir el QR de tu página
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Mira nuestra página: ${publicUrl}`)}`}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonClass('ghost', 'sm')}
          >
            Enviar por WhatsApp
          </a>
        </div>
        <p className="tabular text-[14px] text-[var(--color-ink-muted)]">
          <span className="font-semibold text-[var(--color-ink)]">{views30d}</span>{' '}
          {views30d === 1 ? 'visita' : 'visitas'} en 30 días
        </p>
      </div>
      <div className="mx-auto w-[132px] rounded-[12px] border border-[var(--color-line)] bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr(264)} alt="Código QR de tu página" className="w-full" />
      </div>
    </div>
  )
}
