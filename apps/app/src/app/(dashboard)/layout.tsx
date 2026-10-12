import { Nav } from '@/components/Nav'
import { apiFetch, getSession, getUser } from '@/lib/session'
import { redirect } from 'next/navigation'

interface OrgResponse {
  name: string
  plan: string
  customerCount: number
  trialCustomerLimit: number
  entitlements: {
    effectivePlan: string
    inPremiumTrial: boolean
    trialCustomersRemaining: number | null
    features: Record<string, boolean>
    limits: { campaignsPerMonth: number | null }
  }
}

/** The banner only nags once the trial is nearly over; the sidebar carries it the rest of the time. */
const TRIAL_BANNER_FROM = 5

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) {
    // Staff without a business of their own land on the business picker instead.
    const user = await getUser()
    redirect(user?.isSuperadmin ? '/admin' : '/login')
  }

  // A closed business answers nothing here; the owner lands where it can be brought back.
  const org = await apiFetch<OrgResponse>('/v1/org', { orgId: session.orgId }).catch(async () => {
    const closed = await apiFetch<{ organizations: unknown[] }>('/v1/org/closed').catch(() => null)
    redirect(closed && closed.organizations.length > 0 ? '/closed' : '/login')
  })

  // The monthly allowance only matters on a paid plan that has campaigns at all.
  const campaignsUsed =
    !org.entitlements.inPremiumTrial &&
    org.entitlements.features.campaigns &&
    org.entitlements.limits.campaignsPerMonth !== null
      ? await apiFetch<{ thisMonth: { used: number } }>('/v1/campaigns', { orgId: session.orgId })
          .then((list) => list.thisMonth.used)
          .catch(() => null)
      : null

  // Locked sections stay visible so the owner can see what a plan would unlock.
  const locked = Object.fromEntries(
    Object.entries(org.entitlements.features).map(([feature, allowed]) => [feature, !allowed]),
  )

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <Nav
        orgName={org.name}
        plan={{
          effectivePlan: org.entitlements.effectivePlan,
          inPremiumTrial: org.entitlements.inPremiumTrial,
          customerCount: org.customerCount,
          trialCustomerLimit: org.trialCustomerLimit,
          campaignsPerMonth: org.entitlements.limits.campaignsPerMonth,
          campaignsUsed,
        }}
        userName={session.user.name}
        role={session.role}
        isSuperadmin={session.user.isSuperadmin}
        locked={locked}
      />

      <div className="min-w-0 flex-1">
        {org.entitlements.inPremiumTrial &&
        org.entitlements.trialCustomersRemaining !== null &&
        org.entitlements.trialCustomersRemaining <= TRIAL_BANNER_FROM ? (
          <p className="border-b border-[var(--color-line)] bg-[var(--color-accent-soft)] px-4 py-2.5 text-[13px] text-[var(--color-warning)] lg:px-8">
            {org.entitlements.trialCustomersRemaining === 0
              ? 'Llegaste a los clientes de prueba: las funciones de pago se cierran salvo que elijas un plan.'
              : `Te quedan ${org.entitlements.trialCustomersRemaining} clientes de prueba. Después, Wallet, campañas y el resto de funciones de pago se cierran.`}{' '}
            <a href="/settings/billing" className="font-medium underline underline-offset-2">
              Ver planes
            </a>
          </p>
        ) : null}
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
