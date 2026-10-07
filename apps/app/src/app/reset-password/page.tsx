import { AuthShell } from '@/components/auth/AuthShell'
import { RequestResetForm, SetPasswordForm } from '@/components/auth/ResetPasswordForm'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Recuperar contraseña · Volvia',
  robots: { index: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>
}) {
  const { token, email } = await searchParams

  return (
    <AuthShell
      title={token ? 'Elige una contraseña' : 'Recupera tu contraseña'}
      lead={token ? undefined : 'Te enviamos un enlace al correo con el que entras a tu panel.'}
      footer={
        <>
          ¿La recordaste?{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2"
          >
            Entra
          </Link>
        </>
      }
    >
      {token ? <SetPasswordForm token={token} /> : <RequestResetForm defaultEmail={email ?? ''} />}
    </AuthShell>
  )
}
