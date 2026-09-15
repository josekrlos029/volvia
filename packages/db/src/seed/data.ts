import type { StampPreset } from '@volvia/shared'

/**
 * Seed fixtures.
 *
 * Modelled on real Colombian small businesses rather than "Test Cafe 1", because a
 * dashboard full of plausible data is the only way to tell whether the dashboard is
 * any good — empty states and lorem ipsum hide every layout and copy problem.
 */

export interface SeedBusiness {
  name: string
  slug: string
  category: string
  tagline: string
  about: string
  city: string
  address: string
  brandColor: string
  cardBackground: string
  cardAccent: string
  plan: 'free' | 'pro' | 'business' | 'multi'
  card: {
    name: string
    stampsRequired: number
    stampIcon: StampPreset
    headline: string
    subheadline: string
    terms: string
    rewards: Array<{ atStamp: number; title: string; description: string }>
  }
  /** Roughly how many customers to generate, and how active they are. */
  scale: { customers: number; weeksOfHistory: number; visitsPerWeek: [number, number] }
}

export const businesses: SeedBusiness[] = [
  {
    name: 'Burger Train',
    slug: 'burger-train',
    category: 'restaurant',
    tagline: 'The Best Burger de Valledupar',
    about: 'Hamburguesas artesanales, papas rústicas y malteadas. Carrera 19 #16-56.',
    city: 'Valledupar',
    address: 'Cra. 19 #16-56',
    brandColor: '#E4572E',
    cardBackground: '#141414',
    cardAccent: '#E4572E',
    plan: 'business',
    card: {
      name: 'Club BT',
      stampsRequired: 8,
      stampIcon: 'burger',
      headline: 'Club Burger Train',
      subheadline: 'Suma sellos y gana recompensas',
      terms: 'Un sello por visita. No acumulable con otras promociones.',
      rewards: [
        { atStamp: 4, title: 'Papas rústicas gratis', description: 'Porción personal' },
        { atStamp: 8, title: 'Hamburguesa gratis', description: 'Cualquiera de la carta clásica' },
      ],
    },
    scale: { customers: 140, weeksOfHistory: 12, visitsPerWeek: [0, 3] },
  },
  {
    name: 'Café Raíces',
    slug: 'cafe-raices',
    category: 'cafe',
    tagline: 'Café de origen, tostado aquí',
    about: 'Tostión propia, métodos de filtrado y repostería del día.',
    city: 'Bogotá',
    address: 'Calle 70A #10-32',
    brandColor: '#6F4E37',
    cardBackground: '#2B1D14',
    cardAccent: '#D9A566',
    plan: 'pro',
    card: {
      name: 'Tarjeta Raíces',
      stampsRequired: 10,
      stampIcon: 'coffee',
      headline: 'Tu décimo café va por la casa',
      subheadline: 'Sella con cada bebida',
      terms: 'Válido en bebidas de la carta regular.',
      rewards: [{ atStamp: 10, title: 'Café gratis', description: 'Cualquier bebida de la carta' }],
    },
    scale: { customers: 220, weeksOfHistory: 16, visitsPerWeek: [0, 5] },
  },
  {
    name: 'Barbería Nueve',
    slug: 'barberia-nueve',
    category: 'barber',
    tagline: 'Corte clásico, atención de barrio',
    about: 'Cortes, barba y afeitado tradicional. Sin cita previa.',
    city: 'Medellín',
    address: 'Cra. 43A #9-15',
    brandColor: '#1F3A5F',
    cardBackground: '#0F1E30',
    cardAccent: '#C8A951',
    plan: 'free',
    card: {
      name: 'Club Nueve',
      stampsRequired: 6,
      stampIcon: 'scissors',
      headline: 'Sexto corte gratis',
      subheadline: 'Un sello por servicio',
      terms: 'No aplica para tintes ni tratamientos.',
      rewards: [{ atStamp: 6, title: 'Corte gratis', description: 'Corte clásico' }],
    },
    scale: { customers: 60, weeksOfHistory: 8, visitsPerWeek: [0, 1] },
  },
]

/** Names drawn from a realistic distribution so lists and searches look right. */
export const firstNames = [
  'María',
  'Juan',
  'Camila',
  'Andrés',
  'Valentina',
  'Santiago',
  'Laura',
  'Sebastián',
  'Isabella',
  'Mateo',
  'Sofía',
  'Nicolás',
  'Daniela',
  'Samuel',
  'Mariana',
  'Diego',
  'Gabriela',
  'Tomás',
  'Luciana',
  'Emiliano',
  'Paula',
  'Felipe',
  'Antonia',
  'Martín',
  'Salomé',
  'Julián',
  'Manuela',
  'Alejandro',
  'Catalina',
  'Esteban',
  'Juliana',
  'Ricardo',
]

export const lastNames = [
  'Gómez',
  'Rodríguez',
  'Martínez',
  'López',
  'García',
  'Pérez',
  'Sánchez',
  'Ramírez',
  'Torres',
  'Flórez',
  'Rivera',
  'Castro',
  'Ortiz',
  'Moreno',
  'Jiménez',
  'Vargas',
  'Restrepo',
  'Cardona',
  'Mejía',
  'Osorio',
  'Quintero',
  'Salazar',
  'Arias',
  'Muñoz',
]

/**
 * Profile questions per business type. A burger place asking how you take your coffee
 * is the kind of detail that makes a demo feel fake, so each category gets its own.
 *
 * Only the first question is asked at signup: a long form at the counter is the fastest
 * way to lose the customer you just convinced.
 */
export const profileQuestionsByCategory: Record<
  string,
  Array<{ prompt: string; type: string; options: string[]; askOn: string }>
> = {
  restaurant: [
    {
      prompt: '¿Cómo nos conociste?',
      type: 'single_choice',
      options: ['Un amigo', 'Instagram', 'Pasaba por ahí', 'Google'],
      askOn: 'signup',
    },
    {
      prompt: '¿Cuál es tu pedido de siempre?',
      type: 'text',
      options: [],
      askOn: 'after_first_reward',
    },
  ],
  cafe: [
    {
      prompt: '¿Cómo te gusta tu café?',
      type: 'single_choice',
      options: ['Solo', 'Con leche', 'Frío', 'Descafeinado'],
      askOn: 'signup',
    },
    {
      prompt: '¿Vienes a trabajar o a desconectar?',
      type: 'single_choice',
      options: ['A trabajar', 'A desconectar', 'Depende del día'],
      askOn: 'after_first_reward',
    },
  ],
  barber: [
    {
      prompt: '¿Cada cuánto te cortas el pelo?',
      type: 'single_choice',
      options: ['Cada semana', 'Cada 15 días', 'Cada mes', 'Cuando toca'],
      askOn: 'signup',
    },
    {
      prompt: '¿Con qué barbero prefieres?',
      type: 'text',
      options: [],
      askOn: 'after_first_reward',
    },
  ],
}

export const surveyQuestions = [
  { type: 'rating' as const, prompt: '¿Cómo estuvo tu visita?', scale: 5 as const },
  { type: 'text' as const, prompt: '¿Algo que podamos mejorar?', maxLength: 280 },
]
