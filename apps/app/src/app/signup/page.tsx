import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Crear cuenta · Volvia',
  description: 'Crea tu tarjeta de fidelización digital en minutos.',
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; from?: string }>
}) {
  const session = await getSession()
  if (session) redirect('/')

  const { email, name, from } = await searchParams

  return (
    <AuthShell
      title="Crea tu cuenta"
      lead="Tu primera tarjeta de sellos queda lista en unos minutos. Sin tarjeta de crédito."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2"
          >
            Entra
          </Link>
        </>
      }
    >
      {from === 'google' ? (
        <div className="mb-5">
          <AuthNotice
            title="Primero crea tu negocio"
            body="Tu cuenta de Google todavía no está en Volvia. Crea el negocio con este correo y a partir de ahí podrás entrar con Google."
          />
        </div>
      ) : null}

      <SignupForm defaultEmail={email ?? ''} defaultName={name ?? ''} />
    </AuthShell>
  )
}
