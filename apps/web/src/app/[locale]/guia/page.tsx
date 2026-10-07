import { Section, SectionTitle } from '@/components/Section'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
import { playbookFor } from '@/lib/playbook'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isSpanish = locale === 'es'
  return {
    title: isSpanish
      ? 'Guía: los primeros 30 días de tu tarjeta de sellos'
      : 'Guide: the first 30 days of your stamp card',
    description: isSpanish
      ? 'Ocho pasos, en el orden en el que las cosas salen mal de verdad. Con el error típico de cada uno y cómo saber que lo hiciste.'
      : 'Eight steps, in the order things actually go wrong. With the typical mistake at each one and how to know you did it.',
    alternates: {
      canonical: `/${locale}/guia`,
      languages: { es: '/es/guia', en: '/en/guia' },
    },
  }
}

export default async function PlaybookPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const steps = playbookFor(locale)
  const site = copyFor(locale)
  const isSpanish = locale === 'es'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: isSpanish
      ? 'Poner en marcha un programa de tarjeta de sellos'
      : 'Launching a stamp card programme',
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data, built from our own content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[20ch] text-[clamp(30px,4.2vw,44px)] leading-[1.06] tracking-[-0.03em]">
            {isSpanish ? 'Los primeros 30 días' : 'The first 30 days'}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Casi ningún programa de fidelización falla en el software. Falla en la semana dos, cuando quien lo montó deja de mencionarlo al cobrar. Esta guía está ordenada por cuándo pasan las cosas, no por el orden del menú.'
              : 'Almost no loyalty programme fails in the software. It fails in week two, when the person who set it up stops mentioning it while taking payment. This guide is ordered by when things happen, not by the order of the menu.'}
          </p>
        </div>
      </section>

      <Section>
        <ol className="flex flex-col divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {steps.map((step, index) => (
            <li key={step.id} className="grid gap-5 py-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
              <div>
                <p className="tabular-nums text-[13px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                  {isSpanish ? 'Día' : 'Day'} {step.when}
                </p>
                <h2 className="mt-2 max-w-[22ch] text-[22px] leading-tight tracking-[-0.01em]">
                  {index + 1}. {step.title}
                </h2>
              </div>

              <div className="flex flex-col gap-4">
                <p className="max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
                  {step.body}
                </p>

                <p className="max-w-[62ch] border-l-2 border-[var(--color-warning)] pl-4 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                  <span className="text-[var(--color-ink)]">
                    {isSpanish ? 'El error típico: ' : 'The usual mistake: '}
                  </span>
                  {step.mistake}
                </p>

                <p className="max-w-[62ch] rounded-[16px] bg-[var(--color-surface-muted)] px-4 py-3 text-[15px] leading-relaxed">
                  <span className="">{isSpanish ? 'Hecho cuando: ' : 'Done when: '}</span>
                  <span className="text-[var(--color-ink-muted)]">{step.check}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="muted">
        <SectionTitle
          title={isSpanish ? 'Para seguir' : 'What to read next'}
          body={
            isSpanish
              ? 'Las plantillas resuelven el primer paso y las referencias te dicen si tus números del día 30 están bien.'
              : 'The templates solve step one, and the benchmarks tell you whether your day-30 numbers are any good.'
          }
        />
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/${locale}/plantillas`} className="btn-ghost">
            {isSpanish ? 'Plantillas de tarjeta' : 'Card templates'}
          </Link>
          <Link href={`/${locale}/referencias`} className="btn-ghost">
            {isSpanish ? 'Números típicos' : 'Typical numbers'}
          </Link>
          <a href={`${appUrl}/signup`} className="btn-primary">
            {site.hero.cta}
          </a>
        </div>
      </Section>
    </>
  )
}
