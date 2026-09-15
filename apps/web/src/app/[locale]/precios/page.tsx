import { PricingTable } from '@/components/PricingTable'
import { Section, SectionTitle } from '@/components/Section'
import { copyFor, isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const isSpanish = locale === 'es'
  return {
    title: isSpanish ? 'Precios' : 'Pricing',
    description: isSpanish
      ? 'Plan gratis para siempre y planes de pago desde el momento en que te sirve. Sin tarjeta de crédito para empezar.'
      : 'A free plan forever, and paid plans from the moment they pay for themselves. No credit card to start.',
    alternates: {
      canonical: `/${locale}/precios`,
      languages: { es: '/es/precios', en: '/en/precios' },
    },
  }
}

const FAQ = {
  es: [
    {
      q: '¿El plan gratis tiene fecha de vencimiento?',
      a: 'No. Puedes quedarte en el plan gratis todo el tiempo que quieras, con clientes y sellos sin límite. Lo que cambia entre planes son las funciones, no cuánto puedes crecer.',
    },
    {
      q: '¿Qué pasa si bajo de plan?',
      a: 'Tus clientes conservan sus tarjetas y sus sellos. Pierdes acceso a las funciones del plan superior, pero nada de lo que ya construiste se borra.',
    },
    {
      q: '¿Mi cliente tiene que instalar algo?',
      a: 'No. Escanea el QR, deja su nombre y su correo, y la tarjeta queda en su teléfono. En los planes de pago además se guarda en Apple Wallet o Google Wallet.',
    },
    {
      q: '¿Cómo se paga en Colombia?',
      a: 'Con PSE, Nequi, Bancolombia o tarjeta, a través de Wompi. Fuera de Colombia el cobro se hace con tarjeta a través de Stripe.',
    },
  ],
  en: [
    {
      q: 'Does the free plan expire?',
      a: 'No. You can stay on it as long as you like, with unlimited customers and stamps. What changes between plans is the features, not how much you can grow.',
    },
    {
      q: 'What happens if I downgrade?',
      a: 'Your customers keep their cards and their stamps. You lose the higher plan features, but nothing you already built is deleted.',
    },
    {
      q: 'Does my customer have to install anything?',
      a: 'No. They scan the QR, leave a name and an email, and the card lands on their phone. Paid plans also save it into Apple Wallet or Google Wallet.',
    },
    {
      q: 'How does payment work?',
      a: 'Card payments through Stripe. In Colombia we also take PSE, Nequi and Bancolombia through Wompi.',
    },
  ],
} as const

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const copy = copyFor(locale)

  return (
    <>
      <Section>
        <SectionTitle align="center" title={copy.pricing.title} body={copy.pricing.subtitle} />
        <div className="mt-10">
          <PricingTable locale={locale} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionTitle title={copy.faq.title} />
        <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {FAQ[locale].map((item) => (
            <div key={item.q}>
              <h3 className="text-[17px] font-semibold leading-tight">{item.q}</h3>
              <p className="mt-2 max-w-[54ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
