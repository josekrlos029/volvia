import { Section, SectionTitle } from '@/components/Section'
import { isLocale } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isSpanish = locale === 'es'
  return {
    title: isSpanish ? 'Sectores' : 'Industries',
    description: isSpanish
      ? 'Cómo funciona una tarjeta de fidelización en cafeterías, barberías, restaurantes, gimnasios y más.'
      : 'How a loyalty card works in coffee shops, barbershops, restaurants, gyms and more.',
    alternates: { canonical: `/${locale}/sectores` },
  }
}

export default async function IndustriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const isSpanish = locale === 'es'

  return (
    <Section>
      <SectionTitle
        as="h1"
        title={isSpanish ? 'Cada negocio tiene su ritmo' : 'Every trade has its own rhythm'}
        body={
          isSpanish
            ? 'Una cafetería y una barbería no necesitan la misma tarjeta. Estas son las configuraciones que funcionan en cada caso.'
            : 'A coffee shop and a barbershop do not need the same card. These are the setups that work in each case.'
        }
      />

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {industries.map((industry) => {
          const copy = industry[locale]
          return (
            <li key={industry.slug}>
              <Link
                href={`/${locale}/sectores/${industry.slug}`}
                className="flex h-full flex-col rounded-[14px] border border-[var(--color-line)] bg-white p-5 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <h2 className="text-[18px] font-semibold leading-tight">{copy.plural}</h2>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                  {copy.reward}
                </p>
                <p className="mt-4 text-[13px] tabular-nums text-[var(--color-primary)]">
                  {copy.stamps} {isSpanish ? 'sellos' : 'stamps'}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
