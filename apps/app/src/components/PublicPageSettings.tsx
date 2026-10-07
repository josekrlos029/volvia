'use client'

import { api } from '@/lib/api-client'
import { SOCIAL_PLATFORMS } from '@volvia/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

interface SocialLink {
  platform: string
  url: string
  label?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  x: 'X',
  youtube: 'YouTube',
  website: 'Tu web',
  menu: 'La carta',
  booking: 'Reservas',
}

/** WhatsApp takes a number, everything else takes a link. */
const PLATFORM_PLACEHOLDER: Record<string, string> = {
  whatsapp: 'https://wa.me/573001234567',
  telegram: 'https://t.me/tunegocio',
  instagram: 'https://instagram.com/tunegocio',
  menu: 'https://...',
}

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

/**
 * The page a customer lands on from a QR or a bio link.
 *
 * It is often the only website a small business has, so the things that matter are the
 * ones that get someone to write or walk in: the links they already use, the colour
 * that looks like them, and a button that says what the business would say.
 */
export function PublicPageSettings({
  links,
  brandColor,
  ctaLabel,
  publicUrl,
}: {
  links: SocialLink[]
  brandColor: string
  ctaLabel: string
  publicUrl: string
}) {
  const router = useRouter()
  const [value, setValue] = useState({ links, brandColor, ctaLabel })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setStatus('saving')
    setError(null)
    try {
      await api.patch('/v1/org', {
        brandColor: value.brandColor,
        socialLinks: value.links
          .filter((link) => link.url.trim().length > 0)
          .map((link) => ({
            platform: link.platform,
            url: link.url.trim(),
            ...(link.label?.trim() ? { label: link.label.trim() } : {}),
          })),
        settings: { pageCtaLabel: value.ctaLabel.trim() },
      })
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch {
      setStatus('idle')
      setError('No pudimos guardar. Revisa que los enlaces estén completos.')
    }
  }

  return (
    <Panel
      title="Tu página pública"
      action={
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Verla
        </a>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="brand-color" className="text-[14px] font-medium">
              Color de tu marca
            </label>
            <div className="flex items-center gap-2">
              <input
                id="brand-color"
                type="color"
                value={value.brandColor}
                onChange={(event) => setValue({ ...value, brandColor: event.target.value })}
                className="h-10 w-14 rounded-[9px] border border-[var(--color-line)]"
              />
              <input
                value={value.brandColor}
                onChange={(event) => setValue({ ...value, brandColor: event.target.value })}
                aria-label="Color en hexadecimal"
                className={field}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cta-label" className="text-[14px] font-medium">
              Texto del botón
            </label>
            <input
              id="cta-label"
              value={value.ctaLabel}
              onChange={(event) => setValue({ ...value, ctaLabel: event.target.value })}
              maxLength={40}
              placeholder="Obtener mi tarjeta"
              className={field}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-medium">Enlaces</p>
          <p className="text-[13px] leading-snug text-[var(--color-ink-muted)]">
            WhatsApp, tu Instagram, la carta, reservas. Lo que ya usas.
          </p>

          <ul className="mt-1 flex flex-col gap-2">
            {value.links.map((link, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: links are ordered by position
              <li key={index} className="flex flex-wrap items-center gap-2">
                <select
                  value={link.platform}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      links: value.links.map((item, i) =>
                        i === index ? { ...item, platform: event.target.value } : item,
                      ),
                    })
                  }
                  aria-label={`Tipo del enlace ${index + 1}`}
                  className="w-[130px] rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2.5 text-[14px]"
                >
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {PLATFORM_LABELS[platform] ?? platform}
                    </option>
                  ))}
                </select>

                <input
                  value={link.url}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      links: value.links.map((item, i) =>
                        i === index ? { ...item, url: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder={PLATFORM_PLACEHOLDER[link.platform] ?? 'https://...'}
                  aria-label={`Dirección del enlace ${index + 1}`}
                  className={`${field} min-w-[200px] flex-1`}
                />

                <input
                  value={link.label ?? ''}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      links: value.links.map((item, i) =>
                        i === index ? { ...item, label: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="Nombre (opcional)"
                  aria-label={`Nombre del enlace ${index + 1}`}
                  className="w-[150px] rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2.5 text-[14px]"
                />

                <button
                  type="button"
                  onClick={() =>
                    setValue({ ...value, links: value.links.filter((_, i) => i !== index) })
                  }
                  aria-label={`Quitar el enlace ${index + 1}`}
                  className={buttonClass('ghost', 'sm')}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>

          {value.links.length < 9 ? (
            <button
              type="button"
              onClick={() =>
                setValue({ ...value, links: [...value.links, { platform: 'whatsapp', url: '' }] })
              }
              className={`${buttonClass('secondary', 'sm')} mt-1 self-start`}
            >
              Añadir enlace
            </button>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[9px] bg-[#FBEBEA] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className={buttonClass('primary')}
          >
            {status === 'saving' ? 'Guardando' : 'Guardar'}
          </button>
          {status === 'saved' ? (
            <span className="text-[14px] text-[var(--color-success)]">Cambios guardados</span>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
