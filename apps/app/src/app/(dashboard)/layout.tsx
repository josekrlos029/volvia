import { Nav } from '@/components/Nav'
import { PLAN_NAMES } from '@/lib/format'
import { apiFetch, getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

interface OrgResponse {
  name: string
  plan: string
  entitlements: {
    effectivePlan: string
    inPremiumTrial: boolean
    trialCustomersRemaining: number | null
    features: Record<string, boolean>
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const org = await apiFetch<OrgResponse>('/v1/org', { orgId: session.orgId })

  // Locked sections stay visible so the owner can see what a plan would unlock.
  const locked = Object.fromEntries(
    Object.entries(org.entitlements.features).map(([feature, allowed]) => [feature, !allowed]),
  )

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <Nav
        orgName={org.name}
        plan={PLAN_NAMES[org.entitlements.effectivePlan] ?? org.plan}
        userName={session.user.name}
        locked={locked}
      />

      <div className="min-w-0 flex-1">
        {org.entitlements.inPremiumTrial ? (
          <p className="border-b border-[var(--color-line)] bg-[var(--color-accent-soft)] px-4 py-2.5 text-[13px] text-[var(--color-warning)] lg:px-8">
            Tienes todas las funciones abiertas hasta llegar a{' '}
            {org.entitlements.trialCustomersRemaining} clientes más.
          </p>
        ) : null}
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
