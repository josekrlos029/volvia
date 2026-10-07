import { Section, SectionTitle } from '@/components/Section'
import { FAQ_GROUPS, faq } from '@/lib/faq'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
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
    title: isSpanish ? 'Preguntas frecuentes' : 'Frequently asked questions',
    description: isSpanish
      ? 'Qué pasa con las tarjetas de cartón, quién es dueño de los datos, cómo se evita el fraude y qué cuesta. Respuestas directas, incluso cuando la respuesta es no.'
      : 'What happens to your paper cards, who owns the data, how fraud is prevented and what it costs. Direct answers, including when the answer is no.',
    alternates: {
      canonical: `/${locale}/preguntas`,
      languages: { es: '/es/preguntas', en: '/en/preguntas' },
    },
  }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const site = copyFor(locale)
  const isSpanish = locale === 'es'
  const groups = FAQ_GROUPS[locale]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry[locale].question,
      acceptedAnswer: { '@type': 'Answer', text: entry[locale].answer },
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
            {isSpanish ? 'Preguntas frecuentes' : 'Frequently asked questions'}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Las que nos hacen antes de empezar. Donde la respuesta honesta es «no» o «depende», lo decimos.'
              : 'The ones we get asked before signing up. Where the honest answer is “no” or “it depends”, we say so.'}
          </p>
        </div>
      </section>

      {(Object.keys(groups) as Array<keyof typeof groups>).map((group, index) => {
        const entries = faq.filter((entry) => entry.group === group)
        return (
          <Section key={group} tone={index % 2 === 0 ? 'plain' : 'muted'}>
            <SectionTitle title={groups[group]} />
            <dl className="mt-8 flex flex-col divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid gap-2 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10"
                >
                  <dt className="text-[17px] font-semibold leading-snug">
                    {entry[locale].question}
                  </dt>
                  <dd className="max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
                    {entry[locale].answer}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        )
      })}

      <Section tone="ink">
        <div className="mx-auto max-w-[40ch] text-center">
          <h2 className="text-[clamp(26px,3.6vw,38px)] font-semibold leading-[1.1] tracking-[-0.02em]">
            {isSpanish ? '¿Te queda alguna?' : 'Still have one?'}
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-white/70">
            {isSpanish
              ? 'Escríbenos y te contesta una persona que conoce el producto, normalmente el mismo día.'
              : 'Write to us and a person who knows the product answers, usually the same day.'}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/${locale}/contacto`}
              className="rounded-[10px] bg-white px-5 py-3 text-[15px] font-semibold text-[var(--color-ink)] transition-transform duration-150 active:scale-[0.985]"
            >
              {isSpanish ? 'Escribirnos' : 'Write to us'}
            </Link>
            <a
              href={`${appUrl}/signup`}
              className="rounded-[10px] border border-white/30 px-5 py-3 text-[15px] font-semibold text-white"
            >
              {site.hero.cta}
            </a>
          </div>
        </div>
      </Section>
    </>
  )
}
