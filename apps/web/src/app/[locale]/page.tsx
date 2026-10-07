import { PhoneCard } from '@/components/PhoneCard'
import { Section, SectionTitle } from '@/components/Section'
import { copyFor, isLocale } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import { photo } from '@/lib/photos'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/** Splits a headline around its key phrase so that phrase alone can carry the accent. */
function highlight(title: string, phrase: string) {
  const at = title.toLowerCase().indexOf(phrase.toLowerCase())
  if (at < 0) return title
  return (
    <>
      {title.slice(0, at)}
      <span className="text-[var(--color-primary)]">{title.slice(at, at + phrase.length)}</span>
      {title.slice(at + phrase.length)}
    </>
  )
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const copy = copyFor(locale)
  const base = `/${locale}`
  const isSpanish = locale === 'es'

  const stats = [
    { value: '55%', label: isSpanish ? 'de los clientes vuelven' : 'of customers return' },
    {
      value: '2.4',
      label: isSpanish ? 'visitas al mes por cliente' : 'visits a month per customer',
    },
    { value: '76%', label: isSpanish ? 'canjean su recompensa' : 'redeem their reward' },
    { value: '0', label: isSpanish ? 'apps que instalar' : 'apps to install' },
  ]

  return (
    <>
      {/* Hero: a type-led headline stack on the left, warm photography on the right. */}
      <section>
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-[120px] lg:pt-20">
          <div>
            <p className="badge">{copy.trust.title}</p>
            <h1 className="t-display mt-8 max-w-[13ch]">
              {highlight(copy.hero.title, copy.hero.highlight)}
            </h1>
            <p className="t-subheading mt-6 max-w-[42ch] text-[var(--color-ink-muted)]">
              {copy.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <a href={`${appUrl}/signup`} className="btn-primary">
                {copy.hero.cta}
              </a>
              <Link href={`${base}/funciones`} className="btn-ghost">
                {copy.hero.secondary}
              </Link>
            </div>
          </div>

          <div className="relative pb-10 lg:pb-12">
            <Image
              src={photo('volvia-hero-counter')}
              alt={
                isSpanish
                  ? 'Una clienta muestra su teléfono en el mostrador de una cafetería'
                  : 'A customer shows her phone at a coffee shop counter'
              }
              width={1200}
              height={1400}
              priority
              className="aspect-[6/7] w-full rounded-[16px] object-cover"
              sizes="(max-width: 1024px) 100vw, 560px"
            />
            <div className="absolute -bottom-2 left-4 w-[62%] max-w-[260px] sm:left-6 lg:-bottom-12 lg:-left-10 lg:w-[46%]">
              <PhoneCard
                businessName={isSpanish ? 'Café Raíces' : 'Raices Coffee'}
                cardName={isSpanish ? 'Tarjeta Raíces' : 'Raices card'}
                filled={7}
                total={10}
                reward={isSpanish ? 'Café gratis' : 'Free coffee'}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sectors as hairline link pills: proof of fit without a logo wall. */}
      <div className="border-y border-[var(--color-line)]">
        <ul className="mx-auto flex max-w-[1200px] flex-wrap gap-2 px-5 py-6 lg:px-8">
          {industries.slice(0, 8).map((industry) => (
            <li key={industry.slug}>
              <Link
                href={`${base}/sectores/${industry.slug}`}
                className="inline-block rounded-[24px] border border-[var(--color-line)] px-4 py-2 text-[14px] transition-colors hover:border-[var(--color-ink)]"
              >
                {industry[locale].plural}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Proof points as poster numerals. The size jump from body to stat is the point. */}
      <Section>
        <dl className="grid gap-x-10 gap-y-14 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="border-t border-[var(--color-ink)] pt-6">
              <dt className="t-stat">{stat.value}</dt>
              <dd className="t-body-sm mt-4 text-[var(--color-ink-muted)]">{stat.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-[12px] text-[var(--color-ink-muted)]">
          {isSpanish
            ? 'Cifras de ejemplo de una cuenta de demostración.'
            : 'Example figures from a demonstration account.'}
        </p>
      </Section>

      {/* Steps as a numbered, type-only flow. */}
      <Section tone="muted">
        <SectionTitle eyebrow={copy.steps.eyebrow} title={copy.steps.title} />
        <ol className="mt-14 grid gap-10 lg:grid-cols-3">
          {copy.steps.items.map((step, index) => (
            <li key={step.title} className="border-t border-[var(--color-ink)] pt-6">
              <span className="t-display block tabular-nums">{index + 1}</span>
              <h3 className="t-heading-sm mt-8">{step.title}</h3>
              <p className="t-body mt-3 max-w-[36ch] text-[var(--color-ink-muted)]">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* The one dark band: product cards in a horizontal rail, no seam between card and band. */}
      <section className="bg-[var(--color-inverse-surface)] text-white">
        <div className="rise mx-auto max-w-[1200px] px-5 py-16 sm:py-20 lg:px-8 lg:py-[120px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="t-heading-lg max-w-[18ch]">{copy.features.title}</h2>
            <Link href={`${base}/funciones`} className="btn-inverse">
              {copy.hero.secondary}
            </Link>
          </div>

          <div className="rail mt-12 lg:grid-cols-4 lg:grid-flow-row lg:overflow-visible">
            <article className="flex flex-col rounded-[16px] bg-black">
              <div className="grid aspect-[4/5] place-items-center rounded-[16px] bg-[#111111] p-6">
                <div className="w-full max-w-[220px]">
                  <PhoneCard
                    businessName={isSpanish ? 'Barbería Norte' : 'North Barbers'}
                    cardName={isSpanish ? 'El 8.º corte, gratis' : '8th cut free'}
                    filled={6}
                    total={8}
                    reward={isSpanish ? 'Corte gratis' : 'Free cut'}
                  />
                </div>
              </div>
              <h3 className="t-subheading mt-5">
                {isSpanish ? 'Tu tarjeta, en su Wallet' : 'Your card, in their Wallet'}
              </h3>
              <p className="t-body-sm mt-2 text-white/60">{copy.wallet.points.join(' · ')}</p>
            </article>

            <article className="flex flex-col rounded-[16px] bg-black">
              <div className="flex aspect-[4/5] flex-col justify-end rounded-[16px] bg-[#111111] p-6">
                <p className="t-stat text-[clamp(64px,8vw,96px)]">55%</p>
                <p className="t-body-sm mt-3 text-white/60">
                  {isSpanish ? 'de los clientes vuelven' : 'of customers return'}
                </p>
              </div>
              <h3 className="t-subheading mt-5">
                {isSpanish
                  ? 'Sabes quién vuelve y quién no'
                  : 'You know who returns and who does not'}
              </h3>
              <p className="t-body-sm mt-2 text-white/60">
                {isSpanish
                  ? 'Cada sello es un dato. Los clientes en riesgo se agrupan solos.'
                  : 'Every stamp is a data point. At-risk customers group themselves.'}
              </p>
            </article>

            <article className="flex flex-col rounded-[16px] bg-black">
              <Image
                src={photo('volvia-birthday-table')}
                alt={
                  isSpanish
                    ? 'Una mesa celebrando un cumpleaños con un postre'
                    : 'A table celebrating a birthday with dessert'
                }
                width={640}
                height={800}
                className="aspect-[4/5] w-full rounded-[16px] object-cover"
                sizes="(max-width: 1024px) 80vw, 280px"
              />
              <h3 className="t-subheading mt-5">
                {isSpanish ? 'Cumpleaños en automático' : 'Birthdays on autopilot'}
              </h3>
              <p className="t-body-sm mt-2 text-white/60">
                {isSpanish
                  ? 'Se configura una vez y sale solo, en la hora de tu negocio.'
                  : 'Set it once and it runs itself, in your shop timezone.'}
              </p>
            </article>

            <article className="flex flex-col rounded-[16px] bg-black">
              <Image
                src={photo('volvia-barber-hands')}
                alt={isSpanish ? 'Un barbero terminando un corte' : 'A barber finishing a cut'}
                width={640}
                height={800}
                className="aspect-[4/5] w-full rounded-[16px] object-cover"
                sizes="(max-width: 1024px) 80vw, 280px"
              />
              <h3 className="t-subheading mt-5">
                {isSpanish ? 'Reseñas de quien sí volvió' : 'Reviews from people who came back'}
              </h3>
              <p className="t-body-sm mt-2 text-white/60">
                {isSpanish
                  ? 'Pides la reseña justo después de una recompensa, no al azar.'
                  : 'You ask right after a reward, not at random.'}
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Wallet split: photograph left, the argument right. */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Image
            src={photo('volvia-phone-wallet-counter')}
            alt={
              isSpanish
                ? 'Una persona paga en el mostrador con su teléfono en la mano'
                : 'Someone paying at a counter with their phone in hand'
            }
            width={1200}
            height={960}
            className="w-full rounded-[16px] object-cover"
            sizes="(max-width: 1024px) 100vw, 560px"
          />
          <div>
            <SectionTitle title={copy.wallet.title} body={copy.wallet.body} />
            <ul className="mt-8 flex flex-col border-t border-[var(--color-line)]">
              {copy.wallet.points.map((point) => (
                <li
                  key={point}
                  className="t-body flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-4"
                >
                  {point}
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[var(--color-primary)]"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Sectors as photo cards on white. */}
      <Section tone="muted">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle eyebrow={copy.nav.industries} title={copy.industries.title} />
          <Link href={`${base}/sectores`} className="btn-ghost">
            {copy.industries.cta}
          </Link>
        </div>

        <ul className="mt-12 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {industries.slice(0, 8).map((industry) => (
            <li key={industry.slug}>
              <Link href={`${base}/sectores/${industry.slug}`} className="group block">
                <Image
                  src={photo(industry.photoSeed)}
                  alt=""
                  width={600}
                  height={600}
                  className="aspect-square w-full rounded-[16px] object-cover transition-opacity duration-200 group-hover:opacity-90"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                />
                <span className="t-subheading mt-4 block">{industry[locale].plural}</span>
                <span className="t-body-sm mt-1 block text-[var(--color-ink-muted)]">
                  {industry[locale].reward}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Closing call to action: white, poster-sized, one black pill. */}
      <Section tone="muted">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="t-display max-w-[14ch]">{copy.finalCta.title}</h2>
          <div className="max-w-[36ch]">
            <p className="t-subheading text-[var(--color-ink-muted)]">{copy.finalCta.body}</p>
            <a href={`${appUrl}/signup`} className="btn-primary mt-6">
              {copy.finalCta.cta}
            </a>
          </div>
        </div>
      </Section>
    </>
  )
}
