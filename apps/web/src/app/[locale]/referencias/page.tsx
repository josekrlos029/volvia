import { Section, SectionTitle } from '@/components/Section'
import { BENCHMARK_BASIS, benchmarksFor } from '@/lib/benchmarks'
import { LOCALES, isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
    title: isSpanish ? 'Referencias y números típicos' : 'Benchmarks and typical numbers',
    description: isSpanish
      ? 'Cuánta gente se une, cuántas tarjetas se completan, cuántas recompensas se canjean. Rangos observados, con de dónde sale cada número.'
      : 'How many people join, how many cards get completed, how many rewards are claimed. Observed ranges, with where each number comes from.',
    alternates: {
      canonical: `/${locale}/referencias`,
      languages: { es: '/es/referencias', en: '/en/referencias' },
    },
  }
}

export default async function BenchmarksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const rows = benchmarksFor(locale)
  const basisLabels = BENCHMARK_BASIS[locale]
  const isSpanish = locale === 'es'

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[22ch] text-[clamp(30px,4.2vw,44px)] leading-[1.06] tracking-[-0.03em]">
            {isSpanish
              ? 'Números típicos de un programa de sellos'
              : 'Typical numbers for a stamp programme'}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Para saber si tus números están bien hace falta algo con qué compararlos. Estos son rangos observados en programas de negocios pequeños, no un estudio nuestro ni una promesa.'
              : 'To know whether your numbers are good you need something to compare them to. These are ranges observed in small-business programmes — not a study we ran, and not a promise.'}
          </p>
        </div>
      </section>

      <Section>
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-[16px] border border-[var(--color-line)] p-5">
              <p className="text-[13px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                {basisLabels[row.basis]}
              </p>
              <h2 className="mt-2.5 text-[17px] leading-snug">{row.metric}</h2>
              <p className="tabular-nums mt-2 text-[28px] tracking-[-0.02em]">{row.range}</p>
              <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {row.note}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <SectionTitle
          title={isSpanish ? 'Qué no sabemos' : 'What we do not know'}
          body={
            isSpanish
              ? 'No tenemos datos propios de todos los sectores ni de todos los países, y no vamos a inventarlos. Donde la base de un número es una regla práctica y no una observación, lo dice encima del número. Si tus cifras se salen mucho de estos rangos, lo más probable es que tu negocio sea distinto, no que esté mal.'
              : 'We do not have our own data for every trade or every country, and we are not going to invent it. Where a number rests on a rule of thumb rather than an observation, it says so above the number. If your figures sit well outside these ranges, the likeliest explanation is that your business is different, not that it is wrong.'
          }
        />
        <p className="mt-6 text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
          {isSpanish ? 'Las palabras están definidas en el ' : 'The words are defined in the '}
          <Link
            href={`/${locale}/glosario`}
            className="text-[var(--color-primary)] underline underline-offset-4"
          >
            {isSpanish ? 'glosario' : 'glossary'}
          </Link>
          {isSpanish ? '. Para calcular lo tuyo, la ' : '. To work out your own, the '}
          <Link
            href={`/${locale}/calculadora`}
            className="text-[var(--color-primary)] underline underline-offset-4"
          >
            {isSpanish ? 'calculadora' : 'calculator'}
          </Link>
          .
        </p>
      </Section>
    </>
  )
}
