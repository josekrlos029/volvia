import { Section, SectionTitle } from '@/components/Section'
import { features } from '@/lib/features'
import { copyFor, isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isSpanish = locale === 'es'
  return {
    title: isSpanish ? 'Funciones' : 'Features',
    description: isSpanish
      ? 'Tarjeta digital, wallet, escáner para tu equipo, modo kiosko, campañas, encuestas y analítica de quién vuelve.'
      : 'Digital card, wallet passes, a scanner for your team, kiosk mode, campaigns, surveys and analytics on who returns.',
    alternates: { canonical: `/${locale}/funciones` },
  }
}

const GROUPS = {
  es: [
    {
      title: 'En el mostrador',
      body: 'Lo que tu equipo usa todos los días, en el celular que ya tiene en el bolsillo.',
      photoSeed: 'volvia-counter-service',
      items: [
        {
          name: 'Escáner para tu equipo',
          body: 'Escanea la tarjeta del cliente y suma el sello en un segundo. Funciona sin señal: guarda los sellos y los envía cuando vuelve la conexión.',
        },
        {
          name: 'Modo kiosko',
          body: 'Una pantalla muestra un código que cambia cada 30 segundos. El cliente se sella solo y tu equipo no interrumpe lo que está haciendo.',
        },
        {
          name: 'Reglas anti abuso',
          body: 'Espera mínima entre sellos, tope diario y registro de quién puso cada uno. Puedes soltar el control sin perderlo.',
        },
      ],
    },
    {
      title: 'En el teléfono del cliente',
      body: 'La tarjeta se ve bien y se actualiza sola, sin que nadie instale nada.',
      photoSeed: 'volvia-customer-phone',
      items: [
        {
          name: 'Apple y Google Wallet',
          body: 'La tarjeta se guarda junto a las del banco. Cambia sola con cada sello y avisa en pantalla bloqueada cuando hay recompensa lista.',
        },
        {
          name: 'Tu página pública',
          body: 'Un enlace con tu tarjeta, tu menú, tus redes y tu dirección. Sirve como la bio de tus redes sociales.',
        },
        {
          name: 'Registro corto',
          body: 'Nombre y correo. Las demás preguntas se hacen después, cuando la persona ya está dentro del club.',
        },
      ],
    },
    {
      title: 'Cuando quieres mover la aguja',
      body: 'Herramientas para llenar un día flojo o recuperar a quien dejó de venir.',
      photoSeed: 'volvia-shop-evening',
      items: [
        {
          name: 'Campañas',
          body: 'Sellos dobles un martes, hora feliz, o un sello de regalo para quien no vuelve hace meses. La promoción aparece en la tarjeta y se retira sola al terminar.',
        },
        {
          name: 'Cumpleaños automáticos',
          body: 'Se configura una vez. Cada cliente recibe su detalle el día que le toca, en la hora de tu negocio.',
        },
        {
          name: 'Encuestas y reseñas',
          body: 'Preguntas justo después de una recompensa. A quien te califica bien le propones dejar la reseña en Google; el resto te llega en privado.',
        },
      ],
    },
  ],
  en: [
    {
      title: 'At the counter',
      body: 'What your team uses every day, on the phone already in their pocket.',
      photoSeed: 'volvia-counter-service',
      items: [
        {
          name: 'A scanner for your team',
          body: 'Scan the customer card and the stamp lands in a second. It works without signal: stamps queue up and send themselves when the connection returns.',
        },
        {
          name: 'Kiosk mode',
          body: 'A screen shows a code that changes every 30 seconds. Customers stamp themselves and your team keeps doing what they were doing.',
        },
        {
          name: 'Anti-abuse rules',
          body: 'A minimum wait between stamps, a daily cap, and a record of who added each one. You can let go of control without losing it.',
        },
      ],
    },
    {
      title: 'On the customer phone',
      body: 'The card looks right and updates itself, with nothing to install.',
      photoSeed: 'volvia-customer-phone',
      items: [
        {
          name: 'Apple and Google Wallet',
          body: 'The card saves next to their bank cards. It changes with every stamp and speaks up on the lock screen when a reward is ready.',
        },
        {
          name: 'Your public page',
          body: 'One link with your card, your menu, your socials and your address. It works as the link in your social bio.',
        },
        {
          name: 'A short signup',
          body: 'Name and email. Everything else is asked later, once the person is already in the club.',
        },
      ],
    },
    {
      title: 'When you want to move the needle',
      body: 'Tools to fill a slow day or win back someone who stopped visiting.',
      photoSeed: 'volvia-shop-evening',
      items: [
        {
          name: 'Campaigns',
          body: 'Double stamps on a Tuesday, a happy hour, or a free stamp for people who have not returned in months. The offer appears on the card and retires itself.',
        },
        {
          name: 'Birthday automation',
          body: 'Set once. Every customer gets their moment on the right day, in your shop timezone.',
        },
        {
          name: 'Surveys and reviews',
          body: 'Ask right after a reward. Happy customers get a nudge toward your Google listing; the rest reaches you privately.',
        },
      ],
    },
  ],
} as const

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const copy = copyFor(locale)
  const isSpanish = locale === 'es'

  return (
    <>
      <Section>
        <SectionTitle
          as="h1"
          title={
            isSpanish
              ? 'Todo lo que hace falta, nada que sobre'
              : 'Everything it takes, nothing spare'
          }
          body={
            isSpanish
              ? 'Volvia hace una cosa: que tus clientes vuelvan. Cada función existe porque un negocio la pidió, no porque quedaba bien en una lista.'
              : 'Volvia does one thing: bring your customers back. Every feature exists because a business asked for it, not because it looked good on a list.'
          }
        />
      </Section>

      {GROUPS[locale].map((group, index) => (
        <Section key={group.title} tone={index % 2 === 0 ? 'muted' : 'plain'}>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className={index % 2 === 0 ? '' : 'lg:order-2'}>
              <SectionTitle title={group.title} body={group.body} />
              <Image
                src={`https://picsum.photos/seed/${group.photoSeed}/720/540`}
                alt={group.title}
                width={720}
                height={540}
                className="mt-6 w-full rounded-[14px] object-cover"
                sizes="(max-width: 1024px) 100vw, 420px"
              />
            </div>

            <ul className={`flex flex-col gap-7 ${index % 2 === 0 ? '' : 'lg:order-1'}`}>
              {group.items.map((item) => (
                <li key={item.name} className="border-l-2 border-[var(--color-primary)] pl-5">
                  <h3 className="text-[18px] font-semibold leading-tight">{item.name}</h3>
                  <p className="mt-2 max-w-[58ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section>
        <SectionTitle
          title={isSpanish ? 'Una página por función' : 'A page for each feature'}
          body={
            isSpanish
              ? 'Cada una explica el problema que resuelve antes de contar lo que hace, y dónde no sirve.'
              : 'Each one explains the problem it solves before describing itself — and where it does not help.'
          }
        />
        <ul className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.slug}>
              <Link
                href={`/${locale}/funciones/${feature.slug}`}
                className="block h-full rounded-[12px] border border-[var(--color-line)] p-5 transition-colors hover:border-[var(--color-primary)]/45"
              >
                <h3 className="text-[16px] font-semibold">{feature[locale].name}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
                  {feature[locale].lede}
                </p>
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
