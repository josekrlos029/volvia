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
  searchParams: Promise<{ email?: string; name?: string; from?: string; social?: string }>
}) {
  const session = await getSession()
  if (session) redirect('/')

  const { email, name, from, social } = await searchParams
  const providerName = from === 'apple' ? 'Apple' : from === 'google' ? 'Google' : null

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
      {providerName ? (
        <div className="mb-5">
          <AuthNotice
            title="Primero crea tu negocio"
            body={
              social
                ? `Tu cuenta de ${providerName} todavía no está en Volvia. Ponle nombre a tu negocio y listo: no necesitas contraseña.`
                : `Tu cuenta de ${providerName} todavía no está en Volvia. Crea el negocio con este correo y a partir de ahí podrás entrar con ${providerName}.`
            }
          />
        </div>
      ) : null}

      <SignupForm
        defaultEmail={email ?? ''}
        defaultName={name ?? ''}
        socialToken={social ?? null}
      />
    </AuthShell>
  )
}
