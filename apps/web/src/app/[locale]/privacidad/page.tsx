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
    title: locale === 'es' ? 'Privacidad' : 'Privacy',
    alternates: { canonical: `/${locale}/privacidad` },
    robots: { index: true, follow: true },
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const isSpanish = locale === 'es'

  if (!isSpanish) {
    return (
      <LegalPage title="Privacy" updated="Last updated: 2 September 2026">
        <LegalSection title="What we collect">
          <p>
            For a business account: the name and email of whoever signs up, the business details
            they enter, and a record of actions taken in the dashboard.
          </p>
          <p>
            For a customer joining a card: first name, email, an optional birthday without the year,
            whether they agreed to receive offers, and any extra question the business chose to ask.
            We never ask for payment details or location.
          </p>
        </LegalSection>
        <LegalSection title="Who the data belongs to">
          <p>
            Customer data belongs to the business that collected it. Volvia processes it on their
            behalf and does not sell it, share it between businesses, or use it to advertise.
          </p>
        </LegalSection>
        <LegalSection title="Deleting your data">
          <p>
            A customer can ask the business to delete their record at any time. When they do, the
            personal details are removed and only the anonymous visit counts remain, so the business
            keeps accurate historical figures without holding anything that identifies a person.
          </p>
        </LegalSection>
        <LegalSection title="Contact">
          <p>Write to hola@volvia.co with any question about this policy.</p>
        </LegalSection>
      </LegalPage>
    )
  }

  return (
    <LegalPage title="Privacidad" updated="Última actualización: 2 de septiembre de 2026">
      <LegalSection title="Qué recogemos">
        <p>
          De una cuenta de negocio: el nombre y correo de quien se registra, los datos del negocio
          que ingresa, y un registro de las acciones hechas en el panel.
        </p>
        <p>
          De un cliente que se une a una tarjeta: nombre, correo, cumpleaños opcional sin año, si
          aceptó recibir promociones, y las preguntas adicionales que el negocio haya decidido
          hacer. Nunca pedimos datos de pago ni ubicación.
        </p>
      </LegalSection>
      <LegalSection title="De quién son los datos">
        <p>
          Los datos de los clientes son del negocio que los recogió. Volvia los procesa por cuenta
          de ese negocio, y no los vende, no los comparte entre negocios ni los usa para publicidad.
        </p>
      </LegalSection>
      <LegalSection title="Cómo se eliminan">
        <p>
          Un cliente puede pedirle al negocio que borre su registro en cualquier momento. Al hacerlo
          se eliminan los datos personales y solo quedan los conteos anónimos de visitas, de modo
          que el negocio conserva sus cifras históricas sin guardar nada que identifique a una
          persona.
        </p>
      </LegalSection>
      <LegalSection title="Contacto">
        <p>Escribe a hola@volvia.co con cualquier duda sobre esta política.</p>
      </LegalSection>
    </LegalPage>
  )
}
