import { Badge, EmptyState, Panel, buttonClass } from '@/components/ui'
import { formatNumber, formatRelative } from '@/lib/format'
import { apiFetch } from '@/lib/session'
import Link from 'next/link'

interface CustomerRow {
  id: string
  firstName: string
  email: string
  birthdayMonth: number | null
  birthdayDay: number | null
  marketingConsent: boolean
  totalStamps: number
  totalRewards: number
  joinedAt: string
  lastStampAt: string | null
}

interface CustomerPage {
  items: CustomerRow[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  masked: boolean
}

const SEGMENTS = [
  { id: 'all', label: 'Todos' },
  { id: 'regulars', label: 'Habituales' },
  { id: 'new', label: 'Nuevos' },
  { id: 'at_risk', label: 'En riesgo' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'birthday_month', label: 'Cumplen este mes' },
] as const

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; search?: string; page?: string }>
}) {
  const query = await searchParams
  const segment = query.segment ?? 'all'
  const page = Number(query.page ?? 1)

  const params = new URLSearchParams({ segment, page: String(page), pageSize: '25' })
  if (query.search) params.set('search', query.search)

  const [customers, org] = await Promise.all([
    apiFetch<CustomerPage>(`/v1/customers?${params}`),
    apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org'),
  ])

  const canExport = org.entitlements.features.csv_export ?? false
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Clientes</h1>
          <p className="tabular mt-1 text-[14px] text-[var(--color-ink-muted)]">
            {formatNumber(customers.total)} en total
          </p>
        </div>
        {canExport ? (
          <a
            href={`${apiUrl}/v1/customers/export.csv?segment=${segment}`}
            className={buttonClass('secondary', 'sm')}
          >
            Exportar CSV
          </a>
        ) : null}
      </header>

      <form className="flex flex-wrap items-center gap-2" action="/customers">
        <input
          type="search"
          name="search"
          defaultValue={query.search ?? ''}
          placeholder="Buscar por nombre o correo"
          className="min-w-[220px] flex-1 rounded-[9px] border border-[var(--color-line)] bg-white px-3.5 py-2 text-[14px] placeholder:text-[#8A908A] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
        />
        <input type="hidden" name="segment" value={segment} />
        <button type="submit" className={buttonClass('secondary', 'sm')}>
          Buscar
        </button>
      </form>

      <nav aria-label="Segmentos" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {SEGMENTS.map((item) => (
          <Link
            key={item.id}
            href={`/customers?segment=${item.id}`}
            aria-current={segment === item.id ? 'page' : undefined}
            className={[
              'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              segment === item.id
                ? 'bg-[var(--color-ink)] text-white'
                : 'border border-[var(--color-line)] bg-white text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]',
            ].join(' ')}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {customers.masked ? (
        <p className="rounded-[9px] bg-[var(--color-accent-soft)] px-3.5 py-2.5 text-[13px] text-[var(--color-warning)]">
          Los correos se muestran ocultos en el plan Gratis. Con el plan Pro ves los datos
          completos.
        </p>
      ) : null}

      {customers.items.length === 0 ? (
        <Panel>
          <EmptyState
            title="Sin clientes en este segmento"
            body="Prueba con otro segmento, o comparte el QR de tu tarjeta para que empiecen a unirse."
          />
        </Panel>
      ) : (
        <>
          {/* Table on desktop, cards on mobile: a six-column table is unusable on a phone. */}
          <div className="hidden overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-white md:block">
            <table className="w-full text-left text-[14px]">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[13px] text-[var(--color-ink-muted)]">
                <tr>
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
                {customers.items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[var(--color-surface-muted)]">
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
            {customers.items.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="block rounded-[12px] border border-[var(--color-line)] bg-white p-4"
                >
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

          {customers.total > customers.pageSize ? (
            <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
              <Link
                href={`/customers?segment=${segment}&page=${page - 1}`}
                aria-disabled={page <= 1}
                className={`${buttonClass('secondary', 'sm')} ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
              >
                Anterior
              </Link>
              <span className="tabular text-[13px] text-[var(--color-ink-muted)]">
                Página {page} de {Math.ceil(customers.total / customers.pageSize)}
              </span>
              <Link
                href={`/customers?segment=${segment}&page=${page + 1}`}
                aria-disabled={!customers.hasMore}
                className={`${buttonClass('secondary', 'sm')} ${!customers.hasMore ? 'pointer-events-none opacity-50' : ''}`}
              >
                Siguiente
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}
