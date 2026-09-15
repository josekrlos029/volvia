import { LoginForm } from '@/components/LoginForm'
import { getSession } from '@/lib/session'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Entrar · Volvia' }

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/')

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <header className="mb-8">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Volvia</p>
        <h1 className="mt-6 text-[26px] font-semibold leading-tight tracking-[-0.01em]">
          Entra a tu panel
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          Gestiona tu tarjeta, tus clientes y tus recompensas.
        </p>
      </header>

      <LoginForm />
    </main>
  )
}
