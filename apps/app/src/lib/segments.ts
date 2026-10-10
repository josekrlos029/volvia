import type { CommunitySegment, SegmentFilters, VisitFrequency } from '@volvia/shared'

/**
 * How the five community buckets are named and explained to a business owner.
 *
 * Deliberately plain words. "Churn risk" means nothing behind a counter; "se están
 * alejando" does.
 */
export const COMMUNITY_LABELS: Record<
  CommunitySegment,
  { label: string; help: string; tone: string }
> = {
  regulars: {
    label: 'Habituales',
    help: 'Vienen seguido y ya son parte de la casa.',
    tone: 'bg-[#E4F1EA] text-[var(--color-success)]',
  },
  returning: {
    label: 'Vuelven',
    help: 'Han repetido, pero todavía no con ritmo fijo.',
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  },
  new: {
    label: 'Nuevos',
    help: 'Acaban de unirse. Lo que pase ahora decide si vuelven.',
    tone: 'bg-[var(--color-surface-muted)] text-[var(--color-ink)]',
  },
  missing: {
    label: 'Se alejan',
    help: 'Llevan más tiempo del normal sin aparecer.',
    tone: 'bg-[var(--color-accent-soft)] text-[var(--color-warning)]',
  },
  lost: {
    label: 'Perdidos',
    help: 'Hace mucho que no vienen. Recuperarlos cuesta, pero se puede.',
    tone: 'bg-[#FBEBEA] text-[var(--color-danger)]',
  },
}

export const FREQUENCY_LABELS: Record<VisitFrequency, string> = {
  weekly: 'cada semana',
  biweekly: 'cada dos semanas',
  monthly: 'cada mes',
  quarterly: 'cada tres meses',
}

export const EXTRA_SEGMENT_LABELS: Record<string, string> = {
  all: 'Todos',
  cold: 'Fríos',
  recurring: 'Recurrentes',
  birthday_month: 'Cumplen este mes',
  never_visited: 'Sin ninguna visita',
}

/** The buckets a saved segment can start from, in the order the editor offers them. */
export const BASE_SEGMENT_OPTIONS: ReadonlyArray<{ id: string; label: string; help: string }> = [
  { id: 'all', label: 'Todos', help: 'Cualquier cliente; los filtros hacen el resto.' },
  { id: 'recurring', label: 'Recurrentes', help: 'Habituales y quienes vuelven.' },
  { id: 'cold', label: 'Fríos', help: 'Se alejan o ya se perdieron.' },
  { id: 'regulars', label: 'Habituales', help: COMMUNITY_LABELS.regulars.help },
  { id: 'returning', label: 'Vuelven', help: COMMUNITY_LABELS.returning.help },
  { id: 'new', label: 'Nuevos', help: COMMUNITY_LABELS.new.help },
  { id: 'missing', label: 'Se alejan', help: COMMUNITY_LABELS.missing.help },
  { id: 'lost', label: 'Perdidos', help: COMMUNITY_LABELS.lost.help },
  {
    id: 'birthday_month',
    label: 'Cumplen este mes',
    help: 'Su cumpleaños cae en el mes en curso.',
  },
  {
    id: 'never_visited',
    label: 'Sin ninguna visita',
    help: 'Se unieron y nunca sumaron un sello.',
  },
]

/** How each filter of a saved segment reads in the editor. */
export const FILTER_LABELS: Record<keyof SegmentFilters, string> = {
  hasConsent: 'Acepta promociones',
  minStamps: 'Sellos, al menos',
  maxStamps: 'Sellos, como mucho',
  minRewards: 'Recompensas canjeadas, al menos',
  joinedAfter: 'Se unió desde',
  joinedBefore: 'Se unió hasta',
  lastVisitAfter: 'Última visita desde',
  lastVisitBefore: 'Última visita hasta',
  birthdayMonth: 'Cumpleaños en',
  hasBirthday: 'Dejó su cumpleaños',
  hasRedeemed: 'Ha canjeado alguna recompensa',
  lastVisitWithinDays: 'Visitó en los últimos N días',
  lastVisitOlderThanDays: 'Sin venir desde hace N días',
  joinedWithinDays: 'Se unió en los últimos N días',
  stampsToRewardMax: 'A N sellos o menos de la recompensa',
  hasPendingReward: 'Tiene una recompensa sin reclamar',
}

export const MESSAGE_STATUS = {
  draft: { label: 'Borrador', tone: 'neutral' },
  scheduled: { label: 'Programado', tone: 'warning' },
  sending: { label: 'Enviando', tone: 'brand' },
  sent: { label: 'Enviado', tone: 'success' },
  failed: { label: 'Falló', tone: 'danger' },
} as const

/** A short, honest explanation of each placeholder, shown where they are written. */
export const VARIABLE_HELP: Record<string, string> = {
  name: 'el nombre del cliente',
  business: 'el nombre de tu negocio',
  stamps: 'los sellos que lleva',
  remaining: 'los que le faltan',
  hour: 'la hora, donde está tu negocio',
}

export function segmentLabel(segment: string): string {
  return (
    COMMUNITY_LABELS[segment as CommunitySegment]?.label ?? EXTRA_SEGMENT_LABELS[segment] ?? segment
  )
}
