import { Badge, EmptyState, Panel, buttonClass } from '@/components/ui'
import { PLAN_NAMES, formatDate } from '@/lib/format'
import { apiFetch, getSession, getUser } from '@/lib/session'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Admin · Volvia' }

interface AdminOrgsResponse {
  orgs: Array<{
    id: string
    name: string
    slug: string
    plan: string
    customerCount: number
    createdAt: string
    ownerEmail: string | null
  }>
}

/** Volvia staff only: every business on the platform, and a way into each one. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login?next=/admin')
  if (!user.isSuperadmin) notFound()

  const q = (await searchParams).q?.trim() ?? ''
  const [{ orgs }, session] = await Promise.all([
    apiFetch<AdminOrgsResponse>(`/v1/admin/orgs${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    getSession(),
  ])

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-primary)]">Volvia</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Negocios</h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            Entras a cada negocio con permisos de dueño.
          </p>
        </div>
        {session ? (
          <Link href="/" className={buttonClass('secondary', 'sm')}>
            Volver al panel
          </Link>
        ) : null}
      </header>

      <form className="flex gap-2" action="/admin">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nombre, enlace o correo del dueño"
          aria-label="Buscar negocios"
          className="min-w-0 flex-1 rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2 text-[14px]"
        />
        <button type="submit" className={buttonClass('secondary')}>
          Buscar
        </button>
      </form>

      <Panel>
        {orgs.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            body={q ? `Ningún negocio coincide con «${q}».` : 'Todavía no hay negocios.'}
          />
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {orgs.map((org) => (
              <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-medium">
                    <span className="truncate">{org.name}</span>
                    {session?.orgId === org.id ? <Badge tone="brand">Actual</Badge> : null}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-[var(--color-ink-muted)]">
                    /{org.slug} · {org.ownerEmail ?? 'sin dueño'} ·{' '}
                    {PLAN_NAMES[org.plan] ?? org.plan} · {org.customerCount} clientes ·{' '}
                    {formatDate(org.createdAt)}
                  </p>
                </div>
                <form action="/api/admin/enter" method="post">
                  <input type="hidden" name="orgId" value={org.id} />
                  <button type="submit" className={buttonClass('primary', 'sm')}>
                    Entrar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  )
}
