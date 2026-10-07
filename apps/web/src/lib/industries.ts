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
  {
    slug: 'pizzerias',
    photoSeed: 'volvia-pizza-oven',
    es: {
      name: 'Pizzería',
      plural: 'Pizzerías',
      headline: 'Tarjeta de sellos para pizzerías',
      intro:
        'La pizza se pide los mismos días: viernes, sábado, el domingo de partido. Esa regularidad es justo lo que una tarjeta de sellos sabe aprovechar.',
      reward: 'La octava pizza, gratis',
      stamps: 8,
      insight:
        'Con un pedido semanal, ocho sellos son dos meses. Si vendes también a domicilio, pon el QR en la caja: el sello llega a casa con la pizza.',
    },
    en: {
      name: 'Pizzeria',
      plural: 'Pizzerias',
      headline: 'Stamp cards for pizzerias',
      intro:
        'Pizza gets ordered on the same days: Friday, Saturday, the Sunday match. That regularity is exactly what a stamp card is good at using.',
      reward: 'The eighth pizza, free',
      stamps: 8,
      insight:
        'At one order a week, eight stamps is two months. If you deliver, put the QR on the box: the stamp reaches the sofa with the pizza.',
    },
  },
  {
    slug: 'bares',
    photoSeed: 'volvia-bar-night',
    es: {
      name: 'Bar',
      plural: 'Bares',
      headline: 'Tarjeta de fidelización para bares',
      intro:
        'En un bar el cliente habitual no es el que más gasta una noche: es el que aparece tres jueves seguidos. La tarjeta hace visible a ese segundo.',
      reward: 'La sexta ronda la pone la casa',
      stamps: 6,
      insight:
        'Seis sellos con tope de uno por noche. Sin ese tope, una mesa de seis amigos vacía la tarjeta en una sola visita.',
    },
    en: {
      name: 'Bar',
      plural: 'Bars',
      headline: 'Loyalty cards for bars',
      intro:
        'In a bar the regular is not whoever spends most in one night: it is whoever turns up three Thursdays running. The card makes that second person visible.',
      reward: 'The sixth round is on the house',
      stamps: 6,
      insight:
        'Six stamps with a cap of one per night. Without that cap, a table of six friends empties the card in a single visit.',
    },
  },
  {
    slug: 'manicura',
    photoSeed: 'volvia-nail-studio',
    es: {
      name: 'Centro de manicura',
      plural: 'Centros de manicura',
      headline: 'Tarjeta de sellos para centros de manicura',
      intro:
        'Las uñas tienen calendario propio: cada tres o cuatro semanas, sin falta. Es uno de los oficios donde más fácil es ver cuándo alguien se fue a otro sitio.',
      reward: 'El sexto servicio gratis',
      stamps: 6,
      insight:
        'Seis citas son casi medio año. Si alguien pasa de las cinco semanas, aparece en «se alejan» y todavía hay tiempo de escribirle.',
    },
    en: {
      name: 'Nail salon',
      plural: 'Nail salons',
      headline: 'Stamp cards for nail salons',
      intro:
        'Nails run on their own calendar: every three or four weeks, without fail. It is one of the trades where you can see soonest that somebody went elsewhere.',
      reward: 'The sixth service free',
      stamps: 6,
      insight:
        'Six appointments is nearly half a year. Past five weeks away, someone shows up as drifting and there is still time to write.',
    },
  },
  {
    slug: 'jugos-y-batidos',
    photoSeed: 'volvia-juice-bar',
    es: {
      name: 'Juguería',
      plural: 'Juguerías',
      headline: 'Tarjeta de sellos para juguerías y batidos',
      intro:
        'Un jugo es una decisión de camino al trabajo o de salida del gimnasio. Se repite casi a diario y se decide en cinco segundos, que es donde la tarjeta inclina la balanza.',
      reward: 'El décimo jugo va por la casa',
      stamps: 10,
      insight:
        'Como la cafetería, diez sellos con visitas casi diarias. Si estás al lado de un gimnasio, la hora feliz funciona mejor a las siete de la mañana que a las seis de la tarde.',
    },
    en: {
      name: 'Juice bar',
      plural: 'Juice bars',
      headline: 'Stamp cards for juice and smoothie bars',
      intro:
        'A juice is a decision made on the way to work or on the way out of the gym. It repeats almost daily and is decided in five seconds, which is where the card tips the balance.',
      reward: 'The tenth juice is on the house',
      stamps: 10,
      insight:
        'Like a coffee shop: ten stamps with near-daily visits. Next to a gym, happy hour works better at seven in the morning than at six in the evening.',
    },
  },
  {
    slug: 'peluquerias-caninas',
    photoSeed: 'volvia-pet-grooming',
    es: {
      name: 'Peluquería canina',
      plural: 'Peluquerías caninas',
      headline: 'Tarjeta de fidelización para peluquerías caninas',
      intro:
        'El baño del perro se repite cada mes o mes y medio, y casi siempre con la misma persona. Lo que no se repite solo es el recordatorio.',
      reward: 'El sexto baño gratis',
      stamps: 6,
      insight:
        'Frecuencia mensual y seis sellos: medio año de relación. El cumpleaños aquí funciona especialmente bien si lo pides del perro y no del dueño.',
    },
    en: {
      name: 'Pet groomer',
      plural: 'Pet groomers',
      headline: 'Loyalty cards for pet groomers',
      intro:
        'The dog’s wash repeats every month or six weeks, almost always with the same person. The only thing that does not repeat by itself is the reminder.',
      reward: 'The sixth wash free',
      stamps: 6,
      insight:
        'Monthly frequency and six stamps: half a year of custom. Birthdays work unusually well here if you ask for the dog’s and not the owner’s.',
    },
  },
  {
    slug: 'spa',
    photoSeed: 'volvia-spa-room',
    es: {
      name: 'Spa',
      plural: 'Spas',
      headline: 'Tarjeta de fidelización para spas',
      intro:
        'Un masaje se piensa más que un café: el ticket es alto y la visita se espacia. La tarjeta tiene que ser corta y la recompensa, de verdad.',
      reward: 'El quinto tratamiento gratis',
      stamps: 5,
      insight:
        'Cinco sellos con visitas mensuales. Con tickets altos, un sello de regalo al unirse rinde más que un descuento: sube la sensación de avance sin tocar el precio.',
    },
    en: {
      name: 'Spa',
      plural: 'Spas',
      headline: 'Loyalty cards for spas',
      intro:
        'A massage is thought about more than a coffee: the ticket is high and visits are spaced out. The card has to be short and the reward has to be real.',
      reward: 'The fifth treatment free',
      stamps: 5,
      insight:
        'Five stamps at monthly visits. With a high ticket, a head-start stamp beats a discount: it raises the feeling of progress without touching the price.',
    },
  },
  {
    slug: 'tatuajes',
    photoSeed: 'volvia-tattoo-studio',
    es: {
      name: 'Estudio de tatuajes',
      plural: 'Estudios de tatuajes',
      headline: 'Tarjeta de fidelización para estudios de tatuajes',
      intro:
        'Aquí la repetición es lenta y el ticket es alto. La tarjeta no sirve para acelerar visitas: sirve para que, cuando llegue el siguiente tatuaje, sea contigo.',
      reward: 'Una sesión de retoque gratis',
      stamps: 4,
      insight:
        'Cuatro sellos y frecuencia trimestral. Lo que más rinde no es la recompensa final sino el recordatorio de cuidado a los quince días, que es cuando se decide la siguiente cita.',
    },
    en: {
      name: 'Tattoo studio',
      plural: 'Tattoo studios',
      headline: 'Loyalty cards for tattoo studios',
      intro:
        'Here repetition is slow and the ticket is high. The card is not there to speed visits up: it is there so the next tattoo happens with you.',
      reward: 'A free touch-up session',
      stamps: 4,
      insight:
        'Four stamps at a quarterly frequency. What pays off is not the final reward but the aftercare note two weeks later, which is when the next appointment is decided.',
    },
  },
  {
    slug: 'floristerias',
    photoSeed: 'volvia-flower-shop',
    es: {
      name: 'Floristería',
      plural: 'Floristerías',
      headline: 'Tarjeta de sellos para floristerías',
      intro:
        'Las flores se compran por fechas: un cumpleaños, un aniversario, un entierro. El negocio no está en que vengan más seguido, sino en que se acuerden de ti cuando toca.',
      reward: 'Un ramo pequeño gratis',
      stamps: 5,
      insight:
        'Cinco sellos y frecuencia trimestral. Pedir el cumpleaños al unirse rinde doble: felicitas y, de paso, apareces justo antes de la fecha en que alguien compra flores.',
    },
    en: {
      name: 'Florist',
      plural: 'Florists',
      headline: 'Stamp cards for florists',
      intro:
        'Flowers are bought by date: a birthday, an anniversary, a funeral. The business is not in making people come more often, but in being remembered when the date comes.',
      reward: 'A small bouquet, free',
      stamps: 5,
      insight:
        'Five stamps at a quarterly frequency. Asking for the birthday pays twice: you send a greeting and you appear right before the date somebody buys flowers.',
    },
  },
  {
    slug: 'tiendas-de-barrio',
    photoSeed: 'volvia-corner-shop',
    es: {
      name: 'Tienda de barrio',
      plural: 'Tiendas de barrio',
      headline: 'Tarjeta de fidelización para tiendas de barrio',
      intro:
        'La tienda de la esquina ya tiene clientes fieles; lo que no tiene es forma de saber quiénes son ni de agradecérselo. La tarjeta pone nombre a la costumbre.',
      reward: 'Un descuento en tu compra del mes',
      stamps: 10,
      insight:
        'Diez sellos con tope de uno al día. El modo kiosko encaja aquí mejor que el escáner: en una tienda con cola, nadie para a sellar.',
    },
    en: {
      name: 'Corner shop',
      plural: 'Corner shops',
      headline: 'Loyalty cards for corner shops',
      intro:
        'The shop on the corner already has loyal customers; what it does not have is a way to know who they are or to thank them. The card puts names to the habit.',
      reward: 'A discount on your monthly shop',
      stamps: 10,
      insight:
        'Ten stamps with a cap of one a day. Kiosk mode fits better here than the scanner: in a shop with a queue, nobody stops to stamp.',
    },
  },
]

export function industryCopy(industry: Industry, locale: Locale) {
  return industry[locale]
}
