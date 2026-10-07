import { MarkQrPrinted } from '@/components/OnboardingChecklist'
import { Panel, buttonClass } from '@/components/ui'
import { apiFetch, getSession } from '@/lib/session'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'Primeros pasos · Volvia' }

interface Org {
  name: string
  slug: string
  logoUrl: string | null
  onboarding: Record<string, boolean>
  publicUrl: string
}

interface CardSummary {
  id: string
  name: string
  status: string
  holders: number
}

interface Overview {
  customers: { total: number }
  stamps: { total: number }
}

interface Step {
  id: string
  title: string
  body: string
  done: boolean
  action?: ReactNode
}

/**
 * Six steps from an empty account to a stamped card.
 *
 * State is derived from what actually happened — a card exists, a customer joined, a
 * stamp landed — rather than from flags a half-finished session could leave behind. The
 * only stored flag is the QR, because no data can tell us whether it is on the counter.
 */
export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/onboarding')

  const [org, cards, overview] = await Promise.all([
    apiFetch<Org>('/v1/org'),
    apiFetch<CardSummary[]>('/v1/cards'),
    apiFetch<Overview>('/v1/analytics/overview?preset=30d'),
  ])

  const publishedCard = cards.find((card) => card.status === 'active')
  const firstCard = cards[0]

  const steps: Step[] = [
    {
      id: 'businessProfile',
      title: 'Pon la cara de tu negocio',
      body: 'Tu logo y tus colores salen en la tarjeta que el cliente guarda en el móvil.',
      done: Boolean(org.logoUrl) || org.onboarding.businessProfile === true,
      action: (
        <Link href="/settings" className={buttonClass('primary', 'sm')}>
          Ir a ajustes
        </Link>
      ),
    },
    {
      id: 'firstCard',
      title: 'Crea tu tarjeta de sellos',
      body: 'Cuántos sellos hacen falta y qué se lleva el cliente al completarla.',
      done: cards.length > 0,
      action: (
        <Link href="/cards/new" className={buttonClass('primary', 'sm')}>
          Crear tarjeta
        </Link>
      ),
    },
    {
      id: 'cardPublished',
      title: 'Publícala',
      body: 'Mientras no esté publicada, nadie puede unirse desde el QR.',
      done: Boolean(publishedCard),
      action: firstCard ? (
        <Link href={`/cards/${firstCard.id}`} className={buttonClass('primary', 'sm')}>
          Abrir {firstCard.name}
        </Link>
      ) : undefined,
    },
    {
      id: 'qrDownloaded',
      title: 'Lleva el QR al mostrador',
      body: 'Descárgalo, imprímelo y déjalo donde el cliente paga. Ahí empieza todo.',
      done: org.onboarding.qrDownloaded === true,
      action: publishedCard ? <MarkQrPrinted /> : undefined,
    },
    {
      id: 'firstCustomer',
      title: 'Tu primer cliente',
      body: 'Cuando alguien escanee el QR y deje su nombre, aparecerá en tus clientes.',
      done: overview.customers.total > 0,
      action: publishedCard ? (
        <a
          href={org.publicUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonClass('secondary', 'sm')}
        >
          Ver mi página pública
        </a>
      ) : undefined,
    },
    {
      id: 'firstStamp',
      title: 'Tu primer sello',
      body: 'Desde el escáner, con el móvil de tu personal. Es el gesto que repetirán cada día.',
      done: overview.stamps.total > 0,
      action: (
        <Link href="/scan" className={buttonClass('secondary', 'sm')}>
          Abrir el escáner
        </Link>
      ),
    },
  ]

  const done = steps.filter((step) => step.done).length
  const next = steps.find((step) => !step.done)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <header className="mb-7">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Volvia</p>
        <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.01em]">
          {done === steps.length ? `Todo listo, ${org.name}` : `Bienvenido, ${org.name}`}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          {done === steps.length
            ? 'Tu programa de fidelización está funcionando. Esto es lo que sigue en tu panel.'
            : 'Seis pasos y tus clientes empiezan a acumular sellos.'}
        </p>

        <div className="mt-5">
          {/* The bar is decoration; the count below it is what a screen reader reads. */}
          <div
            aria-hidden="true"
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
          >
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
              style={{ width: `${(done / steps.length) * 100}%` }}
            />
          </div>
          <p className="tabular mt-2 text-[13px] text-[var(--color-ink-muted)]">
            {done} de {steps.length} pasos completados
          </p>
        </div>
      </header>

      <Panel>
        <ol className="flex flex-col divide-y divide-[var(--color-line)]">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                  step.done
                    ? 'bg-[var(--color-success)] text-white'
                    : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]'
                }`}
              >
                {step.done ? '✓' : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <h2
                  className={`text-[15px] font-semibold ${
                    step.done ? 'text-[var(--color-ink-muted)] line-through' : ''
                  }`}
                >
                  {step.title}
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
                  {step.body}
                </p>
                {!step.done && step.action ? <div className="mt-3">{step.action}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-6 flex items-center justify-between gap-4">
        <Link href="/" className={buttonClass(next ? 'ghost' : 'primary')}>
          {next ? 'Seguir después' : 'Ir a mi panel'}
        </Link>
        {!session.user.emailVerified ? (
          <Link
            href="/verify-email"
            className="text-[13px] text-[var(--color-ink-muted)] underline underline-offset-2"
          >
            Confirma tu correo
          </Link>
        ) : null}
      </div>
    </main>
  )
}
