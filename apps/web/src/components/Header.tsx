'use client'

import type { Locale, SiteCopy } from '@/lib/i18n'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Site header.
 *
 * Kept to a single row at every width: a marketing nav that wraps to two lines reads as
 * a layout bug, so secondary items collapse into the mobile sheet rather than reflowing.
 */
export function Header({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const [open, setOpen] = useState(false)
  const base = `/${locale}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  const links = [
    { href: `${base}/funciones`, label: copy.nav.features },
    { href: `${base}/precios`, label: copy.nav.pricing },
    { href: `${base}/sectores`, label: copy.nav.industries },
    { href: `${base}/guia`, label: copy.nav.resources },
  ]

  /**
   * The long tail. It lives in the mobile sheet and the footer rather than in the top
   * row, because a marketing nav with nine items reads as a sitemap.
   */
  const more = [
    { href: `${base}/plantillas`, label: locale === 'es' ? 'Plantillas' : 'Templates' },
    { href: `${base}/referencias`, label: locale === 'es' ? 'Números típicos' : 'Benchmarks' },
    { href: `${base}/comparativas`, label: locale === 'es' ? 'Comparativas' : 'Comparisons' },
    { href: `${base}/preguntas`, label: locale === 'es' ? 'Preguntas' : 'FAQ' },
    { href: `${base}/blog`, label: copy.nav.blog },
    { href: `${base}/contacto`, label: locale === 'es' ? 'Contacto' : 'Contact' },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-surface)]/92 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-6 px-5 lg:px-8">
        <Link href={base} className="text-[17px] font-semibold tracking-[-0.02em]">
          Volvia
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14px] text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={`${appUrl}/login`}
            className="text-[14px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            {copy.nav.login}
          </a>
          <a
            href={`${appUrl}/signup`}
            className="rounded-[9px] bg-[var(--color-ink)] px-4 py-2 text-[14px] font-medium text-white transition-transform duration-150 active:scale-[0.985]"
          >
            {copy.nav.cta}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="site-nav"
          className="rounded-[9px] border border-[var(--color-line)] px-3 py-1.5 text-[14px] font-medium lg:hidden"
        >
          {open ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      {open ? (
        <nav
          id="site-nav"
          className="border-t border-[var(--color-line)] px-5 py-4 lg:hidden"
          aria-label="Principal"
        >
          <ul className="flex flex-col gap-1">
            {[...links, ...more].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-[8px] px-2 py-2.5 text-[15px]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <a
            href={`${appUrl}/signup`}
            className="mt-3 block rounded-[9px] bg-[var(--color-ink)] px-4 py-3 text-center text-[15px] font-medium text-white"
          >
            {copy.nav.cta}
          </a>
        </nav>
      ) : null}
    </header>
  )
}
