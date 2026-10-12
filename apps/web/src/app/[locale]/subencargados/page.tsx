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
    title: locale === 'es' ? 'Subencargados' : 'Sub-processors',
    alternates: { canonical: `/${locale}/subencargados` },
    robots: { index: true, follow: true },
  }
}

/** The providers Volvia relies on. Kept in step with the real stack, not with a template. */
const PROVIDERS = [
  {
    name: 'Google Cloud',
    es: 'Servidores y base de datos de la API',
    en: 'API hosting and database',
    where: 'Estados Unidos · United States',
  },
  {
    name: 'Neon',
    es: 'Base de datos Postgres',
    en: 'Postgres database',
    where: 'Estados Unidos · United States',
  },
  {
    name: 'Cloudflare R2',
    es: 'Almacenamiento de logos, portadas y fotos',
    en: 'Storage for logos, covers and photos',
    where: 'Global',
  },
  {
    name: 'Resend',
    es: 'Envío de correos transaccionales',
    en: 'Transactional email',
    where: 'Estados Unidos · United States',
  },
  {
    name: 'Apple (Wallet y APNs)',
    es: 'Tarjetas en Apple Wallet y sus notificaciones',
    en: 'Apple Wallet passes and their notifications',
    where: 'Global',
  },
  {
    name: 'Google (Wallet API)',
    es: 'Tarjetas en Google Wallet',
    en: 'Google Wallet passes',
    where: 'Global',
  },
  {
    name: 'Stripe',
    es: 'Cobro de planes fuera de Colombia',
    en: 'Plan payments outside Colombia',
    where: 'Estados Unidos · United States',
  },
  {
    name: 'Wompi',
    es: 'Cobro de planes en Colombia',
    en: 'Plan payments in Colombia',
    where: 'Colombia',
  },
]

export default async function SubprocessorsPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const en = locale === 'en'

  return (
    <LegalPage
      title={en ? 'Sub-processors' : 'Subencargados'}
      updated={en ? 'Last updated: 11 October 2026' : 'Última actualización: 11 de octubre de 2026'}
    >
      <LegalSection
        title={en ? 'Who handles data for Volvia' : 'Quién trata datos por cuenta de Volvia'}
      >
        <p>
          {en
            ? 'To run the service Volvia relies on these providers. Each one only receives what its job needs, under a contract that binds it to the same duties Volvia has towards you.'
            : 'Para prestar el servicio, Volvia se apoya en estos proveedores. Cada uno recibe solo lo que su función necesita, bajo un contrato que le obliga a lo mismo que Volvia se obliga contigo.'}
        </p>
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-[13px] uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
              <th className="py-2 pr-4 font-medium">{en ? 'Provider' : 'Proveedor'}</th>
              <th className="py-2 pr-4 font-medium">{en ? 'Purpose' : 'Para qué'}</th>
              <th className="py-2 font-medium">{en ? 'Location' : 'Dónde'}</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDERS.map((provider) => (
              <tr key={provider.name} className="border-b border-[var(--color-line)] align-top">
                <td className="py-2.5 pr-4 font-medium">{provider.name}</td>
                <td className="py-2.5 pr-4">{en ? provider.en : provider.es}</td>
                <td className="py-2.5">
                  {provider.where.split(' · ')[en ? 1 : 0] ?? provider.where}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </LegalSection>
      <LegalSection title={en ? 'Changes' : 'Cambios'}>
        <p>
          {en
            ? 'When a provider is added or replaced this page is updated first, and businesses with an account are told by email at least fifteen days in advance.'
            : 'Cuando se añade o sustituye un proveedor, primero se actualiza esta página y se avisa por correo a los negocios con cuenta con al menos quince días de antelación.'}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
