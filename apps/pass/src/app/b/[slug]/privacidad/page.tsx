import { Shell, VolviaMark } from '@/components/Shell'
import { api } from '@/lib/api'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface BusinessPage {
  business: {
    name: string
    slug: string
    legal: { name: string; taxId: string; address: string; email: string }
  }
}

async function load(slug: string): Promise<BusinessPage | null> {
  try {
    return await api.get<BusinessPage>(`/p/business/${slug}`)
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await load((await params).slug)
  return {
    title: page ? `Privacidad · ${page.business.name}` : 'Privacidad',
    robots: { index: false },
  }
}

/**
 * The privacy notice for one business.
 *
 * The customer handed their details to this shop, not to Volvia, so the notice is
 * written in the shop's name and says plainly what was collected, why, and how to get
 * rid of it. Volvia appears as what it is: the service the shop uses to keep the data.
 */
export default async function BusinessPrivacyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = await load(slug)
  if (!page) notFound()

  const { name, legal } = page.business

  return (
    <Shell>
      <article className="flex flex-col gap-5 text-[15px] leading-relaxed">
        <header>
          <Link
            href={`/b/${slug}`}
            className="text-[13px] text-[var(--color-ink-muted)] underline underline-offset-2"
          >
            Volver a {name}
          </Link>
          <h1 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.01em]">
            Cómo tratamos tus datos
          </h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Este aviso es de {legal.name}, el negocio al que diste tus datos.
          </p>
        </header>

        <section>
          <h2 className="text-[16px] font-semibold">Quién responde por tus datos</h2>
          <p className="mt-1.5 text-[var(--color-ink-muted)]">
            {legal.name}
            {legal.taxId ? `, ${legal.taxId}` : ''}
            {legal.address ? `, ${legal.address}` : ''}.
            {legal.email ? ` Puedes escribirnos a ${legal.email}.` : ''}
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold">Qué guardamos</h2>
          <p className="mt-1.5 text-[var(--color-ink-muted)]">
            Tu nombre y tu correo, para saber de quién es la tarjeta y avisarte cuando ganes algo.
            Si nos lo diste, el día y el mes de tu cumpleaños, nunca el año. Y las visitas en las
            que sumaste sellos.
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold">Para qué</h2>
          <p className="mt-1.5 text-[var(--color-ink-muted)]">
            Para llevar la cuenta de tus sellos y entregarte tus recompensas. Solo te enviamos
            promociones si lo aceptaste al unirte, y puedes dejar de recibirlas cuando quieras.
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold">Con quién</h2>
          <p className="mt-1.5 text-[var(--color-ink-muted)]">
            Con nadie más. Usamos Volvia como herramienta para guardar y gestionar esta tarjeta; no
            vendemos ni cedemos tus datos.
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold">Cómo los borras</h2>
          <p className="mt-1.5 text-[var(--color-ink-muted)]">
            Escríbenos{legal.email ? ` a ${legal.email}` : ''} y borramos tus datos y tu tarjeta. No
            hace falta que des explicaciones.
          </p>
        </section>
      </article>

      <VolviaMark />
    </Shell>
  )
}
