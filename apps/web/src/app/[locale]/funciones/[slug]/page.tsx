import { Section, SectionTitle } from '@/components/Section'
import { features, findFeature } from '@/lib/features'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
import { photo } from '@/lib/photos'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => features.map((feature) => ({ locale, slug: feature.slug })))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const feature = findFeature(slug)
  if (!feature || !isLocale(locale)) return {}

  const copy = feature[locale]
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `/${locale}/funciones/${slug}`,
      languages: { es: `/es/funciones/${slug}`, en: `/en/funciones/${slug}` },
    },
    openGraph: { title: copy.title, description: copy.description, type: 'article' },
  }
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const feature = findFeature(slug)
  if (!feature) notFound()

  const copy = feature[locale]
  const site = copyFor(locale)
  const isSpanish = locale === 'es'
  const related = feature.related
    .map((key) => findFeature(key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  /** One question and one answer, so the page can earn a rich result honestly. */
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: copy.question,
        acceptedAnswer: { '@type': 'Answer', text: copy.answer },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data, built from our own content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
          <Link
            href={`/${locale}/funciones`}
            className="text-[14px] text-[var(--color-ink-muted)] underline underline-offset-4"
          >
            {site.nav.features}
          </Link>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(30px,4.2vw,44px)] leading-[1.06] tracking-[-0.03em]">
            {copy.headline}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {copy.lede}
          </p>
          <a href={`${appUrl}/signup`} className="btn-primary mt-7">
            {site.hero.cta}
          </a>
        </div>
      </section>

      <Section tone="muted">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle title={copy.problem.title} body={copy.problem.body} />
          </div>
          <Image
            src={photo(feature.photoSeed)}
            alt=""
            width={900}
            height={700}
            className="w-full rounded-[16px] object-cover"
            sizes="(max-width: 1024px) 100vw, 520px"
          />
        </div>
      </Section>

      <Section>
        <SectionTitle title={copy.how.title} body={copy.how.body} />
        <ul className="mt-9 grid gap-5 sm:grid-cols-3">
          {copy.details.map((detail) => (
            <li key={detail.title} className="rounded-[16px] border border-[var(--color-line)] p-5">
              <h3 className="text-[16px]">{detail.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {detail.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle title={isSpanish ? 'Dónde no sirve' : 'Where it does not help'} />
            <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.caveat}
            </p>
          </div>
          <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
            <h3 className="text-[17px] leading-snug">{copy.question}</h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.answer}
            </p>
            <Link
              href={`/${locale}/preguntas`}
              className="mt-4 inline-block text-[14px] text-[var(--color-primary)] underline underline-offset-4"
            >
              {isSpanish ? 'Ver todas las preguntas' : 'See every question'}
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle title={isSpanish ? 'Relacionado' : 'Related'} />
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {related.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/${locale}/funciones/${item.slug}`}
                className="block h-full rounded-[16px] border border-[var(--color-line)] p-4 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <span className="text-[16px]">{item[locale].name}</span>
                <span className="mt-1.5 block text-[14px] leading-snug text-[var(--color-ink-muted)]">
                  {item[locale].description.slice(0, 90)}…
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
