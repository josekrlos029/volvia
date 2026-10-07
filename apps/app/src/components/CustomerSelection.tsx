'use client'

import { Badge, buttonClass } from '@/components/ui'
import { formatRelative } from '@/lib/format'
import { MAX_SELECTED_CUSTOMERS } from '@volvia/shared'
import Link from 'next/link'
import { useState } from 'react'

export interface CustomerRow {
  id: string
  firstName: string
  email: string
  marketingConsent: boolean
  totalStamps: number
  totalRewards: number
  lastStampAt: string | null
}

/**
 * The customer list, with a selection.
 *
 * Picking people out of a list is only worth the checkboxes if something can be done
 * with them afterwards, so the selection goes straight into a campaign or a CSV. The
 * rows themselves are plain links: selecting is the exception, opening a customer is
 * what happens most of the time.
 */
export function CustomerSelection({
  rows,
  apiUrl,
  canExport,
}: {
  rows: CustomerRow[]
  apiUrl: string
  canExport: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])

  const allOnPage = rows.length > 0 && selected.length === rows.length
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )

  const ids = selected.join(',')
  const tooMany = selected.length > MAX_SELECTED_CUSTOMERS

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-white shadow-sm">
          <p className="tabular text-[14px] font-medium">
            {selected.length} {selected.length === 1 ? 'cliente' : 'clientes'}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href={`/campaigns?customers=${ids}`}
              className="rounded-[9px] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
            >
              Crear campaña
            </Link>
            {canExport ? (
              <a
                href={`${apiUrl}/v1/customers/export.csv?ids=${ids}`}
                className="rounded-[9px] border border-white/30 px-3 py-1.5 text-[13px] font-medium"
              >
                Exportar
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => setSelected([])}
              className="px-2 py-1.5 text-[13px] underline underline-offset-2"
            >
              Quitar
            </button>
          </div>

          {tooMany ? (
            <p className="w-full text-[13px] text-white/80">
              Se usarán los primeros {MAX_SELECTED_CUSTOMERS}. Para más, filtra y actúa sobre todo
              el resultado.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Table on desktop, cards on mobile: a six-column table is unusable on a phone. */}
      <div className="hidden overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-white md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[13px] text-[var(--color-ink-muted)]">
            <tr>
              <th scope="col" className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los de esta página"
                  checked={allOnPage}
                  onChange={() => setSelected(allOnPage ? [] : rows.map((row) => row.id))}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Cliente
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Sellos
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Recompensas
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Última visita
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Promociones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.map((customer) => (
              <tr
                key={customer.id}
                className={
                  selected.includes(customer.id)
                    ? 'bg-[var(--color-primary-soft)]'
                    : 'hover:bg-[var(--color-surface-muted)]'
                }
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar a ${customer.firstName}`}
                    checked={selected.includes(customer.id)}
                    onChange={() => toggle(customer.id)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/customers/${customer.id}`} className="font-medium">
                    {customer.firstName}
                  </Link>
                  <span className="block text-[13px] text-[var(--color-ink-muted)]">
                    {customer.email}
                  </span>
                </td>
                <td className="tabular px-4 py-3">{customer.totalStamps}</td>
                <td className="tabular px-4 py-3">{customer.totalRewards}</td>
                <td className="px-4 py-3 text-[var(--color-ink-muted)]">
                  {formatRelative(customer.lastStampAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={customer.marketingConsent ? 'success' : 'neutral'}>
                    {customer.marketingConsent ? 'Sí' : 'No'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((customer) => (
          <li
            key={customer.id}
            className={[
              'flex items-start gap-3 rounded-[12px] border bg-white p-4',
              selected.includes(customer.id)
                ? 'border-[var(--color-primary)]'
                : 'border-[var(--color-line)]',
            ].join(' ')}
          >
            <input
              type="checkbox"
              aria-label={`Seleccionar a ${customer.firstName}`}
              checked={selected.includes(customer.id)}
              onChange={() => toggle(customer.id)}
              className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
            />
            <Link href={`/customers/${customer.id}`} className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{customer.firstName}</p>
                  <p className="truncate text-[13px] text-[var(--color-ink-muted)]">
                    {customer.email}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[13px] text-[var(--color-ink-muted)]">
                  {formatRelative(customer.lastStampAt)}
                </span>
              </div>
              <p className="tabular mt-2 text-[13px] text-[var(--color-ink-muted)]">
                {customer.totalStamps} sellos · {customer.totalRewards} recompensas
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {selected.length === 0 ? (
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          Marca clientes para crear una campaña solo para ellos
          {canExport ? ' o exportarlos' : ''}.
        </p>
      ) : null}
    </div>
  )
}
