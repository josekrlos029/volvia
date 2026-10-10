import { buttonClass } from '@/components/ui'
import Link from 'next/link'

const field =
  'w-full rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25'

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/**
 * A plain GET form, open by default only when something is already filtered.
 *
 * No JavaScript involved: the business filters, the URL changes, the page comes back
 * filtered. That also makes every filtered view a link someone can bookmark or send to
 * a colleague.
 */
export function CustomerFilters({
  values,
  cards,
  activeCount,
}: {
  values: Record<string, string>
  cards: Array<{ id: string; name: string }>
  activeCount: number
}) {
  return (
    <details
      open={activeCount > 0}
      className="rounded-[12px] border border-[var(--color-line)] bg-white"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium">
        <span>
          Filtros
          {activeCount > 0 ? (
            <span className="tabular ml-2 rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[12px] font-medium text-white">
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="text-[13px] font-normal text-[var(--color-ink-muted)]">
          Afinar quién aparece
        </span>
      </summary>

      <form action="/customers" className="border-t border-[var(--color-line)] p-4">
        <input type="hidden" name="segment" value={values.segment ?? 'all'} />
        {values.segmentId ? (
          <input type="hidden" name="segmentId" value={values.segmentId} />
        ) : null}
        {values.suggested ? (
          <input type="hidden" name="suggested" value={values.suggested} />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Buscar
            <input
              type="search"
              name="search"
              defaultValue={values.search ?? ''}
              placeholder="Nombre o correo"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Tarjeta
            <select name="cardId" defaultValue={values.cardId ?? ''} className={field}>
              <option value="">Cualquiera</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Promociones
            <select name="hasConsent" defaultValue={values.hasConsent ?? ''} className={field}>
              <option value="">Da igual</option>
              <option value="true">Solo quien las acepta</option>
              <option value="false">Solo quien no</option>
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              Sellos desde
              <input
                type="number"
                name="minStamps"
                min={0}
                defaultValue={values.minStamps ?? ''}
                className={field}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              hasta
              <input
                type="number"
                name="maxStamps"
                min={0}
                defaultValue={values.maxStamps ?? ''}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Recompensas canjeadas
            <select name="hasRedeemed" defaultValue={values.hasRedeemed ?? ''} className={field}>
              <option value="">Da igual</option>
              <option value="true">Al menos una</option>
              <option value="false">Ninguna todavía</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Cumpleaños en
            <select
              name="birthdayMonth"
              defaultValue={values.birthdayMonth ?? ''}
              className={field}
            >
              <option value="">Cualquier mes</option>
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              Se unió desde
              <input
                type="date"
                name="joinedAfter"
                defaultValue={values.joinedAfter ?? ''}
                className={field}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              hasta
              <input
                type="date"
                name="joinedBefore"
                defaultValue={values.joinedBefore ?? ''}
                className={field}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              Última visita desde
              <input
                type="date"
                name="lastVisitAfter"
                defaultValue={values.lastVisitAfter ?? ''}
                className={field}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              hasta
              <input
                type="date"
                name="lastVisitBefore"
                defaultValue={values.lastVisitBefore ?? ''}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Ordenar por
            <select name="sortBy" defaultValue={values.sortBy ?? 'lastStampAt'} className={field}>
              <option value="lastStampAt">Última visita</option>
              <option value="joinedAt">Fecha de registro</option>
              <option value="stamps">Sellos</option>
              <option value="rewards">Recompensas</option>
              <option value="firstName">Nombre</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className={buttonClass('primary', 'sm')}>
            Aplicar
          </button>
          {activeCount > 0 ? (
            <Link
              href={`/customers?${new URLSearchParams(
                Object.fromEntries(
                  Object.entries({
                    segment: values.segment ?? 'all',
                    segmentId: values.segmentId ?? '',
                    suggested: values.suggested ?? '',
                  }).filter(([, value]) => value),
                ),
              )}`}
              className={buttonClass('ghost', 'sm')}
            >
              Quitar filtros
            </Link>
          ) : null}
        </div>
      </form>
    </details>
  )
}
