'use client'

import { api } from '@/lib/api-client'
import { FREQUENCY_LABELS } from '@/lib/segments'
import {
  BUSINESS_CATEGORIES,
  DEFAULT_NOTIFICATION_HOURS,
  type OrgSettings,
  VISIT_FREQUENCIES,
} from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Panel, buttonClass } from './ui'

interface Org {
  name: string
  slug: string
  category: string
  tagline: string
  about: string
  contactEmail: string | null
  contactPhone: string | null
  googlePlaceId: string | null
  publicUrl: string
  settings: OrgSettings
}

/** Plain names for the trades Volvia is built for. */
const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Cafetería',
  restaurant: 'Restaurante',
  bakery: 'Panadería',
  bar: 'Bar',
  juice_bar: 'Jugos y batidos',
  ice_cream: 'Heladería',
  barber: 'Barbería',
  hair_salon: 'Peluquería',
  nail_salon: 'Manicura',
  beauty: 'Estética',
  spa: 'Spa',
  fitness: 'Gimnasio',
  pet_grooming: 'Peluquería canina',
  tattoo: 'Tatuajes',
  car_wash: 'Lavado de autos',
  retail: 'Tienda',
  other: 'Otro',
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
        category: value.category,
        tagline: value.tagline,
        about: value.about,
        contactEmail: value.contactEmail || null,
        contactPhone: value.contactPhone || null,
        googlePlaceId: value.googlePlaceId || null,
        settings: value.settings,
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

        <Labelled label="Tipo de negocio" htmlFor="org-category">
          <select
            id="org-category"
            value={value.category}
            onChange={(event) => setValue({ ...value, category: event.target.value })}
            className={field}
          >
            {BUSINESS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category] ?? category}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled
          label="Cada cuánto esperas que vuelva un buen cliente"
          htmlFor="org-frequency"
          help="Con esto medimos quién es habitual y quién se está alejando. Un gimnasio y una barbería no se miden igual."
        >
          <select
            id="org-frequency"
            value={value.settings.visitFrequency}
            onChange={(event) =>
              setValue({
                ...value,
                settings: {
                  ...value.settings,
                  visitFrequency: event.target.value as OrgSettings['visitFrequency'],
                },
              })
            }
            className={field}
          >
            {VISIT_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {FREQUENCY_LABELS[frequency]}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled
          label="Horario para avisos en el teléfono"
          htmlFor="org-notify-from"
          help="Los mensajes y las ofertas de campañas solo llegan dentro de este horario, en la hora de tu negocio. Lo que caiga fuera espera a la siguiente apertura."
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="org-notify-from"
              type="time"
              aria-label="Desde"
              value={value.settings.notificationHours?.from ?? DEFAULT_NOTIFICATION_HOURS.from}
              disabled={value.settings.notificationHours === null}
              onChange={(event) =>
                setValue({
                  ...value,
                  settings: {
                    ...value.settings,
                    notificationHours: {
                      from: event.target.value,
                      to: value.settings.notificationHours?.to ?? DEFAULT_NOTIFICATION_HOURS.to,
                    },
                  },
                })
              }
              className={`${field} max-w-[130px]`}
            />
            <span className="text-[14px] text-[var(--color-ink-muted)]">a</span>
            <input
              id="org-notify-to"
              type="time"
              aria-label="Hasta"
              value={value.settings.notificationHours?.to ?? DEFAULT_NOTIFICATION_HOURS.to}
              disabled={value.settings.notificationHours === null}
              onChange={(event) =>
                setValue({
                  ...value,
                  settings: {
                    ...value.settings,
                    notificationHours: {
                      from:
                        value.settings.notificationHours?.from ?? DEFAULT_NOTIFICATION_HOURS.from,
                      to: event.target.value,
                    },
                  },
                })
              }
              className={`${field} max-w-[130px]`}
            />
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={value.settings.notificationHours === null}
                onChange={(event) =>
                  setValue({
                    ...value,
                    settings: {
                      ...value.settings,
                      notificationHours: event.target.checked
                        ? null
                        : { ...DEFAULT_NOTIFICATION_HOURS },
                    },
                  })
                }
                className="accent-[var(--color-primary)]"
              />
              A cualquier hora
            </label>
          </div>
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
