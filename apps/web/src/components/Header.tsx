'use client'

import type { Locale, SiteCopy } from '@/lib/i18n'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Site header.
 *
 * Kept to a single row at every width: a marketing nav that wraps to two lines reads as
 * a layout bug, so secondary items collapse into the mobile sheet rather than reflowing.
 */
export function Header({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // The header only lifts off the page once there is content sliding under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
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
    <header
      className={`sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-surface)] transition-shadow duration-300 ${scrolled ? 'shadow-[var(--shadow-nav)]' : ''}`}
    >
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-6 px-5 lg:px-8">
        <Link href={base} className="shrink-0" aria-label="Volvia">
          <Image src="/brand/logo.png" alt="Volvia" width={98} height={28} priority />
        </Link>

        <nav className="hidden items-center gap-[14px] lg:flex" aria-label="Principal">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`border-b-2 px-2 py-1 text-[15px] transition-colors ${
                  active
                    ? 'border-[var(--color-primary)] text-[var(--color-ink)]'
                    : 'border-transparent text-[var(--color-ink)] hover:border-[var(--color-primary)]'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a href={`${appUrl}/login`} className="btn-ghost btn-sm">
            {copy.nav.login}
          </a>
          <a href={`${appUrl}/signup`} className="btn-primary btn-sm">
            {copy.nav.cta}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="site-nav"
          className="btn-ghost btn-sm lg:hidden"
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
          <ul className="flex flex-col">
            {[...links, ...more].map((link) => (
              <li key={link.href} className="border-b border-[var(--color-line)] last:border-b-0">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[18px] tracking-[-0.01em]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={`${appUrl}/login`} className="btn-ghost">
              {copy.nav.login}
            </a>
            <a href={`${appUrl}/signup`} className="btn-primary">
              {copy.nav.cta}
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  )
}
