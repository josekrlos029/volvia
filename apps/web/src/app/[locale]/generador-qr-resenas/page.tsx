import { ReviewQrGenerator } from '@/components/ReviewQrGenerator'
import { Section, SectionTitle } from '@/components/Section'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
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
    title: isSpanish ? 'Generador de QR para reseñas de Google' : 'Google review QR code generator',
    description: isSpanish
      ? 'Crea gratis el código QR que lleva a tus clientes directo a escribir tu reseña en Google. Sin cuenta y sin que tus datos salgan de tu navegador.'
      : 'Create the QR code that takes your customers straight to writing your Google review. Free, no account, and nothing leaves your browser.',
    alternates: {
      canonical: `/${locale}/generador-qr-resenas`,
      languages: { es: '/es/generador-qr-resenas', en: '/en/generador-qr-resenas' },
    },
  }
}

export default async function ReviewQrPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const site = copyFor(locale)
  const isSpanish = locale === 'es'

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[22ch] text-[clamp(30px,4.2vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em]">
            {isSpanish ? 'Generador de QR para reseñas' : 'Review QR code generator'}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Pega el enlace de tu ficha de Google y llévate el QR listo para imprimir. Gratis, sin cuenta, y todo ocurre en tu navegador: el enlace de tu negocio no llega a nuestros servidores.'
              : 'Paste your Google listing link and take the printable QR code away. Free, no account, and it all happens in your browser: your listing never reaches our servers.'}
          </p>
        </div>
      </section>

      <Section>
        <ReviewQrGenerator locale={locale} />
      </Section>

      <Section tone="muted">
        <SectionTitle
          title={isSpanish ? 'Un QR en la pared no basta' : 'A QR on the wall is not enough'}
          body={
            isSpanish
              ? 'Un cartel pidiendo reseñas lo ve todo el mundo, incluido quien tuvo un mal día. Por eso casi siempre rinde poco: la gente contenta no se para a escanear, y la molesta sí.'
              : 'A sign asking for reviews is seen by everyone, including whoever had a bad day. That is why it usually underperforms: happy people do not stop to scan, and annoyed ones do.'
          }
        />
        <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-muted)]">
          {isSpanish
            ? 'Lo que mejor funciona es pedirla a alguien que acaba de decirte que le fue bien. En Volvia eso pasa dentro de la tarjeta del cliente: una pregunta corta, y solo quien puntúa alto ve el enlace de Google. A quien puntúa bajo le escuchas tú, en privado.'
            : 'What works is asking someone who has just told you it went well. In Volvia that happens inside the customer’s card: one short question, and only a high score sees the Google link. A low score comes to you, in private.'}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/funciones/encuestas-y-resenas`}
            className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 text-[15px] font-semibold"
          >
            {isSpanish ? 'Cómo lo hace Volvia' : 'How Volvia does it'}
          </Link>
          <a
            href={`${appUrl}/signup`}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-3 text-[15px] font-semibold text-white"
          >
            {site.hero.cta}
          </a>
        </div>
      </Section>
    </>
  )
}
