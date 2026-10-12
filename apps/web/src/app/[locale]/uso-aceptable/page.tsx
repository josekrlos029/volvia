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
    title: locale === 'es' ? 'Política de uso aceptable' : 'Acceptable use policy',
    alternates: { canonical: `/${locale}/uso-aceptable` },
    robots: { index: true, follow: true },
  }
}

export default async function AcceptableUsePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  if (locale === 'en') {
    return (
      <LegalPage title="Acceptable use policy" updated="Last updated: 11 October 2026">
        <LegalSection title="What Volvia is for">
          <p>
            Running a loyalty programme for a real business with customers who chose to join. Use it
            for that and you will never need to read the rest of this page.
          </p>
        </LegalSection>
        <LegalSection title="Not allowed">
          <p>
            Adding people to a card without their knowledge; sending offers to customers who did not
            opt in, or after they opted out; buying, importing or scraping contact lists; programmes
            that are misleading about what a customer earns; content on your page that is unlawful,
            hateful or infringes someone else's rights; and anything that interferes with the
            service, other businesses' data or the wallet platforms.
          </p>
        </LegalSection>
        <LegalSection title="Your staff and your devices">
          <p>
            Each person who stamps cards must have their own login. Remove people who leave. Do not
            share kiosk or scanner access outside your team.
          </p>
        </LegalSection>
        <LegalSection title="What happens otherwise">
          <p>
            Volvia may pause messaging, a page, or an account that breaks this policy, and will tell
            you why. Serious or repeated breaches end the service without refund.
          </p>
        </LegalSection>
      </LegalPage>
    )
  }

  return (
    <LegalPage
      title="Política de uso aceptable"
      updated="Última actualización: 11 de octubre de 2026"
    >
      <LegalSection title="Para qué es Volvia">
        <p>
          Para llevar el programa de fidelización de un negocio real, con clientes que decidieron
          unirse. Si lo usas para eso, no necesitas leer el resto de esta página.
        </p>
      </LegalSection>
      <LegalSection title="Lo que no está permitido">
        <p>
          Dar de alta a personas sin que lo sepan; enviar promociones a clientes que no las
          aceptaron o que se dieron de baja; comprar, importar o extraer listas de contactos;
          programas que engañan sobre lo que gana el cliente; contenido en tu página que sea ilegal,
          de odio o que infrinja derechos de terceros; y cualquier cosa que interfiera con el
          servicio, con los datos de otros negocios o con las plataformas de wallet.
        </p>
      </LegalSection>
      <LegalSection title="Tu equipo y tus dispositivos">
        <p>
          Cada persona que selle tarjetas debe tener su propio acceso. Quita a quien se vaya. No
          compartas el acceso al kiosko o al escáner fuera de tu equipo.
        </p>
      </LegalSection>
      <LegalSection title="Qué pasa si no se cumple">
        <p>
          Volvia puede pausar los mensajes, la página o la cuenta que incumpla esta política, y te
          dirá por qué. Los incumplimientos graves o repetidos terminan el servicio sin reembolso.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
