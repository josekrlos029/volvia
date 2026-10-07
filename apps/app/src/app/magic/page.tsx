import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { MagicClient } from '@/components/auth/MagicClient'
import { buttonClass } from '@/components/ui'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Entrando · Volvia', robots: { index: false } }

export default async function MagicPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <AuthShell title="Entrar a Volvia">
      {token ? (
        <MagicClient token={token} />
      ) : (
        <AuthNotice
          tone="danger"
          title="Falta el enlace"
          body="Abre el enlace completo desde el correo que te enviamos."
          action={
            <a href="/login" className={buttonClass('primary')}>
              Ir a entrar
            </a>
          }
        />
      )}
    </AuthShell>
  )
}
