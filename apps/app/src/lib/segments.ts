import type { CommunitySegment, VisitFrequency } from '@volvia/shared'

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
  birthday_month: 'Cumplen este mes',
  never_visited: 'Sin ninguna visita',
}

export function segmentLabel(segment: string): string {
  return (
    COMMUNITY_LABELS[segment as CommunitySegment]?.label ?? EXTRA_SEGMENT_LABELS[segment] ?? segment
  )
}
