'use client'

import { api } from '@/lib/api-client'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

interface Org {
  name: string
  slug: string
  tagline: string
  about: string
  contactEmail: string | null
  contactPhone: string | null
  googlePlaceId: string | null
  publicUrl: string
}

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

export function BusinessSettings({ org }: { org: Org }) {
  const router = useRouter()
  const [value, setValue] = useState(org)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setStatus('saving')
    setError(null)
    try {
      await api.patch('/v1/org', {
        name: value.name,
        slug: value.slug,
        tagline: value.tagline,
        about: value.about,
        contactEmail: value.contactEmail || null,
        contactPhone: value.contactPhone || null,
        googlePlaceId: value.googlePlaceId || null,
      })
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch (caught) {
      setStatus('idle')
      setError(
        caught instanceof ApiError && caught.code === 'CONFLICT'
          ? 'Esa dirección web ya está ocupada. Prueba con otra.'
          : 'No pudimos guardar los cambios.',
      )
    }
  }

  return (
    <Panel title="Tu negocio">
      <div className="flex flex-col gap-4">
        <Labelled label="Nombre" htmlFor="org-name">
          <input
            id="org-name"
            value={value.name}
            onChange={(event) => setValue({ ...value, name: event.target.value })}
            className={field}
          />
        </Labelled>

        <Labelled
          label="Dirección de tu página"
          htmlFor="org-slug"
          help={`Tu página pública: ${value.publicUrl.replace(value.slug, '') || ''}${value.slug}`}
        >
          <input
            id="org-slug"
            value={value.slug}
            onChange={(event) =>
              setValue({
                ...value,
                slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              })
            }
            className={field}
          />
        </Labelled>

        <Labelled label="Frase corta" htmlFor="org-tagline">
          <input
            id="org-tagline"
            value={value.tagline}
            onChange={(event) => setValue({ ...value, tagline: event.target.value })}
            maxLength={120}
            className={field}
            placeholder="Café de origen, tostado aquí"
          />
        </Labelled>

        <Labelled label="Sobre el negocio" htmlFor="org-about">
          <textarea
            id="org-about"
            value={value.about}
            onChange={(event) => setValue({ ...value, about: event.target.value })}
            maxLength={600}
            rows={3}
            className={field}
          />
        </Labelled>

        <Labelled
          label="ID de tu ficha en Google"
          htmlFor="org-place"
          help="Con esto podemos pedir reseñas a tus clientes felices."
        >
          <input
            id="org-place"
            value={value.googlePlaceId ?? ''}
            onChange={(event) => setValue({ ...value, googlePlaceId: event.target.value })}
            className={field}
            placeholder="ChIJ..."
          />
        </Labelled>

        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Correo de contacto" htmlFor="org-email">
            <input
              id="org-email"
              type="email"
              value={value.contactEmail ?? ''}
              onChange={(event) => setValue({ ...value, contactEmail: event.target.value })}
              className={field}
            />
          </Labelled>
          <Labelled label="Teléfono" htmlFor="org-phone">
            <input
              id="org-phone"
              type="tel"
              value={value.contactPhone ?? ''}
              onChange={(event) => setValue({ ...value, contactPhone: event.target.value })}
              className={field}
            />
          </Labelled>
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
