import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { InviteClient, type InvitePreview } from '@/components/auth/InviteClient'
import { buttonClass } from '@/components/ui'
import { apiUrl, getSession } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Invitación · Volvia', robots: { index: false } }

/** Read server-side so the page can name the business before any JavaScript runs. */
async function loadPreview(token: string): Promise<InvitePreview | null> {
  try {
    const response = await fetch(`${apiUrl}/p/invite?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as InvitePreview
  } catch {
    return null
  }
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const preview = token ? await loadPreview(token) : null
  const session = await getSession()

  return (
    <AuthShell title="Invitación a un equipo">
      {token && preview ? (
        <InviteClient token={token} preview={preview} signedIn={Boolean(session)} />
      ) : (
        <AuthNotice
          tone="danger"
          title="Esta invitación ya no sirve"
          body="Puede que haya vencido, que ya se haya usado o que el negocio la haya cancelado. Pide al dueño que te invite otra vez."
          action={
            <a href="/login" className={buttonClass('secondary')}>
              Ir a entrar
            </a>
          }
        />
      )}
    </AuthShell>
  )
}
