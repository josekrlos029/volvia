import { RestoreOrgButton } from '@/components/RestoreOrgButton'
import { EmptyState, Panel } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { apiFetch, getUser } from '@/lib/session'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Negocios cerrados · Volvia' }

interface ClosedResponse {
  organizations: Array<{ id: string; name: string; slug: string; purgeAt: string | null }>
}

/**
 * Where a closed business can be brought back. Reached from the email, or from the
 * dashboard when the only business the person has is a closed one.
 */
export default async function ClosedPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login?next=/closed')

  const { organizations } = await apiFetch<ClosedResponse>('/v1/org/closed').catch(
    () => ({ organizations: [] }) as ClosedResponse,
  )
  const wanted = (await searchParams).org
  const list = wanted
    ? [...organizations].sort((a, b) => (a.id === wanted ? -1 : b.id === wanted ? 1 : 0))
    : organizations

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-10 lg:px-8">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Negocios cerrados</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Un negocio cerrado se puede recuperar tal cual estaba durante siete días. Después se borra
          de forma definitiva.
        </p>
      </header>

      {list.length === 0 ? (
        <Panel>
          <EmptyState
            title="No tienes negocios por recuperar"
            body="O ya pasó el plazo, o nunca cerraste ninguno."
          />
        </Panel>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((org) => (
            <li key={org.id}>
              <Panel title={org.name}>
                <p className="mb-4 text-[14px] text-[var(--color-ink-muted)]">
                  {org.purgeAt
                    ? `Se borrará definitivamente el ${formatDate(org.purgeAt, 'long')}.`
                    : 'Pendiente de borrado.'}
                </p>
                <RestoreOrgButton orgId={org.id} name={org.name} />
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[13px] text-[var(--color-ink-muted)]">
        <Link href="/" className="underline underline-offset-2">
          Volver al panel
        </Link>
      </p>
    </main>
  )
}
