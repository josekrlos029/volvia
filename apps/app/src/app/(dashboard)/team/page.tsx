import { InviteForm } from '@/components/InviteForm'
import { Badge, EmptyState, Panel } from '@/components/ui'
import { formatDate, formatRelative } from '@/lib/format'
import { apiFetch } from '@/lib/session'

interface TeamResponse {
  members: Array<{
    id: string
    userId: string
    name: string
    email: string
    role: 'owner' | 'admin' | 'staff'
    lastLoginAt: string | null
  }>
  pending: Array<{ id: string; email: string; role: string; expiresAt: string }>
  seats: number
  seatLimit: number | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  staff: 'Mostrador',
}

export default async function TeamPage() {
  const [team, org] = await Promise.all([
    apiFetch<TeamResponse>('/v1/org/members'),
    apiFetch<{ entitlements: { features: Record<string, boolean> } }>('/v1/org'),
  ])

  const canInvite = org.entitlements.features.team_accounts ?? false

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Equipo</h1>
        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
          Quien está en mostrador solo necesita el rol de mostrador para sellar tarjetas.
        </p>
      </header>

      <Panel title="Personas">
        <ul className="flex flex-col divide-y divide-[var(--color-line)]">
          {team.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium">{member.name}</p>
                <p className="truncate text-[13px] text-[var(--color-ink-muted)]">{member.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-[13px] text-[var(--color-ink-muted)] sm:block">
                  {member.lastLoginAt ? formatRelative(member.lastLoginAt) : 'Sin entrar'}
                </span>
                <Badge tone={member.role === 'owner' ? 'brand' : 'neutral'}>
                  {ROLE_LABELS[member.role]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {team.pending.length > 0 ? (
        <Panel title="Invitaciones pendientes">
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {team.pending.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <span className="truncate text-[14px]">{invite.email}</span>
                <span className="shrink-0 text-[13px] text-[var(--color-ink-muted)]">
                  Vence {formatDate(invite.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Invitar">
        {canInvite ? (
          <InviteForm />
        ) : (
          <EmptyState
            title="Las cuentas de equipo llegan con el plan Negocio"
            body="Con ese plan puedes dar acceso a todo tu personal para que sellen desde su propio teléfono."
          />
        )}
      </Panel>
    </div>
  )
}
