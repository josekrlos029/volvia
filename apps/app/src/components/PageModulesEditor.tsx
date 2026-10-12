'use client'

import { api } from '@/lib/api-client'
import { formatMoney } from '@/lib/format'
import { fromMinorUnits, toMinorUnits } from '@/lib/money'
import {
  type Currency,
  MAX_PAGE_ITEMS_PER_SECTION,
  MAX_PAGE_SECTIONS_PER_KIND,
  PAGE_SECTION_KINDS,
} from '@volvia/shared'
import { ApiError } from '@volvia/shared/client'
import { useState } from 'react'
import { ImageUpload } from './ImageUpload'
import { EmptyState, Panel, buttonClass } from './ui'

export type PageKind = (typeof PAGE_SECTION_KINDS)[number]

export interface PageItem {
  id?: string
  title: string
  description: string
  priceAmount: number | null
  imageUrl: string | null
  durationMinutes: number | null
  startsAt: string | null
  endsAt: string | null
  publishedAt: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  askVia: 'whatsapp' | 'sms' | null
  isActive: boolean
}

export interface PageSection {
  id?: string
  title: string
  description: string
  isActive: boolean
  items: PageItem[]
}

export type PageSections = Record<PageKind, PageSection[]>

/** What each tab is called, and what one thing on it is called. */
const KIND_COPY: Record<
  PageKind,
  { label: string; item: string; help: string; multiSection: boolean; sectionHint?: string }
> = {
  menu: {
    label: 'Carta',
    item: 'plato',
    help: 'Lo que se puede pedir, con su precio. Agrúpalo como en tu carta de papel.',
    multiSection: true,
    sectionHint: 'Entradas, Platos fuertes, Bebidas…',
  },
  products: {
    label: 'Productos',
    item: 'producto',
    help: 'Una selección para llevar o encargar, con foto y precio.',
    multiSection: false,
  },
  services: {
    label: 'Servicios',
    item: 'servicio',
    help: 'Qué ofreces, cuánto dura y cuánto cuesta.',
    multiSection: false,
  },
  portfolio: {
    label: 'Portafolio',
    item: 'trabajo',
    help: 'Fotos de trabajos terminados, para que se imaginen el suyo.',
    multiSection: false,
  },
  updates: {
    label: 'Novedades',
    item: 'novedad',
    help: 'Noticias y avisos con fecha, con un botón opcional.',
    multiSection: false,
  },
  events: {
    label: 'Eventos',
    item: 'evento',
    help: 'Cada evento o clase con su fecha, hora y un siguiente paso.',
    multiSection: false,
  },
}

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

const emptyItem = (): PageItem => ({
  title: '',
  description: '',
  priceAmount: null,
  imageUrl: null,
  durationMinutes: null,
  startsAt: null,
  endsAt: null,
  publishedAt: null,
  buttonLabel: null,
  buttonUrl: null,
  askVia: null,
  isActive: true,
})

const emptySection = (): PageSection => ({ title: '', description: '', isActive: true, items: [] })

/** An ISO instant as the value a `datetime-local` input wants, in the browser's clock. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved as T)
  return next
}

/**
 * What the business puts on its page beyond the card: the menu, products, services,
 * work, news and events. One tab per kind, saved per kind, so a half-edited menu
 * never overwrites the events.
 */
