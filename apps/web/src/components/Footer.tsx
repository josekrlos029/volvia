import type { Locale, SiteCopy } from '@/lib/i18n'
import { industries } from '@/lib/industries'
import Link from 'next/link'

export function Footer({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const base = `/${locale}`
  const other: Locale = locale === 'es' ? 'en' : 'es'

  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface-muted)]">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="text-[17px] font-semibold tracking-[-0.02em]">Volvia</p>
          <p className="mt-2 max-w-[28ch] text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
            {locale === 'es'
              ? 'Tarjetas de fidelización digitales para negocios locales.'
              : 'Digital loyalty cards for local businesses.'}
          </p>
        </div>

        <nav aria-label={copy.footer.product}>
          <h2 className="text-[13px] font-semibold">{copy.footer.product}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] text-[var(--color-ink-muted)]">
            <li>
              <Link href={`${base}/funciones`} className="hover:text-[var(--color-ink)]">
                {copy.nav.features}
              </Link>
            </li>
            <li>
              <Link href={`${base}/precios`} className="hover:text-[var(--color-ink)]">
                {copy.nav.pricing}
              </Link>
            </li>
            <li>
              <Link href={`${base}/calculadora`} className="hover:text-[var(--color-ink)]">
                {locale === 'es' ? 'Calculadora' : 'Calculator'}
              </Link>
            </li>
            <li>
              <Link href={`${base}/blog`} className="hover:text-[var(--color-ink)]">
                {copy.nav.blog}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={copy.nav.industries}>
          <h2 className="text-[13px] font-semibold">{copy.nav.industries}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] text-[var(--color-ink-muted)]">
            {industries.slice(0, 5).map((industry) => (
              <li key={industry.slug}>
                <Link
                  href={`${base}/sectores/${industry.slug}`}
                  className="hover:text-[var(--color-ink)]"
                >
                  {industry[locale].plural}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={copy.footer.legal}>
          <h2 className="text-[13px] font-semibold">{copy.footer.legal}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] text-[var(--color-ink-muted)]">
            <li>
              <Link href={`${base}/privacidad`} className="hover:text-[var(--color-ink)]">
                {locale === 'es' ? 'Privacidad' : 'Privacy'}
              </Link>
            </li>
            <li>
              <Link href={`${base}/terminos`} className="hover:text-[var(--color-ink)]">
                {locale === 'es' ? 'Términos' : 'Terms'}
              </Link>
            </li>
            <li>
              <Link href={`/${other}`} className="hover:text-[var(--color-ink)]">
                {other === 'en' ? 'English' : 'Español'}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <p className="mx-auto max-w-[1180px] px-5 py-5 text-[13px] text-[var(--color-ink-muted)] lg:px-8">
          © {new Date().getFullYear()} Volvia. {copy.footer.rights}
        </p>
      </div>
    </footer>
  )
}
