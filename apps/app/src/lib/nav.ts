import { type Role, roleAtLeast } from '@volvia/shared'

export interface NavSection {
  href: string
  label: string
  /** Plan feature that unlocks the section; locked sections are shown but marked. */
  feature?: string
  /** Lowest role that gets to see the section. Defaults to staff (everyone). */
  minRole?: Role
}

/**
 * Every section of the dashboard, in menu order.
 *
 * The API already refuses the admin-only endpoints to staff, so hiding the entries is
 * about not handing a counter person doors that will not open.
 */
export const SECTIONS: readonly NavSection[] = [
  { href: '/', label: 'Resumen' },
  { href: '/cards', label: 'Tarjetas' },
  { href: '/page', label: 'Tu página', minRole: 'admin' },
  { href: '/customers', label: 'Clientes' },
  { href: '/segments', label: 'Segmentos' },
  { href: '/campaigns', label: 'Campañas', feature: 'campaigns', minRole: 'admin' },
  { href: '/messages', label: 'Mensajes', feature: 'customer_messages', minRole: 'admin' },
  { href: '/surveys', label: 'Encuestas', feature: 'surveys', minRole: 'admin' },
  { href: '/reviews', label: 'Reseñas', feature: 'google_review_requests', minRole: 'admin' },
  {
    href: '/automations',
    label: 'Automatizaciones',
    feature: 'birthday_automation',
    minRole: 'admin',
  },
  { href: '/team', label: 'Equipo', feature: 'team_accounts', minRole: 'admin' },
  { href: '/settings', label: 'Ajustes', minRole: 'admin' },
]

/** The sections a person with `role` should see in the menu. */
export function visibleSections(role: Role): NavSection[] {
  return SECTIONS.filter((section) => roleAtLeast(role, section.minRole ?? 'staff'))
}
