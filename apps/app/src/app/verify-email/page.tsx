import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { ResendButton, VerifyEmailClient } from '@/components/auth/VerifyEmailClient'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Confirmar correo · Volvia', robots: { index: false } }

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const session = await getSession()

  return (
    <AuthShell title="Confirma tu correo">
      {token ? (
        <VerifyEmailClient token={token} signedIn={Boolean(session)} />
      ) : (
        <AuthNotice
          title="Abre el enlace del correo"
          body={
            session
              ? 'Te enviamos un enlace al crear la cuenta. Si no llegó, pide otro.'
              : 'Entra a tu panel y te enviamos otro enlace de confirmación.'
          }
          action={
            session ? (
              <ResendButton />
            ) : (
              <a
                href="/login"
                className="text-[14px] font-medium text-[var(--color-primary)] underline underline-offset-2"
              >
                Entrar
              </a>
            )
          }
        />
      )}
    </AuthShell>
  )
}
