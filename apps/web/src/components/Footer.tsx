import type { Locale, SiteCopy } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import Image from 'next/image'
import Link from 'next/link'

/** The pages people arrive on from a search, kept one click from everywhere. */
const RESOURCES = [
  { path: '/guia', es: 'Guía de 30 días', en: '30-day guide' },
  { path: '/plantillas', es: 'Plantillas', en: 'Templates' },
  { path: '/referencias', es: 'Números típicos', en: 'Benchmarks' },
  { path: '/glosario', es: 'Glosario', en: 'Glossary' },
  { path: '/comparativas', es: 'Comparativas', en: 'Comparisons' },
  { path: '/generador-qr-resenas', es: 'Generador de QR', en: 'QR generator' },
  { path: '/preguntas', es: 'Preguntas', en: 'FAQ' },
] as const

export function Footer({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const base = `/${locale}`
  const other: Locale = locale === 'es' ? 'en' : 'es'

  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-5 lg:py-20 lg:px-8">
        <div>
          <Image src="/brand/logo-full.png" alt="Volvia" width={124} height={44} />
          <p className="mt-4 max-w-[28ch] text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
            {locale === 'es'
              ? 'Tarjetas de fidelización digitales para negocios locales.'
              : 'Digital loyalty cards for local businesses.'}
          </p>
        </div>

        <nav aria-label={copy.footer.product}>
          <h2 className="t-caption text-[var(--color-ink-muted)]">{copy.footer.product}</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-[var(--color-ink)]">
            <li>
              <Link href={`${base}/funciones`} className="hover:text-[var(--color-primary)]">
                {copy.nav.features}
              </Link>
            </li>
            <li>
              <Link href={`${base}/precios`} className="hover:text-[var(--color-primary)]">
                {copy.nav.pricing}
              </Link>
            </li>
            <li>
              <Link href={`${base}/calculadora`} className="hover:text-[var(--color-primary)]">
                {locale === 'es' ? 'Calculadora' : 'Calculator'}
              </Link>
            </li>
            <li>
              <Link href={`${base}/blog`} className="hover:text-[var(--color-primary)]">
                {copy.nav.blog}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={copy.nav.industries}>
          <h2 className="t-caption text-[var(--color-ink-muted)]">{copy.nav.industries}</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-[var(--color-ink)]">
            {industries.slice(0, 5).map((industry) => (
              <li key={industry.slug}>
                <Link
                  href={`${base}/sectores/${industry.slug}`}
                  className="hover:text-[var(--color-primary)]"
                >
                  {industry[locale].plural}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={locale === 'es' ? 'Recursos' : 'Resources'}>
          <h2 className="t-caption text-[var(--color-ink-muted)]">
            {locale === 'es' ? 'Recursos' : 'Resources'}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-[var(--color-ink)]">
            {RESOURCES.map((resource) => (
              <li key={resource.path}>
                <Link
                  href={`${base}${resource.path}`}
                  className="hover:text-[var(--color-primary)]"
                >
                  {resource[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={copy.footer.legal}>
          <h2 className="t-caption text-[var(--color-ink-muted)]">{copy.footer.legal}</h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-[var(--color-ink)]">
            <li>
              <Link href={`${base}/contacto`} className="hover:text-[var(--color-primary)]">
                {locale === 'es' ? 'Contacto' : 'Contact'}
              </Link>
            </li>
            <li>
              <Link href={`${base}/privacidad`} className="hover:text-[var(--color-primary)]">
                {locale === 'es' ? 'Privacidad' : 'Privacy'}
              </Link>
            </li>
            <li>
              <Link href={`${base}/terminos`} className="hover:text-[var(--color-primary)]">
                {locale === 'es' ? 'Términos' : 'Terms'}
              </Link>
            </li>
            <li>
              <Link href={`/${other}`} className="hover:text-[var(--color-primary)]">
                {other === 'en' ? 'English' : 'Español'}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <p className="mx-auto max-w-[1200px] px-5 py-5 text-[13px] text-[var(--color-ink-muted)] lg:px-8">
          © {new Date().getFullYear()} Volvia. {copy.footer.rights}
        </p>
      </div>
    </footer>
  )
}
