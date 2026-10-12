/**
 * What changed in the dashboard, newest first. Static on purpose: a release note is
 * written by a person, not generated, and the list is short enough to ship with the app.
 */
export interface ChangelogEntry {
  id: string
  /** ISO date of the release. The newest one drives the unread dot. */
  date: string
  title: string
  body: string
  href?: string
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: 'plan-widget',
    date: '2026-10-11T12:00:00',
    title: 'Tu plan, a la vista',
    body: 'El menú muestra cuántos clientes llevas de los 30 de prueba y qué se cierra al llegar. Con un plan pagado, cuántas campañas te quedan este mes.',
    href: '/settings/billing',
  },
  {
    id: 'campaign-pass-takeover',
    date: '2026-10-11T12:00:00',
    title: 'Las campañas ahora cambian la tarjeta',
    body: 'Un banner detrás de los sellos, un encabezado propio, sellos ocultos si quieres, y la opción de que todo vuelva a la normalidad con la primera visita. Los sellos de regalo y los multiplicadores por fin se aplican de verdad.',
    href: '/campaigns',
  },
  {
    id: 'birthday-validity',
    date: '2026-10-11T12:00:00',
    title: 'Cumpleaños con fecha de caducidad',
    body: 'El detalle de cumpleaños dura una, dos o cuatro semanas, se ve en la tarjeta con su propio banner y el correo sale entre las 8 y las 10 de la mañana, no a medianoche.',
    href: '/automations',
  },
  {
    id: 'image-upload',
    date: '2026-10-11T12:00:00',
    title: 'Sube tus fotos desde el editor',
    body: 'Ya no hace falta pegar un enlace: el banner de la tarjeta y el de las campañas se suben desde tu computador.',
    href: '/cards',
  },
]

/** The release the unread dot compares against. */
export const LATEST_CHANGELOG_DATE = CHANGELOG.reduce(
  (latest, entry) => (entry.date > latest ? entry.date : latest),
  '',
)
