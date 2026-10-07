import { PhoneCard } from '@/components/PhoneCard'
import { Section, SectionTitle } from '@/components/Section'
import { copyFor, isLocale } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const copy = copyFor(locale)
  const base = `/${locale}`
  const isSpanish = locale === 'es'

  return (
    <>
      {/* Hero: text left, the product itself right. No fake screenshot, no gradient blob. */}
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
          <div>
            <h1 className="max-w-[20ch] text-[clamp(32px,4.6vw,50px)] font-semibold leading-[1.06] tracking-[-0.03em]">
              {copy.hero.title}
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
              {copy.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={`${appUrl}/signup`}
                className="rounded-[10px] bg-[var(--color-primary)] px-5 py-3 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[var(--color-primary-hover)] active:scale-[0.985]"
              >
                {copy.hero.cta}
              </a>
              <Link
                href={`${base}/funciones`}
                className="rounded-[10px] border border-[var(--color-line)] px-5 py-3 text-[15px] font-medium transition-colors hover:bg-[var(--color-surface-muted)]"
              >
                {copy.hero.secondary}
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PhoneCard
              businessName={isSpanish ? 'Café Raíces' : 'Raices Coffee'}
              cardName={isSpanish ? 'Tarjeta Raíces' : 'Raices card'}
              filled={7}
              total={10}
              reward={isSpanish ? 'Café gratis' : 'Free coffee'}
            />
          </div>
        </div>
      </section>

      {/* Trust sits under the hero, never inside it. */}
      <div className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)]">
        <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-8">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
            {copy.trust.title}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-[15px] text-[var(--color-ink)]">
            {industries.slice(0, 6).map((industry) => (
              <li key={industry.slug}>
                <Link
                  href={`${base}/sectores/${industry.slug}`}
                  className="underline decoration-[var(--color-line)] decoration-2 underline-offset-4 transition-colors hover:decoration-[var(--color-primary)]"
                >
                  {industry[locale].plural}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Steps as a numbered flow rather than three identical cards. */}
      <Section>
        <SectionTitle title={copy.steps.title} />
        <ol className="mt-10 grid gap-8 lg:grid-cols-3 lg:gap-10">
          {copy.steps.items.map((step, index) => (
            <li key={step.title} className="border-t-2 border-[var(--color-ink)] pt-4">
              <span className="tabular-nums text-[13px] font-semibold text-[var(--color-primary)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-[19px] font-semibold leading-tight">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Split with a real photograph, reversed from the hero so the rhythm changes. */}
      <Section tone="muted">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <Image
              src="https://picsum.photos/seed/volvia-phone-wallet-counter/900/700"
              alt={
                isSpanish
                  ? 'Una persona paga en el mostrador con su teléfono en la mano'
                  : 'Someone paying at a counter with their phone in hand'
              }
              width={900}
              height={700}
              className="w-full rounded-[16px] object-cover"
              sizes="(max-width: 1024px) 100vw, 520px"
            />
          </div>

          <div className="order-1 lg:order-2">
            <SectionTitle title={copy.wallet.title} body={copy.wallet.body} />
            <ul className="mt-6 flex flex-col gap-3">
              {copy.wallet.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[16px]">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Bento with mixed cell sizes and one dark cell, so it is not six white boxes. */}
      <Section>
        <SectionTitle title={copy.features.title} />
        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          <article className="rounded-[14px] bg-[var(--color-inverse-surface)] p-6 text-white lg:col-span-2 lg:row-span-2">
            <h3 className="text-[22px] font-semibold leading-tight">
              {isSpanish
                ? 'Sabes quién vuelve y quién no'
                : 'You know who returns and who does not'}
            </h3>
            <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-white/70">
              {isSpanish
                ? 'Cada sello es un dato: cuántos vuelven, cada cuánto, a qué hora y qué día llenas el local. Los segmentos de clientes en riesgo se arman solos.'
                : 'Every stamp is a data point: how many return, how often, at what hour, and which day fills your shop. At-risk segments build themselves.'}
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/12 pt-6">
              {[
                { value: '55%', label: isSpanish ? 'vuelven' : 'return' },
                { value: '2.4', label: isSpanish ? 'visitas al mes' : 'visits a month' },
                { value: '76%', label: isSpanish ? 'canjean' : 'redeem' },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-[24px] font-semibold tabular-nums">{stat.value}</dt>
                  <dd className="mt-0.5 text-[13px] text-white/60">{stat.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12px] text-white/45">
              {isSpanish
                ? 'Cifras de ejemplo de una cuenta de demostración.'
                : 'Example figures from a demonstration account.'}
            </p>
          </article>

          <article className="rounded-[14px] border border-[var(--color-line)] p-6">
            <h3 className="text-[17px] font-semibold leading-tight">
              {isSpanish ? 'Cumpleaños en automático' : 'Birthdays on autopilot'}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
              {isSpanish
                ? 'Se configura una vez y sale solo, en la hora de tu negocio.'
                : 'Set it once and it runs itself, in your shop timezone.'}
            </p>
          </article>

          <article className="overflow-hidden rounded-[14px] border border-[var(--color-line)]">
            <Image
              src="https://picsum.photos/seed/volvia-barber-hands/560/320"
              alt={isSpanish ? 'Un barbero terminando un corte' : 'A barber finishing a cut'}
              width={560}
              height={320}
              className="h-[150px] w-full object-cover"
              sizes="(max-width: 1024px) 100vw, 360px"
            />
            <div className="p-6">
              <h3 className="text-[17px] font-semibold leading-tight">
                {isSpanish ? 'Reseñas de quien sí volvió' : 'Reviews from people who came back'}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {isSpanish
                  ? 'Pides la reseña justo después de una recompensa, no al azar.'
                  : 'You ask right after a reward, not at random.'}
              </p>
            </div>
          </article>
        </div>
      </Section>

      <Section tone="muted">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle title={copy.industries.title} />
          <Link
            href={`${base}/sectores`}
            className="text-[15px] font-medium text-[var(--color-primary)] underline underline-offset-4"
          >
            {copy.industries.cta}
          </Link>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {industries.slice(0, 8).map((industry) => (
            <li key={industry.slug}>
              <Link
                href={`${base}/sectores/${industry.slug}`}
                className="flex h-full flex-col rounded-[12px] border border-[var(--color-line)] bg-white p-4 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <span className="text-[16px] font-medium">{industry[locale].plural}</span>
                <span className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
                  {industry[locale].reward}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="ink">
        <div className="mx-auto max-w-[36ch] text-center">
          <h2 className="text-[clamp(26px,3.6vw,38px)] font-semibold leading-[1.1] tracking-[-0.02em]">
            {copy.finalCta.title}
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-white/70">{copy.finalCta.body}</p>
          <a
            href={`${appUrl}/signup`}
            className="mt-7 inline-block rounded-[10px] bg-white px-5 py-3 text-[15px] font-semibold text-[var(--color-ink)] transition-transform duration-150 active:scale-[0.985]"
          >
            {copy.finalCta.cta}
          </a>
        </div>
      </Section>
    </>
  )
}
