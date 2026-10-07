import type { Locale } from './i18n'

/**
 * Ready-made card setups, copied from what already works in each trade.
 *
 * The hardest part of starting is not the software, it is deciding how many stamps and
 * what to give away. Each template is a defensible answer with its reasoning attached,
 * so the business can disagree with it on purpose rather than guess.
 */
export interface CardTemplate {
  slug: string
  /** Industry slugs this setup belongs to, for the cross-links. */
  industries: string[]
  stamps: number
  initialStamps: number
  /** Expected visit frequency this setup assumes. */
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  es: { name: string; reward: string; intermediate: string | null; why: string }
  en: { name: string; reward: string; intermediate: string | null; why: string }
}

export const templates: CardTemplate[] = [
  {
    slug: 'cafe-diario',
    industries: ['cafeterias', 'jugos-y-batidos', 'panaderias'],
    stamps: 10,
    initialStamps: 1,
    frequency: 'weekly',
    es: {
      name: 'Café de todos los días',
      reward: 'El décimo café, gratis',
      intermediate: 'Al quinto sello, un acompañamiento',
      why: 'Con visitas casi diarias, diez sellos se completan en dos semanas. El sello de regalo al unirse hace que la tarjeta nunca se entregue vacía, y el premio del quinto sostiene el camino.',
    },
    en: {
      name: 'Everyday coffee',
      reward: 'The tenth coffee, free',
      intermediate: 'At stamp five, something on the side',
      why: 'With near-daily visits, ten stamps fill in a fortnight. The head-start stamp means the card is never handed over empty, and the reward at five holds the middle.',
    },
  },
  {
    slug: 'comida-quincenal',
    industries: ['restaurantes', 'pizzerias'],
    stamps: 8,
    initialStamps: 1,
    frequency: 'biweekly',
    es: {
      name: 'Mesa que vuelve',
      reward: 'Un plato principal gratis',
      intermediate: 'Al cuarto sello, el postre',
      why: 'A una visita cada quince días, ocho sellos son cuatro meses: largo. El postre al cuarto corta ese camino por la mitad y es lo que impide que la tarjeta se abandone.',
    },
    en: {
      name: 'The table that returns',
      reward: 'A free main course',
      intermediate: 'At stamp four, dessert',
      why: 'At one visit a fortnight, eight stamps is four months: long. The dessert at four cuts that road in half and is what stops the card being abandoned.',
    },
  },
  {
    slug: 'cita-mensual',
    industries: ['barberias', 'manicura', 'peluquerias-caninas', 'salones-de-belleza'],
    stamps: 6,
    initialStamps: 0,
    frequency: 'monthly',
    es: {
      name: 'Cita del mes',
      reward: 'El sexto servicio gratis',
      intermediate: null,
      why: 'Seis citas mensuales son medio año de relación, que es justo lo que se puede pedir en un oficio de cita. Sin premio intermedio: aquí el valor de cada visita ya es alto y partirlo lo abarata.',
    },
    en: {
      name: 'The monthly appointment',
      reward: 'The sixth service free',
      intermediate: null,
      why: 'Six monthly appointments is half a year of custom, which is about what you can ask for in an appointment trade. No intermediate reward: each visit is already valuable here, and splitting it cheapens it.',
    },
  },
  {
    slug: 'ticket-alto',
    industries: ['spa', 'tatuajes', 'floristerias'],
    stamps: 5,
    initialStamps: 1,
    frequency: 'quarterly',
    es: {
      name: 'Pocas visitas, ticket alto',
      reward: 'El quinto servicio gratis',
      intermediate: null,
      why: 'Cuando se viene cuatro veces al año, una tarjeta de diez sellos es ciencia ficción. Cinco con un sello de regalo deja la meta a cuatro visitas: un año, que ya es una promesa creíble.',
    },
    en: {
      name: 'Few visits, high ticket',
      reward: 'The fifth service free',
      intermediate: null,
      why: 'When people come four times a year, a ten-stamp card is science fiction. Five with a head start puts the goal four visits away: a year, which is a promise you can keep.',
    },
  },
  {
    slug: 'mucha-gente-poco-personal',
    industries: ['tiendas-de-barrio', 'bares', 'heladerias'],
    stamps: 8,
    initialStamps: 0,
    frequency: 'weekly',
    es: {
      name: 'Con cola en el mostrador',
      reward: 'El octavo, por la casa',
      intermediate: null,
      why: 'Pensada para el modo kiosko con tope de un sello al día. Ocho sellos y sin premio intermedio, porque cada interrupción cuesta: lo importante aquí es que sellar no frene la fila.',
    },
    en: {
      name: 'With a queue at the counter',
      reward: 'The eighth is on the house',
      intermediate: null,
      why: 'Built for kiosk mode with a cap of one stamp a day. Eight stamps and no intermediate reward, because every interruption costs: what matters here is that stamping does not slow the queue.',
    },
  },
  {
    slug: 'recuperar-la-costumbre',
    industries: ['gimnasios', 'lavaderos-de-autos'],
    stamps: 6,
    initialStamps: 2,
    frequency: 'weekly',
    es: {
      name: 'Volver a la costumbre',
      reward: 'Una semana o un servicio gratis',
      intermediate: 'Al tercer sello, un extra',
      why: 'Dos sellos de regalo y seis en total: la tarjeta nace a un tercio del camino. Es la configuración con más evidencia a favor cuando el problema del negocio no es atraer, sino sostener el hábito.',
    },
    en: {
      name: 'Back into the habit',
      reward: 'A free week or a free service',
      intermediate: 'At stamp three, an extra',
      why: 'Two head-start stamps and six in total: the card is born a third of the way along. It is the setup with the most evidence behind it when the problem is not attracting people but keeping the habit alive.',
    },
  },
]

export const FREQUENCY_LABELS = {
  es: {
    weekly: 'cada semana',
    biweekly: 'cada dos semanas',
    monthly: 'cada mes',
    quarterly: 'cada tres meses',
  },
  en: {
    weekly: 'weekly',
    biweekly: 'fortnightly',
    monthly: 'monthly',
    quarterly: 'quarterly',
  },
} as const

export function templatesFor(locale: Locale) {
  return templates.map((template) => ({
    slug: template.slug,
    stamps: template.stamps,
    initialStamps: template.initialStamps,
    frequency: template.frequency,
    industries: template.industries,
    ...template[locale],
  }))
}
