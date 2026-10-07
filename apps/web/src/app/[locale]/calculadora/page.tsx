import { RetentionCalculator } from '@/components/RetentionCalculator'
import { Section, SectionTitle } from '@/components/Section'
import { isLocale } from '@/lib/i18n'
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
    title: isSpanish ? 'Calculadora de fidelización' : 'Loyalty calculator',
    description: isSpanish
      ? 'Cuánto vale que cada cliente vuelva una vez más al mes, descontando lo que te cuestan las recompensas.'
      : 'What one more visit per customer per month is worth, after the cost of the rewards.',
    alternates: { canonical: `/${locale}/calculadora` },
  }
}

export default async function CalculatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const isSpanish = locale === 'es'

  return (
    <Section>
      <SectionTitle
        as="h1"
        title={isSpanish ? 'Cuánto vale una visita más' : 'What one more visit is worth'}
        body={
          isSpanish
            ? 'Mueve los números a los de tu negocio. La cuenta es simple a propósito: sirve para decidir si vale la pena, no para hacer un presupuesto.'
            : 'Move the numbers to match your shop. The maths is deliberately simple: it is for deciding whether this is worth it, not for building a budget.'
        }
      />
      <div className="mt-10">
        <RetentionCalculator locale={locale} />
      </div>
    </Section>
  )
}
