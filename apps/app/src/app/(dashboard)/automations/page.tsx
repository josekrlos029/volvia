import { AutomationToggle } from '@/components/AutomationToggle'
import { WelcomeEmailEditor } from '@/components/WelcomeEmailEditor'
import { EmptyState, Panel } from '@/components/ui'
import { formatRelative } from '@/lib/format'
import { apiFetch } from '@/lib/session'

interface AutomationsResponse {
  automations: Array<{
    id: string
    type: string
    isActive: boolean
    lastRunAt: string | null
    config: { headline: string; body: string; offer: { kind: string; amount: number | null } }
  }>
  birthdayReachThisMonth: number
}

export default async function AutomationsPage() {
  const [data, org] = await Promise.all([
    apiFetch<AutomationsResponse>('/v1/automations'),
    apiFetch<{ name: string; entitlements: { features: Record<string, boolean> } }>('/v1/org'),
  ])

  const canUse = org.entitlements.features.birthday_automation ?? false
  const birthday = data.automations.find((automation) => automation.type === 'birthday')
  const welcome = data.automations.find((automation) => automation.type === 'welcome')

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Automatizaciones</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Se ejecutan solas, en la hora de tu negocio, sin que tengas que acordarte.
        </p>
      </header>

      {!canUse ? (
        <Panel>
          <EmptyState
            title="Las automatizaciones llegan con el plan Negocio"
            body="Deja el cumpleaños de tus clientes configurado una vez y olvídate: cada mes sale solo."
          />
        </Panel>
      ) : (
        <Panel title="Cumpleaños">
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
              Este mes cumplen años {data.birthdayReachThisMonth} de tus clientes. Con esto activo,
              cada uno recibe su detalle el día que le toca.
            </p>

            <AutomationToggle
              active={birthday?.isActive ?? false}
              headline={birthday?.config.headline ?? '¡Feliz cumpleaños!'}
              body={birthday?.config.body ?? 'Te dejamos algo en tu tarjeta para celebrar.'}
              bonusStamps={birthday?.config.offer.amount ?? 2}
            />

            {birthday?.lastRunAt ? (
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Última ejecución: {formatRelative(birthday.lastRunAt)}
              </p>
            ) : null}
          </div>
        </Panel>
      )}

      {/* The welcome email goes out on every plan: it is the first thing a customer
          reads from the business, not a premium extra. */}
      <Panel title="Correo de bienvenida">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
            Llega segundos después de que alguien se una, cuando todavía está en tu mostrador. Es el
            correo que más se abre de todos.
          </p>

          <WelcomeEmailEditor
            active={welcome?.isActive ?? true}
            headline={welcome?.config.headline ?? ''}
            body={welcome?.config.body ?? ''}
            businessName={org.name}
          />
        </div>
      </Panel>
    </div>
  )
}
