import { PhoneCard } from '@/components/PhoneCard'
import { Section, SectionTitle } from '@/components/Section'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import { FREQUENCY_LABELS, templatesFor } from '@/lib/templates'
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
    title: isSpanish ? 'Plantillas de tarjeta de sellos' : 'Stamp card templates',
    description: isSpanish
      ? 'Seis configuraciones listas según el ritmo de tu negocio: cuántos sellos, qué recompensa y por qué esa y no otra.'
      : 'Six ready-made setups by your shop’s rhythm: how many stamps, which reward, and why that one and not another.',
    alternates: {
      canonical: `/${locale}/plantillas`,
      languages: { es: '/es/plantillas', en: '/en/plantillas' },
    },
  }
}

export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const rows = templatesFor(locale)
  const site = copyFor(locale)
  const isSpanish = locale === 'es'
  const frequencies = FREQUENCY_LABELS[locale]

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[22ch] text-[clamp(30px,4.2vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em]">
            {isSpanish
              ? 'Plantillas de tarjeta, por ritmo de negocio'
              : 'Card templates, by business rhythm'}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Lo difícil de empezar no es la herramienta: es decidir cuántos sellos y qué regalas. Estas seis configuraciones son respuestas defendibles, con el porqué al lado para que puedas discrepar a propósito.'
              : 'The hard part of starting is not the tool: it is deciding how many stamps and what you give away. These six setups are defensible answers, with the reasoning beside them so you can disagree on purpose.'}
          </p>
        </div>
      </section>

      {rows.map((template, index) => {
        const related = industries.filter((industry) => template.industries.includes(industry.slug))
        return (
          <Section key={template.slug} tone={index % 2 === 0 ? 'plain' : 'muted'}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
              <div className={index % 2 === 0 ? '' : 'lg:order-2'}>
                <SectionTitle title={template.name} body={template.why} />

                <dl className="mt-7 grid grid-cols-2 gap-6 border-t border-[var(--color-line)] pt-6 sm:grid-cols-4">
                  <div>
                    <dt className="text-[13px] text-[var(--color-ink-muted)]">
                      {isSpanish ? 'Sellos' : 'Stamps'}
                    </dt>
                    <dd className="tabular-nums mt-1 text-[24px] font-semibold">
                      {template.stamps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-[var(--color-ink-muted)]">
                      {isSpanish ? 'De regalo' : 'Head start'}
                    </dt>
                    <dd className="tabular-nums mt-1 text-[24px] font-semibold">
                      {template.initialStamps}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[13px] text-[var(--color-ink-muted)]">
                      {isSpanish ? 'Vuelven' : 'They return'}
                    </dt>
                    <dd className="mt-1 text-[17px] font-medium leading-snug">
                      {frequencies[template.frequency]}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-[13px] text-[var(--color-ink-muted)]">
                      {isSpanish ? 'Recompensa' : 'Reward'}
                    </dt>
                    <dd className="mt-1 text-[17px] font-medium leading-snug">
                      {template.reward}
                      {template.intermediate ? (
                        <span className="block text-[15px] font-normal text-[var(--color-ink-muted)]">
                          {template.intermediate}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                {related.length > 0 ? (
                  <p className="mt-6 text-[15px] text-[var(--color-ink-muted)]">
                    {isSpanish ? 'Pensada para ' : 'Built for '}
                    {related.map((industry, position) => (
                      <span key={industry.slug}>
                        {position > 0 ? ', ' : ''}
                        <Link
                          href={`/${locale}/sectores/${industry.slug}`}
                          className="font-medium text-[var(--color-primary)] underline underline-offset-4"
                        >
                          {industry[locale].plural.toLowerCase()}
                        </Link>
                      </span>
                    ))}
                    .
                  </p>
                ) : null}
              </div>

              <div
                className={`flex justify-center ${index % 2 === 0 ? 'lg:justify-end' : 'lg:order-1 lg:justify-start'}`}
              >
                <PhoneCard
                  businessName={template.name}
                  cardName={isSpanish ? 'Tarjeta del club' : 'Club card'}
                  filled={Math.max(template.initialStamps, Math.floor(template.stamps / 2))}
                  total={template.stamps}
                  reward={template.reward}
                />
              </div>
            </div>
          </Section>
        )
      })}

      <Section tone="ink">
        <div className="mx-auto max-w-[38ch] text-center">
          <h2 className="text-[clamp(26px,3.6vw,38px)] font-semibold leading-[1.1] tracking-[-0.02em]">
            {isSpanish ? 'Elige una y cámbiala' : 'Pick one and change it'}
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-white/70">
            {isSpanish
              ? 'Todas se crean en un par de minutos y se ajustan a tu negocio. Lo único que conviene pensar bien antes es el número de sellos: una vez que hay clientes dentro, ya no se toca.'
              : 'Each takes a couple of minutes to create and adapts to your shop. The one thing worth thinking through first is the stamp count: once customers are collecting, it stays put.'}
          </p>
          <a
            href={`${appUrl}/signup`}
            className="mt-7 inline-block rounded-[10px] bg-white px-5 py-3 text-[15px] font-semibold text-[var(--color-ink)] transition-transform duration-150 active:scale-[0.985]"
          >
            {site.hero.cta}
          </a>
        </div>
      </Section>
    </>
  )
}
