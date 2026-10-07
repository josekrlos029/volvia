import { PhoneCard } from '@/components/PhoneCard'
import { Section, SectionTitle } from '@/components/Section'
import { type Benefit, BenefitTabs } from '@/components/home/BenefitTabs'
import { CountUp } from '@/components/home/CountUp'
import { Marquee } from '@/components/home/Marquee'
import { ScrollWords } from '@/components/home/ScrollWords'
import { StickyCta } from '@/components/home/StickyCta'
import { type Story, StoryCarousel } from '@/components/home/StoryCarousel'
import { faqFor } from '@/lib/faq'
import { features, findFeature } from '@/lib/features'
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

/** Tile colours for the tools strip, cycled so neighbours never match. */
const TILE_TONES = [
  'bg-[var(--color-primary)] text-white',
  'bg-white text-black',
  'bg-[#1a1a1a] text-white ring-1 ring-white/10',
  'bg-[#c4b5fd] text-black',
]

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const copy = copyFor(locale)
  const base = `/${locale}`
  const isSpanish = locale === 'es'
  const feature = (slug: string) => {
    const found = findFeature(slug)
    if (!found) throw new Error(`Unknown feature ${slug}`)
    return { ...found[locale], slug, href: `${base}/funciones/${slug}` }
  }

  const stats = [
    { value: '55%', label: isSpanish ? 'de los clientes vuelven' : 'of customers return' },
    {
      value: '2.4',
      label: isSpanish ? 'visitas al mes por cliente' : 'visits a month per customer',
    },
    { value: '76%', label: isSpanish ? 'canjean su recompensa' : 'redeem their reward' },
    { value: '0', label: isSpanish ? 'apps que instalar' : 'apps to install' },
  ]

  const card = feature('tarjeta-de-sellos-digital')
  const segments = feature('clientes-y-segmentos')
  const automations = feature('automatizaciones')
  const reviews = feature('encuestas-y-resenas')
  const more = isSpanish ? 'Ver cómo funciona' : 'See how it works'

  const benefits: Benefit[] = [
    {
      label: isSpanish ? 'Clientes que vuelven' : 'Customers who return',
      title: card.headline,
      body: card.lede,
      photo: photo('volvia-stamp-card-phone'),
      alt: isSpanish ? 'Una tarjeta de sellos en un teléfono' : 'A stamp card on a phone',
      href: card.href,
      cta: more,
      facts: [
        { value: '0', label: isSpanish ? 'apps que instalar' : 'apps to install' },
        { value: '10 min', label: isSpanish ? 'para publicar tu tarjeta' : 'to publish your card' },
      ],
    },
    {
      label: isSpanish ? 'Saber quién vuelve' : 'Know who returns',
      title: segments.headline,
      body: segments.lede,
      photo: photo('volvia-customer-list'),
      alt: isSpanish ? 'La lista de clientes en el panel' : 'The customer list in the dashboard',
      href: segments.href,
      cta: more,
      facts: [
        {
          value: '5',
          label: isSpanish ? 'números para leer tu negocio' : 'numbers to read your shop',
        },
        {
          value: 'CSV',
          label: isSpanish ? 'tus clientes, cuando quieras' : 'your customers, any time',
        },
      ],
    },
    {
      label: isSpanish ? 'Mensajes en automático' : 'Messages on autopilot',
      title: automations.headline,
      body: automations.lede,
      photo: photo('volvia-birthday-table'),
      alt: isSpanish
        ? 'Una mesa celebrando un cumpleaños con un postre'
        : 'A table celebrating a birthday with dessert',
      href: automations.href,
      cta: more,
      facts: [
        {
          value: isSpanish ? '1 vez' : 'Once',
          label: isSpanish ? 'lo configuras y sale solo' : 'set it up and it runs itself',
        },
      ],
    },
    {
      label: isSpanish ? 'Reseñas en Google' : 'Google reviews',
      title: reviews.headline,
      body: reviews.lede,
      photo: photo('volvia-review-counter'),
      alt: isSpanish ? 'Un cliente contento en el mostrador' : 'A happy customer at the counter',
      href: reviews.href,
      cta: more,
      facts: [
        {
          value: isSpanish ? 'Después' : 'After',
          label: isSpanish ? 'de una buena visita, nunca antes' : 'a good visit, never before',
        },
      ],
    },
  ]

  const stories: Story[] = industries.slice(0, 5).map((industry) => ({
    href: `${base}/sectores/${industry.slug}`,
    eyebrow: industry[locale].plural,
    quote: industry[locale].insight,
    photo: photo(industry.photoSeed),
    cta: isSpanish ? `Ver la guía de ${industry[locale].plural.toLowerCase()}` : 'Read the guide',
    facts: [
      {
        value: String(industry[locale].stamps),
        label: isSpanish ? 'sellos por tarjeta' : 'stamps per card',
      },
      { value: industry[locale].reward, label: isSpanish ? 'la recompensa' : 'the reward' },
    ],
  }))

  const tools = [
    { label: 'Apple Wallet', slug: 'wallet' },
    { label: 'Google Wallet', slug: 'wallet' },
    { label: isSpanish ? 'Reseñas de Google' : 'Google reviews', slug: 'encuestas-y-resenas' },
    { label: isSpanish ? 'Código QR' : 'QR code', slug: 'tarjeta-de-sellos-digital' },
    { label: isSpanish ? 'Exportar a CSV' : 'CSV export', slug: 'clientes-y-segmentos' },
    { label: isSpanish ? 'Modo kiosko' : 'Kiosk mode', slug: 'modo-kiosko' },
    { label: isSpanish ? 'Escáner del equipo' : 'Staff scanner', slug: 'escaner-para-el-equipo' },
    { label: isSpanish ? 'Campañas' : 'Campaigns', slug: 'campanas' },
    { label: isSpanish ? 'Cumpleaños' : 'Birthdays', slug: 'automatizaciones' },
    { label: isSpanish ? 'Varias sedes' : 'Multiple locations', slug: 'equipo-y-sedes' },
  ]

  const questions = faqFor(locale).filter((entry) =>
    ['app', 'setup-time', 'no-smartphone', 'offline', 'cost', 'pos'].includes(entry.id),
  )

  return (
    <>
      {/* Hero: centred headline stack, then a slow strip of product moments underneath. */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-12 text-center lg:px-8 lg:pt-20">
          <p className="badge">{copy.trust.title}</p>
          <h1 className="t-display mt-8 max-w-[15ch]">
            {highlight(copy.hero.title, copy.hero.highlight)}
          </h1>
          <p className="t-subheading mt-6 max-w-[46ch] text-[var(--color-ink-muted)]">
            {copy.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <a href={`${appUrl}/signup`} className="btn-primary">
              {copy.hero.cta}
            </a>
            <Link href={`${base}/funciones`} className="btn-ghost">
              {copy.hero.secondary}
            </Link>
          </div>
        </div>

        <Marquee className="mt-14 lg:mt-20" duration={80}>
          <HeroTile
            href={card.href}
            label={card.name}
            src={photo('volvia-hero-counter')}
            alt={
              isSpanish
                ? 'Una clienta muestra su teléfono en el mostrador de una cafetería'
                : 'A customer shows her phone at a coffee shop counter'
            }
            priority
          />
          <div className="grid aspect-[3/4] w-[260px] shrink-0 place-items-center rounded-[16px] bg-[linear-gradient(160deg,#7c3aed,#2e1065)] p-6 sm:w-[300px]">
            <PhoneCard
              businessName={isSpanish ? 'Café Raíces' : 'Raices Coffee'}
              cardName={isSpanish ? 'Tarjeta Raíces' : 'Raices card'}
              filled={7}
              total={10}
              reward={isSpanish ? 'Café gratis' : 'Free coffee'}
            />
          </div>
          {features.slice(1, 7).map((item) => (
            <HeroTile
              key={item.slug}
              href={`${base}/funciones/${item.slug}`}
              label={item[locale].name}
              src={photo(item.photoSeed)}
              alt=""
            />
          ))}
        </Marquee>
      </section>

      {/* Trades as a moving type strip, where a logo wall would go. */}
      <section className="border-y border-[var(--color-line)] py-14 lg:py-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
          <ScrollWords
            text={isSpanish ? 'Hecho para negocios como el tuyo.' : 'Built for shops like yours.'}
            className="t-heading-lg text-center"
          />
        </div>
        <Marquee className="mt-10" duration={50} gap={0}>
          {industries.map((industry) => (
            <Link
              key={industry.slug}
              href={`${base}/sectores/${industry.slug}`}
              className="flex shrink-0 items-center gap-8 pr-8 text-[clamp(28px,3.4vw,44px)] tracking-[-0.03em] transition-colors hover:text-[var(--color-primary)]"
            >
              {industry[locale].plural}
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]"
              />
            </Link>
          ))}
        </Marquee>
      </section>

      {/* The dark band: product cards in a horizontal rail, no seam between card and band. */}
      <section className="bg-[var(--color-inverse-surface)] text-white">
        <div className="rise mx-auto max-w-[1200px] px-5 py-16 sm:py-20 lg:px-8 lg:py-[120px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <ScrollWords
              text={copy.features.title}
              tone="dark"
              className="t-heading-lg max-w-[18ch]"
            />
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

      {/* One trade per card: how the card is set up there, and why. */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <ScrollWords
            text={
              isSpanish
                ? 'Así se arma la tarjeta en cada negocio.'
                : 'How the card is set up in each trade.'
            }
            className="t-heading-lg max-w-[20ch]"
          />
          <Link href={`${base}/sectores`} className="btn-ghost">
            {copy.industries.cta}
          </Link>
        </div>
        <div className="mt-12">
          <StoryCarousel
            stories={stories}
            labels={isSpanish ? ['Anterior', 'Siguiente'] : ['Previous', 'Next']}
          />
        </div>
      </Section>

      {/* Outcomes behind auto-advancing tabs. */}
      <Section tone="muted">
        <ScrollWords
          text={
            isSpanish
              ? 'Volvia convierte visitas sueltas en clientes que vuelven.'
              : 'Volvia turns one-off visits into customers who come back.'
          }
          className="t-heading-lg max-w-[24ch]"
        />
        <div className="mt-12">
          <BenefitTabs benefits={benefits} />
        </div>
      </Section>

      {/* Tools strip: two rows drifting in opposite directions on black. */}
      <section className="bg-[var(--color-inverse-surface)] py-16 text-white sm:py-20 lg:py-[120px]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 text-center lg:px-8">
          <ScrollWords
            text={isSpanish ? 'Funciona con lo que ya usas.' : 'Works with what you already use.'}
            tone="dark"
            className="t-heading-lg"
          />
          <p className="t-subheading mt-5 max-w-[48ch] text-white/60">
            {isSpanish
              ? 'Tus clientes guardan la tarjeta en la wallet de su teléfono. Tú lo manejas todo desde un solo panel.'
              : 'Your customers keep the card in their phone wallet. You run everything from one dashboard.'}
          </p>
        </div>
        <div className="mt-12 flex flex-col gap-4">
          {[tools.slice(0, 5), tools.slice(5)].map((row, rowIndex) => (
            <Marquee key={row[0]?.label} duration={70} reverse={rowIndex === 1} repeat={2}>
              {row.map((tool, index) => (
                <Link
                  key={tool.label}
                  href={`${base}/funciones/${tool.slug}`}
                  className={`grid h-[96px] w-[200px] shrink-0 place-items-center rounded-[16px] px-4 text-center text-[20px] tracking-[-0.02em] transition-transform hover:-translate-y-1 sm:h-[120px] sm:w-[240px] sm:text-[24px] ${TILE_TONES[(index + rowIndex * 2) % TILE_TONES.length]}`}
                >
                  {tool.label}
                </Link>
              ))}
            </Marquee>
          ))}
        </div>
        <div className="mt-12 flex justify-center px-5">
          <Link
            href={`${base}/funciones`}
            className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3.5 text-[16px] transition-colors hover:border-white"
          >
            {isSpanish ? 'Ver todas las funciones' : 'See every feature'}{' '}
            <span aria-hidden="true">→</span>
          </Link>
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

      {/* Proof points as poster numerals that count up on arrival. */}
      <Section tone="muted">
        <ScrollWords
          text={isSpanish ? 'Los números hablan.' : 'The numbers speak.'}
          className="t-heading-lg"
        />
        <dl className="mt-12 grid gap-x-10 gap-y-14 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="border-t border-[var(--color-ink)] pt-6">
              <CountUp value={stat.value} className="t-stat" />
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

      {/* The questions people ask before signing up, answered in place. */}
      <Section tone="muted">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <ScrollWords
              text={
                isSpanish
                  ? 'Lo que nos preguntan antes de empezar.'
                  : 'What people ask before starting.'
              }
              className="t-heading-lg max-w-[16ch]"
            />
            <Link href={`${base}/preguntas`} className="btn-ghost mt-8">
              {isSpanish ? 'Todas las preguntas' : 'All questions'}
            </Link>
          </div>
          <div className="border-t border-[var(--color-line)]">
            {questions.map((entry) => (
              <details key={entry.id} className="faq-item border-b border-[var(--color-line)]">
                <summary className="t-subheading flex items-center justify-between gap-6 py-5">
                  {entry.question}
                  <span aria-hidden="true" className="faq-icon text-[24px] leading-none">
                    +
                  </span>
                </summary>
                <p className="t-body max-w-[60ch] pb-6 text-[var(--color-ink-muted)]">
                  {entry.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* Closing call to action: a violet card, the one place the accent fills a surface. */}
      <section className="px-5 pb-16 lg:px-8 lg:pb-[120px]">
        <div className="rise relative mx-auto grid max-w-[1200px] items-center gap-10 overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#2e1065_0%,#7c3aed_55%,#c084fc_100%)] p-8 text-white sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:rounded-[48px] lg:p-16">
          <div>
            <p className="t-caption text-white/70">
              {isSpanish ? 'Únete a Volvia' : 'Join Volvia'}
            </p>
            <h2 className="t-display mt-6 max-w-[14ch]">{copy.finalCta.title}</h2>
            <p className="t-subheading mt-6 max-w-[40ch] text-white/80">{copy.finalCta.body}</p>
            <a href={`${appUrl}/signup`} className="btn-inverse mt-8">
              {copy.finalCta.cta}
            </a>
          </div>
          <div className="mx-auto w-full max-w-[260px] rotate-[4deg]">
            <PhoneCard
              businessName={isSpanish ? 'Panadería La Espiga' : 'Golden Crust Bakery'}
              cardName={isSpanish ? 'Tu pan número 10' : 'Your 10th loaf'}
              filled={9}
              total={10}
              reward={isSpanish ? 'Pan gratis' : 'Free loaf'}
            />
          </div>
        </div>
      </section>

      <StickyCta href={`${appUrl}/signup`} label={copy.hero.cta} />
    </>
  )
}

/** One photograph in the hero strip, captioned with the feature it shows. */
function HeroTile({
  href,
  label,
  src,
  alt,
  priority = false,
}: {
  href: string
  label: string
  src: string
  alt: string
  priority?: boolean
}) {
  return (
    <Link href={href} className="group relative block w-[260px] shrink-0 sm:w-[300px]">
      <Image
        src={src}
        alt={alt}
        width={600}
        height={800}
        priority={priority}
        className="aspect-[3/4] w-full rounded-[16px] object-cover"
        sizes="300px"
      />
      <span className="absolute bottom-4 left-4 rounded-full bg-white px-4 py-2 text-[14px] shadow-[var(--shadow-nav)] transition-colors group-hover:bg-[var(--color-ink)] group-hover:text-white">
        {label}
      </span>
    </Link>
  )
}
