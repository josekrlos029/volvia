import type { SegmentDefinition } from './schemas/segment'
import type { SuggestedSegmentKey } from './segments'

/**
 * The segments Volvia proposes to every business, with a message ready for each.
 *
 * They are not stored: a suggested segment is a definition the panel evaluates live,
 * and it becomes a row only when the business saves a copy to edit. Keeping them in
 * code means a better rule tomorrow reaches everyone without a migration.
 */
export interface MessageTemplate {
  headline: string
  body: string
}

export interface SuggestedSegment {
  key: SuggestedSegmentKey
  name: string
  description: string
  definition: SegmentDefinition
  messageTemplates: readonly MessageTemplate[]
}

export const SUGGESTED_SEGMENTS: Record<SuggestedSegmentKey, SuggestedSegment> = {
  cold: {
    key: 'cold',
    name: 'Fríos',
    description: 'Llevan más de lo normal sin venir, o ya casi no vienen.',
    definition: { base: 'cold', filters: {} },
    messageTemplates: [
      {
        headline: 'Te extrañamos, {{name}}',
        body: 'Hace rato no te vemos por {{business}}. Pásate esta semana: tu tarjeta sigue viva y te faltan {{remaining}} sellos.',
      },
      {
        headline: 'Volvé cuando quieras',
        body: 'Tu tarjeta de {{business}} te espera con {{stamps}} sellos. Esta semana, el siguiente va por nuestra cuenta.',
      },
    ],
  },
  recurring: {
    key: 'recurring',
    name: 'Recurrentes',
    description: 'Vuelven con ritmo: habituales y quienes repiten.',
    definition: { base: 'recurring', filters: {} },
    messageTemplates: [
      {
        headline: 'Gracias por volver',
        body: 'Llevas {{stamps}} sellos en {{business}}. Te faltan {{remaining}} para tu recompensa.',
      },
    ],
  },
  vip: {
    key: 'vip',
    name: 'VIP',
    description: 'Ya canjearon dos o más recompensas.',
    definition: { base: 'all', filters: { minRewards: 2 } },
    messageTemplates: [
      {
        headline: 'Gracias por ser de los nuestros',
        body: 'Eres de los que sostienen {{business}}, {{name}}. La próxima vez que vengas, pregunta por tu detalle.',
      },
    ],
  },
  one_stamp_away: {
    key: 'one_stamp_away',
    name: 'A un sello de la recompensa',
    description: 'Les falta un solo sello en alguna de sus tarjetas.',
    definition: { base: 'all', filters: { stampsToRewardMax: 1 } },
    messageTemplates: [
      {
        headline: 'Te falta uno',
        body: 'Un sello más y tu recompensa en {{business}} es tuya, {{name}}.',
      },
    ],
  },
  never_redeemed: {
    key: 'never_redeemed',
    name: 'Nunca canjearon',
    description: 'Tienen sellos pero jamás reclamaron una recompensa.',
    definition: { base: 'all', filters: { minStamps: 1, hasRedeemed: false } },
    messageTemplates: [
      {
        headline: 'Tu recompensa te espera',
        body: 'Ya llevas {{stamps}} sellos en {{business}}. Completa tu tarjeta y reclama lo tuyo.',
      },
    ],
  },
  birthday_this_month: {
    key: 'birthday_this_month',
    name: 'Cumplen este mes',
    description: 'Su cumpleaños cae en el mes en curso.',
    definition: { base: 'birthday_month', filters: {} },
    messageTemplates: [
      {
        headline: '¡Feliz cumpleaños, {{name}}!',
        body: 'En {{business}} queremos celebrarte. Pasa este mes y pregunta por tu regalo de cumpleaños.',
      },
    ],
  },
  new_no_second_visit: {
    key: 'new_no_second_visit',
    name: 'Nuevos sin segunda visita',
    description: 'Se unieron hace poco y todavía no han vuelto.',
    definition: { base: 'new', filters: { maxStamps: 1 } },
    messageTemplates: [
      {
        headline: 'Bienvenido a {{business}}',
        body: 'Tu tarjeta ya está lista, {{name}}. Con tu próxima visita vas por el segundo sello.',
      },
    ],
  },
  dormant_with_reward: {
    key: 'dormant_with_reward',
    name: 'Dormidos con recompensa pendiente',
    description: 'Tienen una recompensa sin reclamar y hace tiempo no vienen.',
    definition: { base: 'cold', filters: { hasPendingReward: true } },
    messageTemplates: [
      {
        headline: 'Tienes algo sin reclamar',
        body: 'Tu recompensa en {{business}} sigue esperándote, {{name}}. Ven a buscarla cuando quieras.',
      },
    ],
  },
}

export const SUGGESTED_SEGMENT_LIST: readonly SuggestedSegment[] = Object.values(SUGGESTED_SEGMENTS)

/** Starting points that fit any audience. */
export const GENERIC_MESSAGE_TEMPLATES: readonly MessageTemplate[] = [
  {
    headline: 'Novedad en {{business}}',
    body: 'Tenemos algo nuevo que te va a gustar. Ven a probarlo y suma un sello.',
  },
  {
    headline: 'Solo esta semana',
    body: 'Hasta el domingo, cada visita a {{business}} cuenta doble. Te faltan {{remaining}} sellos.',
  },
  {
    headline: 'Hoy es buen día para venir',
    body: 'Te esperamos en {{business}}, {{name}}. Muestra tu tarjeta y suma tu sello.',
  },
]
