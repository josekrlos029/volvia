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
    title: locale === 'es' ? 'Acuerdo de tratamiento de datos' : 'Data processing agreement',
    alternates: { canonical: `/${locale}/dpa` },
    robots: { index: true, follow: true },
  }
}

/**
 * The agreement under which Volvia processes a business's customer data on its behalf.
 * Accepted together with the terms, so it needs no signature of its own.
 */
export default async function DpaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  if (locale === 'en') {
    return (
      <LegalPage title="Data processing agreement" updated="Last updated: 11 October 2026">
        <LegalSection title="Roles">
          <p>
            The business is the controller of its customers' personal data: it decides to run a
            loyalty programme and what to ask people who join. Volvia is the processor: it stores
            and handles that data only to provide the service, on the business's instructions.
          </p>
        </LegalSection>
        <LegalSection title="What is processed">
          <p>
            First name, email, an optional phone number and birthday without the year, marketing
            consent, the answers to any extra question the business asks, stamps, rewards and the
            messages sent to the customer. Nothing else is collected from customers.
          </p>
        </LegalSection>
        <LegalSection title="Volvia's duties">
          <p>
            Process the data only for the programme and as instructed; keep it confidential and
            protected with appropriate technical and organisational measures; engage only the
            sub-processors listed on the sub-processors page and tell businesses of changes; help
            the business answer customers who exercise their rights; notify the business without
            undue delay of a personal data breach; and delete or return the data when the service
            ends, as set out below.
          </p>
        </LegalSection>
        <LegalSection title="The business's duties">
          <p>
            Have a lawful basis for the programme and for any marketing it sends; publish the
            customer privacy notice Volvia hosts in its name; ask customers only what it needs; and
            handle requests from its customers.
          </p>
        </LegalSection>
        <LegalSection title="Where the data is kept">
          <p>
            Data is stored with the providers listed on the sub-processors page, in the United
            States and the European Union, under standard contractual clauses where required.
          </p>
        </LegalSection>
        <LegalSection title="Deletion">
          <p>
            A business can export its customers at any time. When a business closes its account the
            data is kept for seven days so the closure can be undone, then deleted for good,
            including copies in storage. Backups are rotated within thirty days.
          </p>
        </LegalSection>
        <LegalSection title="Acceptance">
          <p>
            This agreement is part of the terms of service and is accepted with them. Questions
            about it go to the contact page.
          </p>
        </LegalSection>
      </LegalPage>
    )
  }

  return (
    <LegalPage
      title="Acuerdo de tratamiento de datos"
      updated="Última actualización: 11 de octubre de 2026"
    >
      <LegalSection title="Roles">
        <p>
          El negocio es el responsable de los datos personales de sus clientes: decide tener un
          programa de fidelización y qué preguntar a quien se une. Volvia es el encargado: guarda y
          trata esos datos solo para prestar el servicio, siguiendo las instrucciones del negocio.
        </p>
      </LegalSection>
      <LegalSection title="Qué datos se tratan">
        <p>
          Nombre, correo, teléfono y cumpleaños sin año si el negocio los pide, el consentimiento
          para recibir promociones, las respuestas a las preguntas extra que haga el negocio, los
          sellos, las recompensas y los mensajes enviados al cliente. No se recoge nada más de los
          clientes.
        </p>
      </LegalSection>
      <LegalSection title="Obligaciones de Volvia">
        <p>
          Tratar los datos solo para el programa y según las instrucciones; mantenerlos
          confidenciales y protegidos con medidas técnicas y organizativas adecuadas; usar
          únicamente los subencargados publicados en la página de subencargados y avisar de los
          cambios; ayudar al negocio a atender a los clientes que ejerzan sus derechos; avisar sin
          demora indebida de cualquier brecha de seguridad; y borrar o devolver los datos al
          terminar el servicio, como se describe abajo.
        </p>
      </LegalSection>
      <LegalSection title="Obligaciones del negocio">
        <p>
          Tener base legal para el programa y para las promociones que envíe; publicar el aviso de
          privacidad para clientes que Volvia aloja a su nombre; pedir a los clientes solo lo que
          necesita; y atender las solicitudes de sus clientes.
        </p>
      </LegalSection>
      <LegalSection title="Dónde se guardan los datos">
        <p>
          En los proveedores publicados en la página de subencargados, en Estados Unidos y la Unión
          Europea, con cláusulas contractuales tipo donde haga falta.
        </p>
      </LegalSection>
      <LegalSection title="Borrado">
        <p>
          El negocio puede exportar a sus clientes cuando quiera. Al cerrar la cuenta, los datos se
          conservan siete días por si el cierre fue un error y después se borran de forma
          definitiva, incluidas las copias en almacenamiento. Las copias de seguridad se renuevan en
          un plazo de treinta días.
        </p>
      </LegalSection>
      <LegalSection title="Aceptación">
        <p>
          Este acuerdo forma parte de los términos del servicio y se acepta junto con ellos. Las
          dudas sobre él se atienden desde la página de contacto.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
