import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LOCALES, copyFor, isLocale } from '@/lib/i18n'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import '../globals.css'

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
    title: {
      default: isSpanish
        ? 'Volvia · Tarjetas de fidelización digitales'
        : 'Volvia · Digital loyalty cards',
      template: '%s · Volvia',
    },
    description: isSpanish
      ? 'Tarjeta de sellos digital para tu negocio. Sin app para el cliente, sin cartones que se pierden.'
      : 'A digital stamp card for your shop. No app for your customers, no paper cards to lose.',
    // hreflang tells search engines these are the same page in two languages.
    alternates: {
      canonical: `/${locale}`,
      languages: { es: '/es', en: '/en', 'x-default': '/es' },
    },
    openGraph: {
      type: 'website',
      locale: isSpanish ? 'es_CO' : 'en_US',
      siteName: 'Volvia',
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const copy = copyFor(locale)

  /*
   * This is the root layout. Nesting it under [locale] is what lets `<html lang>` carry
   * the real language: a screen reader announcing Spanish copy in an English voice is a
   * genuine accessibility failure, not a formality.
   */
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-[100dvh] flex-col">
        <Header locale={locale} copy={copy} />
        <div className="flex-1">{children}</div>
        <Footer locale={locale} copy={copy} />
      </body>
    </html>
  )
}
