import { Section } from '@/components/Section'
import { glossaryFor } from '@/lib/glossary'
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
    title: isSpanish ? 'Glosario de fidelización' : 'Loyalty glossary',
    description: isSpanish
      ? 'Tasa de repetición, fuga, canje, ventaja inicial, consentimiento. Qué significa cada palabra, cómo se mide y con qué se confunde.'
      : 'Repeat rate, churn, redemption, head start, consent. What each word means, how it is measured and what it gets confused with.',
    alternates: {
      canonical: `/${locale}/glosario`,
      languages: { es: '/es/glosario', en: '/en/glosario' },
    },
  }
}

export default async function GlossaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const terms = glossaryFor(locale)
  const isSpanish = locale === 'es'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: isSpanish ? 'Glosario de fidelización' : 'Loyalty glossary',
    hasDefinedTerm: terms.map((term) => ({
      '@type': 'DefinedTerm',
      name: term.term,
      description: term.short,
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
        <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[20ch] text-[clamp(30px,4.2vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em]">
            {isSpanish ? 'Glosario de fidelización' : 'Loyalty glossary'}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Media docena de estas palabras se usan para decir tres cosas distintas según quién venda. Aquí está lo que significan, cómo se miden y con qué se confunden.'
              : 'Half of these words are used to mean three different things depending on who is selling. Here is what they mean, how they are measured, and what they get confused with.'}
          </p>
        </div>
      </section>

      <Section>
        <dl className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {terms.map((term) => (
            <div key={term.slug} id={term.slug} className="scroll-mt-24">
              <dt className="text-[19px] font-semibold leading-snug">{term.term}</dt>
              <dd>
                <p className="mt-1.5 text-[15px] font-medium text-[var(--color-ink)]">
                  {term.short}
                </p>
                <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                  {term.body}
                </p>
                {term.confusedWith ? (
                  <p className="mt-2.5 max-w-[56ch] border-l-2 border-[var(--color-line)] pl-3 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
                    {term.confusedWith}
                  </p>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="muted">
        <p className="text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
          {isSpanish
            ? 'Los números detrás de estas palabras están en '
            : 'The numbers behind these words are in '}
          <Link
            href={`/${locale}/referencias`}
            className="font-medium text-[var(--color-primary)] underline underline-offset-4"
          >
            {isSpanish ? 'referencias' : 'benchmarks'}
          </Link>
          .
        </p>
      </Section>
    </>
  )
}
