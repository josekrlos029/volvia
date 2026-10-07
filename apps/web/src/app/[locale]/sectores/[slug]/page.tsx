import { PhoneCard } from '@/components/PhoneCard'
import { Section, SectionTitle } from '@/components/Section'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import { photo } from '@/lib/photos'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    industries.map((industry) => ({ locale, slug: industry.slug })),
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const industry = industries.find((item) => item.slug === slug)
  if (!industry || !isLocale(locale)) return {}

  const copy = industry[locale]
  return {
    title: copy.headline,
    description: copy.intro.slice(0, 155),
    alternates: {
      canonical: `/${locale}/sectores/${slug}`,
      languages: { es: `/es/sectores/${slug}`, en: `/en/sectores/${slug}` },
    },
    openGraph: { title: copy.headline, description: copy.intro.slice(0, 155), type: 'article' },
  }
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const industry = industries.find((item) => item.slug === slug)
  if (!industry) notFound()

  const copy = industry[locale]
  const site = copyFor(locale)
  const isSpanish = locale === 'es'
  const related = industries.filter((item) => item.slug !== slug).slice(0, 3)

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <Link
              href={`/${locale}/sectores`}
              className="text-[14px] text-[var(--color-ink-muted)] underline underline-offset-4"
            >
              {site.nav.industries}
            </Link>
            <h1 className="mt-3 max-w-[22ch] text-[clamp(30px,4.2vw,44px)] leading-[1.06] tracking-[-0.03em]">
              {copy.headline}
            </h1>
            <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.intro}
            </p>
            <a href={`${appUrl}/signup`} className="btn-primary mt-7">
              {site.hero.cta}
            </a>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PhoneCard
              businessName={copy.name}
              cardName={isSpanish ? 'Tarjeta del club' : 'Club card'}
              filled={Math.max(2, Math.floor(copy.stamps / 2))}
              total={copy.stamps}
              reward={copy.reward}
            />
          </div>
        </div>
      </section>

      <Section tone="muted">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Image
            src={photo(industry.photoSeed)}
            alt={copy.plural}
            width={900}
            height={700}
            className="w-full rounded-[16px] object-cover"
            sizes="(max-width: 1024px) 100vw, 520px"
          />
          <div>
            <SectionTitle
              title={isSpanish ? 'Cómo configurarla' : 'How to set it up'}
              body={copy.insight}
            />
            <dl className="mt-7 grid grid-cols-2 gap-6 border-t border-[var(--color-line)] pt-6">
              <div>
                <dt className="text-[13px] text-[var(--color-ink-muted)]">
                  {isSpanish ? 'Sellos' : 'Stamps'}
                </dt>
                <dd className="mt-1 text-[26px] tabular-nums">{copy.stamps}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-[var(--color-ink-muted)]">
                  {isSpanish ? 'Recompensa' : 'Reward'}
                </dt>
                <dd className="mt-1 text-[17px] leading-snug">{copy.reward}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle title={isSpanish ? 'Otros sectores' : 'Other industries'} />
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {related.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/${locale}/sectores/${item.slug}`}
                className="block rounded-[16px] border border-[var(--color-line)] p-4 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <span className="text-[16px]">{item[locale].plural}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