export function PageModulesEditor({
  initial,
  currency,
  locked,
  onSaved,
}: {
  initial: PageSections
  currency: Currency
  /** The plan does not include the catalogue: show what it would be, not the editor. */
  locked: boolean
  onSaved?: () => void
}) {
  const [kind, setKind] = useState<PageKind>('menu')
  const [sections, setSections] = useState<PageSections>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const copy = KIND_COPY[kind]
  const current = sections[kind]

  function update(next: PageSection[]) {
    setSections({ ...sections, [kind]: next })
  }

  async function save() {
    setStatus('saving')
    setError(null)
    const payload = current
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.title.trim().length > 0),
      }))
      .filter((section) => copy.multiSection || section.items.length > 0 || current.length === 1)
    try {
      const saved = await api.put<{ sections: PageSection[] }>(`/v1/page/modules/${kind}`, {
        sections: payload,
      })
      setSections({ ...sections, [kind]: saved.sections })
      setStatus('saved')
      onSaved?.()
      setTimeout(() => setStatus('idle'), 2_000)
    } catch (caught) {
      setStatus('idle')
      setError(
        caught instanceof ApiError
          ? caught.isPlanLimit
            ? 'Esta parte de la página llega con el plan Negocio.'
            : caught.message
          : 'No pudimos guardar los cambios.',
      )
    }
  }

  const tabs = (
    <div role="tablist" className="flex flex-wrap gap-1.5">
      {PAGE_SECTION_KINDS.map((item) => {
        const count = sections[item].reduce((sum, section) => sum + section.items.length, 0)
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={kind === item}
            onClick={() => setKind(item)}
            className={[
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              kind === item
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]',
            ].join(' ')}
          >
            {KIND_COPY[item].label}
            {count > 0 ? <span className="tabular ml-1.5 opacity-70">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )

  if (locked) {
    return (
      <Panel title="En tu página">
        <div className="flex flex-col gap-4">
          {tabs}
          <EmptyState
            title="La carta, los productos y las novedades llegan con el plan Negocio"
            body="Con ese plan tu página muestra lo que vendes, lo que haces y lo que viene, con precios y fotos, para que la gente llegue decidida."
          />
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="En tu página">
      <div className="flex flex-col gap-4">
        {tabs}
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">{copy.help}</p>

        {current.length === 0 ? (
          <EmptyState
            title={`Todavía no hay ${copy.item}s`}
            body="Empieza con uno. Lo que dejes sin título no se publica."
            action={
              <button
                type="button"
                onClick={() =>
                  update([
                    {
                      ...emptySection(),
                      title: copy.multiSection ? '' : copy.label,
                      items: [emptyItem()],
                    },
                  ])
                }
                className={buttonClass('primary', 'sm')}
              >
                Añadir {copy.item}
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {current.map((section, sectionIndex) => (
              <div
                key={section.id ?? `section-${sectionIndex}`}
                className="rounded-[10px] border border-[var(--color-line)] p-4"
              >
                {copy.multiSection ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <input
                      value={section.title}
                      onChange={(event) =>
                        update(
                          current.map((item, i) =>
                            i === sectionIndex ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                      maxLength={60}
                      placeholder={copy.sectionHint}
                      aria-label={`Nombre de la sección ${sectionIndex + 1}`}
                      className={`${field} min-w-[200px] flex-1 font-medium`}
                    />
                    <button
                      type="button"
                      onClick={() => update(move(current, sectionIndex, sectionIndex - 1))}
                      disabled={sectionIndex === 0}
                      aria-label="Subir sección"
                      className={buttonClass('ghost', 'sm')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => update(move(current, sectionIndex, sectionIndex + 1))}
                      disabled={sectionIndex === current.length - 1}
                      aria-label="Bajar sección"
                      className={buttonClass('ghost', 'sm')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => update(current.filter((_, i) => i !== sectionIndex))}
                      className={buttonClass('ghost', 'sm')}
                    >
                      Quitar sección
                    </button>
                  </div>
                ) : null}

                <ul className="flex flex-col gap-3">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={item.id ?? `item-${itemIndex}`}
                      className="rounded-[9px] bg-[var(--color-surface-muted)]/60 p-3"
                    >
                      <ItemFields
                        kind={kind}
                        item={item}
                        currency={currency}
                        index={itemIndex}
                        onChange={(next) =>
                          update(
                            current.map((s, i) =>
                              i === sectionIndex
                                ? {
                                    ...s,
                                    items: s.items.map((it, j) => (j === itemIndex ? next : it)),
                                  }
                                : s,
                            ),
                          )
                        }
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              current.map((s, i) =>
                                i === sectionIndex
                                  ? { ...s, items: move(s.items, itemIndex, itemIndex - 1) }
                                  : s,
                              ),
                            )
                          }
                          disabled={itemIndex === 0}
                          aria-label="Subir"
                          className={buttonClass('ghost', 'sm')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              current.map((s, i) =>
                                i === sectionIndex
                                  ? { ...s, items: move(s.items, itemIndex, itemIndex + 1) }
                                  : s,
                              ),
                            )
                          }
                          disabled={itemIndex === section.items.length - 1}
                          aria-label="Bajar"
                          className={buttonClass('ghost', 'sm')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              current.map((s, i) =>
                                i === sectionIndex
                                  ? { ...s, items: s.items.filter((_, j) => j !== itemIndex) }
                                  : s,
                              ),
                            )
                          }
                          className={buttonClass('ghost', 'sm')}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {section.items.length < MAX_PAGE_ITEMS_PER_SECTION ? (
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        current.map((s, i) =>
                          i === sectionIndex ? { ...s, items: [...s.items, emptyItem()] } : s,
                        ),
                      )
                    }
                    className={`${buttonClass('secondary', 'sm')} mt-3`}
                  >
                    Añadir {copy.item}
                  </button>
                ) : null}
              </div>
            ))}

            {copy.multiSection && current.length < MAX_PAGE_SECTIONS_PER_KIND ? (
              <button
                type="button"
                onClick={() => update([...current, { ...emptySection(), items: [emptyItem()] }])}
                className={`${buttonClass('secondary', 'sm')} self-start`}
              >
                Añadir sección
              </button>
            ) : null}
          </div>
        )}

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
            onClick={() => void save()}
            disabled={status === 'saving'}
            className={buttonClass('primary')}
          >
            {status === 'saving' ? 'Guardando' : `Guardar ${copy.label.toLowerCase()}`}
          </button>
          {status === 'saved' ? (
            <span className="text-[14px] text-[var(--color-success)]">Publicado en tu página</span>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

function ItemFields({
  kind,
  item,
  currency,
  index,
  onChange,
}: {
  kind: PageKind
  item: PageItem
  currency: Currency
  index: number
  onChange: (next: PageItem) => void
}) {
  const [price, setPrice] = useState(fromMinorUnits(item.priceAmount, currency))
  const showPrice = kind === 'menu' || kind === 'products' || kind === 'services'
  const showImage =
    kind === 'products' || kind === 'portfolio' || kind === 'events' || kind === 'updates'
  const showDuration = kind === 'services'
  const showButton = kind === 'updates' || kind === 'events'
  const label = (text: string) => `${text} (${index + 1})`

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
        <input
          value={item.title}
          onChange={(event) => onChange({ ...item, title: event.target.value })}
          maxLength={80}
          placeholder="Nombre"
          aria-label={label('Nombre')}
          className={`${field} font-medium`}
        />
        {showPrice ? (
          <div className="flex items-center gap-2">
            <input
              value={price}
              onChange={(event) => {
                setPrice(event.target.value)
                onChange({ ...item, priceAmount: toMinorUnits(event.target.value, currency) })
              }}
              inputMode="decimal"
              placeholder={currency === 'cop' ? '12500' : '4.50'}
              aria-label={label('Precio')}
              className={`${field} w-[120px]`}
            />
            <span className="tabular whitespace-nowrap text-[13px] text-[var(--color-ink-muted)]">
              {item.priceAmount === null ? 'Sin precio' : formatMoney(item.priceAmount, currency)}
            </span>
          </div>
        ) : null}
      </div>

      <textarea
        value={item.description}
        onChange={(event) => onChange({ ...item, description: event.target.value })}
        maxLength={300}
        rows={2}
        placeholder="Una línea que ayude a elegir"
        aria-label={label('Descripción')}
        className={field}
      />

      <div className="grid gap-2.5 sm:grid-cols-2">
        {showDuration ? (
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Duración (minutos)
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={item.durationMinutes ?? ''}
              onChange={(event) =>
                onChange({
                  ...item,
                  durationMinutes: event.target.value ? Number(event.target.value) : null,
                })
              }
              className={field}
            />
          </label>
        ) : null}
        {kind === 'updates' ? (
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Fecha
            <input
              type="date"
              value={item.publishedAt ? item.publishedAt.slice(0, 10) : ''}
              onChange={(event) =>
                onChange({
                  ...item,
                  publishedAt: event.target.value
                    ? new Date(`${event.target.value}T12:00:00`).toISOString()
                    : null,
                })
              }
              className={field}
            />
          </label>
        ) : null}
        {kind === 'events' ? (
          <>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Empieza
              <input
                type="datetime-local"
                value={toLocalInput(item.startsAt)}
                onChange={(event) =>
                  onChange({ ...item, startsAt: fromLocalInput(event.target.value) })
                }
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Termina
              <input
                type="datetime-local"
                value={toLocalInput(item.endsAt)}
                onChange={(event) =>
                  onChange({ ...item, endsAt: fromLocalInput(event.target.value) })
                }
                className={field}
              />
            </label>
          </>
        ) : null}
        {showButton ? (
          <>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Botón (opcional)
              <input
                value={item.buttonLabel ?? ''}
                onChange={(event) => onChange({ ...item, buttonLabel: event.target.value || null })}
                maxLength={30}
                placeholder="Reservar lugar"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Enlace del botón
              <input
                value={item.buttonUrl ?? ''}
                onChange={(event) => onChange({ ...item, buttonUrl: event.target.value || null })}
                maxLength={500}
                placeholder="https://..."
                className={field}
              />
            </label>
          </>
        ) : null}
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Permitir preguntar por
          <select
            value={item.askVia ?? ''}
            onChange={(event) =>
              onChange({ ...item, askVia: (event.target.value || null) as PageItem['askVia'] })
            }
            className={field}
          >
            <option value="">No</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </label>
      </div>

      {showImage ? (
        <ImageUpload
          kind="page"
          value={item.imageUrl}
          onChange={(url) => onChange({ ...item, imageUrl: url })}
          label="Añadir foto"
        />
      ) : null}
    </div>
  )
}
