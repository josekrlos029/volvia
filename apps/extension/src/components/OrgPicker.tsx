import type { SessionUser } from '@volvia/shared'
import { Button, Screen } from './ui'

export function OrgPicker({
  memberships,
  onPick,
  onSignOut,
}: {
  memberships: SessionUser['memberships']
  onPick: (orgId: string) => void
  onSignOut: () => void
}) {
  return (
    <Screen header={<p className="text-[15px] font-semibold">¿Con qué negocio vas a sellar?</p>}>
      {memberships.length === 0 ? (
        <p className="text-[14px] text-[var(--color-ink-muted)]">
          Tu cuenta no pertenece a ningún negocio todavía. Pide que te inviten desde el panel.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {memberships.map((membership) => (
            <li key={membership.orgId}>
              <button
                type="button"
                onClick={() => onPick(membership.orgId)}
                className="w-full rounded-[12px] border border-[var(--color-line)] bg-white px-4 py-3 text-left text-[15px] font-medium hover:border-[var(--color-primary)]"
              >
                {membership.orgName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" className="mt-auto" onClick={onSignOut}>
        Cerrar sesión
      </Button>
    </Screen>
  )
}
