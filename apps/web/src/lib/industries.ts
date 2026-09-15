import type { Locale } from './i18n'

/**
 * Industry pages.
 *
 * Each one exists to rank for a real search a shop owner makes ("tarjeta de sellos para
 * barbería"), so the copy is specific to that trade rather than the same paragraph with
 * a noun swapped. The stamp count and reward are what that business would actually run.
 */
export interface Industry {
  slug: string
  photoSeed: string
  es: {
    name: string
    plural: string
    headline: string
    intro: string
    reward: string
    stamps: number
    insight: string
  }
  en: {
    name: string
    plural: string
    headline: string
    intro: string
    reward: string
    stamps: number
    insight: string
  }
}

export const industries: Industry[] = [
  {
    slug: 'cafeterias',
    photoSeed: 'volvia-cafe-counter',
    es: {
      name: 'Cafetería',
      plural: 'Cafeterías',
      headline: 'Tarjeta de sellos para cafeterías',
      intro:
        'El café es el negocio de la repetición: la misma persona, a la misma hora, casi todos los días. Una tarjeta digital convierte esa costumbre en algo que puedes ver y premiar.',
      reward: 'El décimo café va por la casa',
      stamps: 10,
      insight:
        'La mayoría de cafeterías cierra la tarjeta en 10 sellos. Con visitas casi diarias, el cliente la completa en dos semanas y arranca otra sin perder el ritmo.',
    },
    en: {
      name: 'Coffee shop',
      plural: 'Coffee shops',
      headline: 'Stamp cards for coffee shops',
      intro:
        'Coffee is a repeat business: the same person, the same hour, most days. A digital card turns that habit into something you can see and reward.',
      reward: 'The tenth coffee is on the house',
      stamps: 10,
      insight:
        'Most coffee shops close the card at 10 stamps. With near-daily visits a customer fills it in a fortnight and starts the next one without losing momentum.',
    },
  },
  {
    slug: 'restaurantes',
    photoSeed: 'volvia-restaurant-table',
    es: {
      name: 'Restaurante',
      plural: 'Restaurantes',
      headline: 'Tarjeta de fidelización para restaurantes',
      intro:
        'En un restaurante la gente vuelve cada quince días, no cada mañana. La tarjeta tiene que ser corta para que el cliente sienta que avanza entre una visita y la siguiente.',
      reward: 'Un plato principal gratis',
      stamps: 8,
      insight:
        'Con visitas quincenales, ocho sellos son cuatro meses. Poner una recompensa intermedia al cuarto sello sostiene el interés en la mitad del camino.',
    },
    en: {
      name: 'Restaurant',
      plural: 'Restaurants',
      headline: 'Loyalty cards for restaurants',
      intro:
        'People come back to a restaurant every couple of weeks, not every morning. The card has to be short so the customer feels progress between one visit and the next.',
      reward: 'A free main course',
      stamps: 8,
      insight:
        'At fortnightly visits, eight stamps is four months. A smaller reward at stamp four keeps interest alive halfway through.',
    },
  },
  {
    slug: 'barberias',
    photoSeed: 'volvia-barber-chair',
    es: {
      name: 'Barbería',
      plural: 'Barberías',
      headline: 'Tarjeta de sellos para barberías',
      intro:
        'Un corte cada tres o cuatro semanas es un calendario casi fijo. La tarjeta te dice quién se salió de ese ritmo antes de que se vaya a otra silla.',
      reward: 'El sexto corte gratis',
      stamps: 6,
      insight:
        'Seis cortes son medio año de relación. Cuando alguien pasa de las cinco semanas sin volver, aparece en el segmento de riesgo y todavía estás a tiempo.',
    },
    en: {
      name: 'Barbershop',
      plural: 'Barbershops',
      headline: 'Stamp cards for barbershops',
      intro:
        'A cut every three or four weeks is an almost fixed calendar. The card tells you who fell out of that rhythm before they end up in another shop.',
      reward: 'The sixth cut is free',
      stamps: 6,
      insight:
        'Six cuts is half a year of relationship. When someone passes five weeks without returning they land in the at-risk segment while there is still time.',
    },
  },
  {
    slug: 'salones-de-belleza',
    photoSeed: 'volvia-salon-mirror',
    es: {
      name: 'Salón de belleza',
      plural: 'Salones de belleza',
      headline: 'Fidelización para salones de belleza',
      intro:
        'El ticket es alto y la visita es planeada. Aquí la tarjeta no compite por impulso: recuerda que existe una cita pendiente y le pone una recompensa al final.',
      reward: 'Tratamiento de regalo',
      stamps: 6,
      insight:
        'Guardar el cumpleaños de tus clientas convierte una fecha cualquiera en una cita agendada. Es la automatización que más se usa en este sector.',
    },
    en: {
      name: 'Beauty salon',
      plural: 'Beauty salons',
      headline: 'Loyalty for beauty salons',
      intro:
        'The ticket is high and the visit is planned. The card is not competing for impulse here: it reminds people a booking is due and puts a reward at the end of it.',
      reward: 'A treatment on the house',
      stamps: 6,
      insight:
        'Keeping birthdays turns an ordinary date into a booked appointment. It is the automation this trade uses most.',
    },
  },
  {
    slug: 'gimnasios',
    photoSeed: 'volvia-gym-weights',
    es: {
      name: 'Gimnasio',
      plural: 'Gimnasios',
      headline: 'Tarjeta de asistencia para gimnasios',
      intro:
        'Aquí el problema no es que no vuelvan: es que dejan de venir en la tercera semana. Un sello por asistencia hace visible la racha y le da algo que perder.',
      reward: 'Un mes con descuento',
      stamps: 12,
      insight:
        'Doce asistencias es el umbral donde el hábito se sostiene solo. Las tarjetas de gimnasio funcionan mejor cortas y repetibles que largas y lejanas.',
    },
    en: {
      name: 'Gym',
      plural: 'Gyms',
      headline: 'Attendance cards for gyms',
      intro:
        'The problem is not that they never return: it is that they stop in week three. A stamp per session makes the streak visible and gives them something to lose.',
      reward: 'A discounted month',
      stamps: 12,
      insight:
        'Twelve sessions is the threshold where a habit holds on its own. Gym cards work better short and repeatable than long and distant.',
    },
  },
  {
    slug: 'panaderias',
    photoSeed: 'volvia-bakery-bread',
    es: {
      name: 'Panadería',
      plural: 'Panaderías',
      headline: 'Tarjeta de sellos para panaderías',
      intro:
        'La panadería vive del cliente de la cuadra que pasa todos los días. La tarjeta le da una razón para pasar por la tuya y no por la de la esquina siguiente.',
      reward: 'Docena de pan gratis',
      stamps: 10,
      insight:
        'Con compras diarias y ticket bajo, el tope de sellos por día evita que alguien complete la tarjeta en una sola compra grande.',
    },
    en: {
      name: 'Bakery',
      plural: 'Bakeries',
      headline: 'Stamp cards for bakeries',
      intro:
        'A bakery lives on the neighbour who walks past every day. The card gives them a reason to walk past yours instead of the one on the next corner.',
      reward: 'A free dozen',
      stamps: 10,
      insight:
        'With daily purchases and a low ticket, the per-day stamp cap stops someone filling the card in a single large order.',
    },
  },
  {
    slug: 'heladerias',
    photoSeed: 'volvia-ice-cream-cones',
    es: {
      name: 'Heladería',
      plural: 'Heladerías',
      headline: 'Tarjeta de sellos para heladerías',
      intro:
        'Es un negocio de temporada y de familias. La tarjeta funciona mejor cuando la recompensa se puede compartir, porque casi nunca vienen solos.',
      reward: 'Helado doble gratis',
      stamps: 8,
      insight:
        'Las campañas de día flojo rinden especialmente aquí: mover gente de sábado a martes cambia toda la semana.',
    },
    en: {
      name: 'Ice cream shop',
      plural: 'Ice cream shops',
      headline: 'Stamp cards for ice cream shops',
      intro:
        'This is a seasonal business, and a family one. The card works best when the reward can be shared, because people almost never arrive alone.',
      reward: 'A free double scoop',
      stamps: 8,
      insight:
        'Slow-day campaigns pay off especially here: moving people from Saturday to Tuesday changes the whole week.',
    },
  },
  {
    slug: 'lavaderos-de-autos',
    photoSeed: 'volvia-car-wash',
    es: {
      name: 'Lavadero de autos',
      plural: 'Lavaderos de autos',
      headline: 'Tarjeta de fidelización para lavaderos',
      intro:
        'Lavar el carro es una decisión de conveniencia: se va a donde queda cerca. La tarjeta inclina esa decisión hacia ti cuando hay dos opciones igual de cerca.',
      reward: 'Un lavado gratis',
      stamps: 7,
      insight:
        'Siete lavados son unos siete meses. Aquí conviene una recompensa intermedia rápida para que la tarjeta no se sienta interminable.',
    },
    en: {
      name: 'Car wash',
      plural: 'Car washes',
      headline: 'Loyalty cards for car washes',
      intro:
        'Washing the car is a convenience decision: people go where it is close. The card tips that decision toward you when two options are equally close.',
      reward: 'One free wash',
      stamps: 7,
      insight:
        'Seven washes is roughly seven months. A quick intermediate reward keeps the card from feeling endless.',
    },
  },
]

export function industryCopy(industry: Industry, locale: Locale) {
  return industry[locale]
}
