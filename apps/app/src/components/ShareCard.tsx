'use client'

import { useState } from 'react'
import { buttonClass } from './ui'

/**
 * Getting the card in front of people.
 *
 * Three things a business actually does with a loyalty card: put the QR on the counter,
 * send the link to a customer who asked, and share the page. Each is one tap here
 * instead of a trip through the card editor.
 */
export function ShareCard({
  joinUrl,
  publicUrl,
  cardId,
}: {
  joinUrl: string
  publicUrl: string
  cardId: string | null
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 2_000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(joinUrl, 'tarjeta')}
          className={buttonClass('secondary', 'sm')}
        >
          {copied === 'tarjeta' ? 'Enlace copiado' : 'Copiar enlace de la tarjeta'}
        </button>
        <button
          type="button"
          onClick={() => copy(publicUrl, 'pagina')}
          className={buttonClass('secondary', 'sm')}
        >
          {copied === 'pagina' ? 'Enlace copiado' : 'Copiar tu página'}
        </button>
        {cardId ? (
          <a href={`/cards/${cardId}`} className={buttonClass('secondary', 'sm')}>
            Imprimir el QR
          </a>
        ) : null}
      </div>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Únete a nuestra tarjeta de sellos: ${joinUrl}`)}`}
        target="_blank"
        rel="noreferrer noopener"
        className="text-[13px] font-medium text-[var(--color-primary)] underline underline-offset-2"
      >
        Enviar por WhatsApp
      </a>
    </div>
  )
}
