import { LegalPage, LegalSection } from '@/components/LegalPage'
import { isLocale } from '@/lib/i18n'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'es' ? 'Términos' : 'Terms',
    alternates: { canonical: `/${locale}/terminos` },
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const isSpanish = locale === 'es'

  if (!isSpanish) {
    return (
      <LegalPage title="Terms of service" updated="Last updated: 2 September 2026">
        <LegalSection title="The service">
          <p>
            Volvia provides software for running a loyalty programme. The rewards themselves are
            offered and honoured by each business, not by Volvia.
          </p>
        </LegalSection>
        <LegalSection title="Your account">
          <p>
            You are responsible for who you give access to and for what your team does with it. Keep
            your credentials to yourself and remove people who leave.
          </p>
        </LegalSection>
        <LegalSection title="Plans and payment">
          <p>
            The free plan has no time limit. Paid plans renew automatically until cancelled, and
            cancelling keeps your plan running until the end of the period you already paid for.
          </p>
          <p>
            Dropping to the free plan never deletes your cards, customers or their stamps. You lose
            the paid features, not your work.
          </p>
        </LegalSection>
        <LegalSection title="Acceptable use">
          <p>
            Do not use Volvia to send messages people did not agree to receive, or to run a
            programme you do not intend to honour.
          </p>
        </LegalSection>
      </LegalPage>
    )
  }

  return (
    <LegalPage
      title="Términos del servicio"
      updated="Última actualización: 2 de septiembre de 2026"
    >
      <LegalSection title="Qué es el servicio">
        <p>
          Volvia entrega el software para operar un programa de fidelización. Las recompensas las
          ofrece y las cumple cada negocio, no Volvia.
        </p>
      </LegalSection>
      <LegalSection title="Tu cuenta">
        <p>
          Eres responsable de a quién le das acceso y de lo que tu equipo hace con él. Guarda tus
          credenciales y retira a quien deje de trabajar contigo.
        </p>
      </LegalSection>
      <LegalSection title="Planes y pagos">
        <p>
          El plan gratis no tiene fecha de vencimiento. Los planes de pago se renuevan solos hasta
          que los canceles, y al cancelar conservas el plan hasta el final del periodo que ya
          pagaste.
        </p>
        <p>
          Bajar al plan gratis nunca borra tus tarjetas, tus clientes ni sus sellos. Pierdes las
          funciones de pago, no tu trabajo.
        </p>
      </LegalSection>
      <LegalSection title="Uso aceptable">
        <p>
          No uses Volvia para enviar mensajes que la gente no aceptó recibir, ni para operar un
          programa que no piensas cumplir.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
