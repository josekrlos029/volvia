import { ContactForm } from '@/components/ContactForm'
import { Section, SectionTitle } from '@/components/Section'
import { LOCALES, isLocale } from '@/lib/i18n'
import { CONTACT_TOPICS } from '@volvia/shared'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
    title: isSpanish ? 'Contacto' : 'Contact',
    description: isSpanish
      ? 'Escríbenos y te contesta una persona que conoce el producto, normalmente el mismo día.'
      : 'Write to us and a person who knows the product answers, usually the same day.',
    alternates: {
      canonical: `/${locale}/contacto`,
      languages: { es: '/es/contacto', en: '/en/contacto' },
    },
  }
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tema?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const { tema } = await searchParams
  const topic = CONTACT_TOPICS.includes(tema as never)
    ? (tema as (typeof CONTACT_TOPICS)[number])
    : 'question'
  const isSpanish = locale === 'es'

  return (
    <>
      <section className="border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="max-w-[20ch] text-[clamp(30px,4.2vw,44px)] leading-[1.06] tracking-[-0.03em]">
            {isSpanish ? 'Hablamos' : 'Let’s talk'}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-[var(--color-ink-muted)]">
            {isSpanish
              ? 'Te contesta alguien que conoce el producto, no un formulario que abre un ticket. Si lo tuyo es una duda de «¿me sirve esto?», dinos qué negocio tienes y te decimos que no cuando la respuesta sea no.'
              : 'Someone who knows the product answers, not a form that opens a ticket. If your question is “is this for me?”, tell us what kind of shop you run and we will say no when the answer is no.'}
          </p>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <ContactForm locale={locale} defaultTopic={topic} />

          <aside className="flex flex-col gap-7">
            <div>
              <h2 className="text-[16px]">
                {isSpanish ? 'Antes de escribir' : 'Before you write'}
              </h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {isSpanish
                  ? 'Puede que ya esté contestado en las '
                  : 'It may already be answered in the '}
                <Link
                  href={`/${locale}/preguntas`}
                  className="text-[var(--color-primary)] underline underline-offset-4"
                >
                  {isSpanish ? 'preguntas frecuentes' : 'frequently asked questions'}
                </Link>
                {isSpanish
                  ? ', donde también decimos lo que todavía no hacemos.'
                  : ', where we also say what we do not do yet.'}
              </p>
            </div>

            <div>
              <h2 className="text-[16px]">
                {isSpanish ? 'Si ya eres cliente' : 'If you are already a customer'}
              </h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {isSpanish
                  ? 'Escríbenos desde el mismo correo con el que entras a tu panel. Así encontramos tu negocio sin pedirte diez datos.'
                  : 'Write from the same email you sign in with. That way we find your business without asking you for ten details.'}
              </p>
            </div>

            <div>
              <h2 className="text-[16px]">{isSpanish ? 'Cuánto tardamos' : 'How long we take'}</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
                {isSpanish
                  ? 'Normalmente el mismo día laborable. Si escribes un domingo por la noche, el lunes.'
                  : 'Usually the same working day. If you write on a Sunday night, Monday.'}
              </p>
            </div>
          </aside>
        </div>
      </Section>

      <Section tone="muted">
        <SectionTitle
          title={isSpanish ? '¿Prefieres verlo funcionando?' : 'Would you rather see it running?'}
          body={
            isSpanish
              ? 'Puedes crear tu cuenta y probarlo con datos reales sin pagar nada, o pedirnos que te lo enseñemos en una llamada corta.'
              : 'You can create an account and try it on real data without paying anything, or ask us to walk you through it on a short call.'
          }
        />
        <Link href={`/${locale}/contacto?tema=demo`} className="btn-ghost mt-6">
          {isSpanish ? 'Pedir una demostración' : 'Ask for a demo'}
        </Link>
      </Section>
    </>
  )
}
