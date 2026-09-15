'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavProps {
  orgName: string
  plan: string
  userName: string
  /** Sections the plan does not include are shown but marked, never hidden. */
  locked: Record<string, boolean>
}

const SECTIONS = [
  { href: '/', label: 'Resumen' },
  { href: '/cards', label: 'Tarjetas' },
  { href: '/customers', label: 'Clientes' },
  { href: '/campaigns', label: 'Campañas', feature: 'campaigns' },
  { href: '/surveys', label: 'Encuestas', feature: 'surveys' },
  { href: '/automations', label: 'Automatizaciones', feature: 'birthday_automation' },
  { href: '/team', label: 'Equipo', feature: 'team_accounts' },
  { href: '/settings', label: 'Ajustes' },
] as const

export function Nav({ orgName, plan, userName, locked }: NavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <>
      {/* Mobile bar: the dashboard is used on a phone behind the counter as often as on a laptop. */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{orgName}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="main-nav"
          className="rounded-[9px] border border-[var(--color-line)] px-3 py-1.5 text-[14px] font-medium"
        >
          {open ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <nav
        id="main-nav"
        className={[
          'border-r border-[var(--color-line)] bg-white lg:block lg:w-60 lg:shrink-0',
          open ? 'block' : 'hidden',
        ].join(' ')}
        aria-label="Secciones"
      >
        <div className="hidden px-4 py-5 lg:block">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
            Volvia
          </p>
          <p className="mt-3 truncate text-[15px] font-semibold">{orgName}</p>
          <p className="mt-0.5 text-[13px] capitalize text-[var(--color-ink-muted)]">Plan {plan}</p>
        </div>

        <ul className="flex flex-col gap-0.5 p-2">
          {SECTIONS.map((section) => {
            const isLocked = 'feature' in section && locked[section.feature as string]
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(section.href) ? 'page' : undefined}
                  className={[
                    'flex items-center justify-between rounded-[8px] px-3 py-2 text-[14px]',
                    isActive(section.href)
                      ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]',
                  ].join(' ')}
                >
                  {section.label}
                  {isLocked ? (
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                      Plan
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 border-t border-[var(--color-line)] p-2">
          <Link
            href="/scan"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-[8px] bg-[var(--color-ink)] px-3 py-2.5 text-[14px] font-medium text-white"
          >
            Escanear
          </Link>
          <p className="mt-3 px-3 text-[13px] text-[var(--color-ink-muted)]">{userName}</p>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="mt-1 w-full rounded-[8px] px-3 py-2 text-left text-[14px] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"
            >
              Salir
            </button>
          </form>
        </div>
      </nav>
    </>
  )
}
