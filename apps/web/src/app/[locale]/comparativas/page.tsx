import { Section } from '@/components/Section'
import { comparisons } from '@/lib/comparisons'
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
    title: isSpanish ? 'Comparativas' : 'Comparisons',
    description: isSpanish
      ? 'Cartón, app propia o puntos. Qué hace mejor cada opción y cuándo no deberías cambiarte.'
      : 'Paper, your own app, or points. What each option does better, and when you should not switch.',
    alternates: {
      canonical: `/${locale}/comparativas`,
      languages: { es: '/es/comparativas', en: '/en/comparativas' },
    },
  }
}

export default async function ComparisonsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const isSpanish = locale === 'es'

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[20ch] text-[clamp(30px,4.2vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em]">
            {isSpanish ? 'Comparativas' : 'Comparisons'}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Cada una empieza por lo que la otra opción hace mejor, y termina diciéndote cuándo no deberías cambiarte. Si todas acabaran en «cámbiate», no servirían de nada.'
              : 'Each one starts with what the other option does better, and ends by telling you when you should not switch. If they all ended in “switch”, they would be worthless.'}
          </p>
        </div>
      </section>

      <Section>
        <ul className="grid gap-4 md:grid-cols-3">
          {comparisons.map((comparison) => (
            <li key={comparison.slug}>
              <Link
                href={`/${locale}/comparativas/${comparison.slug}`}
                className="flex h-full flex-col rounded-[14px] border border-[var(--color-line)] p-5 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <h2 className="text-[18px] font-semibold leading-snug">
                  {comparison[locale].headline}
                </h2>
                <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                  {comparison[locale].lede}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
