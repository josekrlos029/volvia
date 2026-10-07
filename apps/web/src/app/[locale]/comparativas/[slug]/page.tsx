import { Section, SectionTitle } from '@/components/Section'
import { comparisons, findComparison } from '@/lib/comparisons'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    comparisons.map((comparison) => ({ locale, slug: comparison.slug })),
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const comparison = findComparison(slug)
  if (!comparison || !isLocale(locale)) return {}

  const copy = comparison[locale]
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `/${locale}/comparativas/${slug}`,
      languages: { es: `/es/comparativas/${slug}`, en: `/en/comparativas/${slug}` },
    },
    openGraph: { title: copy.title, description: copy.description, type: 'article' },
  }
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const comparison = findComparison(slug)
  if (!comparison) notFound()

  const copy = comparison[locale]
  const site = copyFor(locale)
  const isSpanish = locale === 'es'
  const others = comparisons.filter((item) => item.slug !== slug)

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[20ch] text-[clamp(30px,4.2vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em]">
            {copy.headline}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {copy.lede}
          </p>
        </div>
      </section>

      {/* The alternative's case first, in full. A comparison where the other option has
          no advantages reads as an advertisement. */}
      <Section tone="muted">
        <SectionTitle
          title={isSpanish ? 'En qué es mejor lo otro' : 'Where the other option wins'}
        />
        <ul className="mt-8 grid gap-5 sm:grid-cols-3">
          {copy.theirStrengths.map((item) => (
            <li
              key={item.title}
              className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
            >
              <h3 className="text-[16px] font-semibold">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionTitle title={isSpanish ? 'En qué es mejor Volvia' : 'Where Volvia wins'} />
        <ul className="mt-8 grid gap-5 sm:grid-cols-3">
          {copy.ourStrengths.map((item) => (
            <li key={item.title} className="rounded-[14px] border border-[var(--color-line)] p-5">
              <h3 className="text-[16px] font-semibold">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <SectionTitle title={isSpanish ? 'Qué elegir' : 'Which to choose'} />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
            <h3 className="text-[16px] font-semibold">
              {isSpanish ? 'Quédate con lo otro si…' : 'Stay with the other if…'}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.verdict.forThem}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--color-primary)]/45 bg-[var(--color-surface)] p-6">
            <h3 className="text-[16px] font-semibold">
              {isSpanish ? 'Pásate a Volvia si…' : 'Move to Volvia if…'}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.verdict.forUs}
            </p>
            <a
              href={`${appUrl}/signup`}
              className="mt-5 inline-block rounded-[10px] bg-[var(--color-primary)] px-5 py-3 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[var(--color-primary-hover)] active:scale-[0.985]"
            >
              {site.hero.cta}
            </a>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle title={isSpanish ? 'Otras comparativas' : 'Other comparisons'} />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {others.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/${locale}/comparativas/${item.slug}`}
                className="block rounded-[12px] border border-[var(--color-line)] p-4 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <span className="text-[16px] font-medium">{item[locale].headline}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
