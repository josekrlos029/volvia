import { LoginForm } from '@/components/LoginForm'
import { AuthShell } from '@/components/auth/AuthShell'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Entrar · Volvia' }

/** Only same-site paths are accepted, so `?next=` cannot bounce anyone off Volvia. */
function safeNext(value: string | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNext((await searchParams).next)
  const session = await getSession()
  if (session) redirect(next ?? '/')

  return (
    <AuthShell
      title="Entra a tu panel"
      lead="Gestiona tu tarjeta, tus clientes y tus recompensas."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link
            href="/signup"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2"
          >
            Crea tu negocio gratis
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  )
}
