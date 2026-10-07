import type { Locale } from './i18n'

/**
 * The first thirty days.
 *
 * Most loyalty programmes do not fail in the software, they fail in week two, when the
 * person who set it up stops mentioning it at the counter. This guide is ordered by
 * when things actually go wrong, not by the order of the menu.
 */
export interface PlaybookStep {
  id: string
  /** When this belongs, in days from launch. */
  when: string
  es: { title: string; body: string; mistake: string; check: string }
  en: { title: string; body: string; mistake: string; check: string }
}

export const playbook: PlaybookStep[] = [
  {
    id: 'decide',
    when: '0',
    es: {
      title: 'Decide el trato antes de tocar nada',
      body: 'Cuántos sellos y qué regalas. La regla que mejor funciona: la tarjeta debería poder completarse en unos dos meses al ritmo real al que vuelve tu gente. Calcula el coste del premio, no su precio de carta, y divídelo entre los sellos: eso es lo que te cuesta cada visita.',
      mistake:
        'Poner doce sellos «para que valga la pena». A una visita al mes son doce meses, y casi nadie llega: la tarjeta se abandona a la cuarta.',
      check: 'Sé cuánto me cuesta el premio y en cuántas semanas se completa la tarjeta.',
    },
    en: {
      title: 'Decide the deal before touching anything',
      body: 'How many stamps and what you give away. The rule that works: the card should be finishable in about two months at the rate your people really return. Work out the cost of the prize, not its menu price, and divide it by the stamps: that is what each visit costs you.',
      mistake:
        'Setting twelve stamps “to make it worth it”. At one visit a month that is twelve months, and almost nobody gets there: the card is abandoned by the fourth.',
      check: 'I know what the prize costs me and in how many weeks the card fills.',
    },
  },
  {
    id: 'build',
    when: '0',
    es: {
      title: 'Monta la tarjeta y publícala',
      body: 'Diez minutos. Nombre, sellos, recompensa, tus colores. Añade un sello de regalo al unirse: una tarjeta que nace empezada se completa más que una en blanco, y no te cuesta margen hasta el final.',
      mistake:
        'Dejarla en borrador «hasta que esté perfecta». El QR no imprime solo y la primera semana es la que más altas trae.',
      check: 'La tarjeta está publicada y abrí el enlace desde mi propio teléfono.',
    },
    en: {
      title: 'Build the card and publish it',
      body: 'Ten minutes. Name, stamps, reward, your colours. Add a head-start stamp: a card that is born started gets finished more often than a blank one, and it costs you no margin until the end.',
      mistake:
        'Leaving it in draft “until it is perfect”. The QR code does not print itself, and the first week brings the most signups.',
      check: 'The card is published and I opened the link from my own phone.',
    },
  },
  {
    id: 'counter',
    when: '1',
    es: {
      title: 'Lleva el QR al mostrador, no a la pared del fondo',
      body: 'Donde el cliente paga, a la altura de la mano. Imprímelo en algo que no se caiga y que no quede detrás de la caja registradora. Si tienes domicilios, pon el mismo QR en la caja o en la bolsa.',
      mistake:
        'Pegarlo en la puerta de entrada. Nadie se para a escanear al entrar; se escanea mientras se espera el vuelto.',
      check: 'El QR está donde se paga y lo he escaneado yo mismo desde la posición del cliente.',
    },
    en: {
      title: 'Take the QR to the counter, not the far wall',
      body: 'Where the customer pays, at hand height. Print it on something that will not fall over and does not end up behind the till. If you deliver, put the same QR on the box or the bag.',
      mistake:
        'Sticking it on the entrance door. Nobody stops to scan on the way in; people scan while waiting for change.',
      check:
        'The QR is where payment happens and I have scanned it myself from the customer’s side.',
    },
  },
  {
    id: 'team',
    when: '1',
    es: {
      title: 'Enseña a tu equipo la frase, no el programa',
      body: 'Lo único que hay que entrenar es una frase de seis palabras que se dice al cobrar: «¿Tienes nuestra tarjeta? Son diez segundos». El resto del entrenamiento es escanear una vez, delante de ti.',
      mistake:
        'Explicar la herramienta en una reunión. Nadie recuerda una reunión; todo el mundo recuerda una frase que dijo veinte veces.',
      check: 'Cada persona del equipo ha sellado al menos una tarjeta de verdad.',
    },
    en: {
      title: 'Teach your team the sentence, not the software',
      body: 'The only thing to train is a six-word line said while taking payment: “Have you got our card? Ten seconds.” The rest of the training is scanning once, in front of you.',
      mistake:
        'Explaining the tool in a meeting. Nobody remembers a meeting; everybody remembers a line they said twenty times.',
      check: 'Every person on the team has stamped at least one real card.',
    },
  },
  {
    id: 'week-two',
    when: '7 – 14',
    es: {
      title: 'La semana dos es donde se muere',
      body: 'La novedad se acaba y el equipo deja de mencionarla. Mira el número de altas diarias: si cae a cero, no es que no haya clientes, es que nadie lo está ofreciendo. Vuelve a decir la frase delante del equipo.',
      mistake:
        'Interpretar la caída como que a los clientes no les interesa. Casi siempre es que se dejó de ofrecer.',
      check: 'Comparé las altas de la semana uno con las de la dos y sé por qué cambiaron.',
    },
    en: {
      title: 'Week two is where it dies',
      body: 'The novelty wears off and the team stops mentioning it. Look at daily signups: if they fall to zero, it is not that customers are uninterested, it is that nobody is offering it. Say the line in front of the team again.',
      mistake:
        'Reading the drop as customers not caring. It is nearly always that it stopped being offered.',
      check: 'I compared week one signups to week two and I know why they changed.',
    },
  },
  {
    id: 'first-rewards',
    when: '14 – 30',
    es: {
      title: 'Prepara el primer canje',
      body: 'El primer cliente que complete su tarjeta va a dudar de si de verdad se lo vas a dar. Que tu equipo lo entregue rápido y sin preguntas, y que se note. Ese momento es lo que la gente cuenta a sus amigos.',
      mistake:
        'Poner letra pequeña al entregar el premio. Un «es que solo los martes» convierte el mejor momento del programa en el peor.',
      check: 'El equipo sabe qué hacer cuando alguien enseña una tarjeta completa.',
    },
    en: {
      title: 'Get ready for the first redemption',
      body: 'The first customer to fill a card will doubt whether you really mean it. Have your team hand it over fast, without questions, and visibly. That moment is what people tell their friends about.',
      mistake:
        'Adding small print at the moment of handover. A “only on Tuesdays, actually” turns the best moment of the programme into the worst.',
      check: 'The team knows exactly what to do when someone shows a completed card.',
    },
  },
  {
    id: 'read',
    when: '30',
    es: {
      title: 'Al mes, lee la comunidad',
      body: 'Ya tienes suficientes datos para mirar tres números: cuánta gente se unió, cuántos volvieron al menos una vez, y cuántos días pasan entre visitas. Ese tercer número es el que dice si el programa está cambiando algo.',
      mistake:
        'Mirar solo el total de clientes. Ochocientos correos de gente que no vuelve no es una comunidad, es una lista.',
      check:
        'Sé mi tasa de repetición y mis días entre visitas, y los he comparado con las referencias.',
    },
    en: {
      title: 'At one month, read your community',
      body: 'You now have enough data to look at three numbers: how many joined, how many came back at least once, and how many days pass between visits. That third number is the one that says whether the programme is changing anything.',
      mistake:
        'Looking only at the customer total. Eight hundred emails from people who do not return is not a community, it is a list.',
      check:
        'I know my repeat rate and my days between visits, and I compared them to the benchmarks.',
    },
  },
  {
    id: 'first-campaign',
    when: '30+',
    es: {
      title: 'Lanza la primera campaña al grupo correcto',
      body: 'No a todos. Elige el grupo de los que se están alejando —los que llevan más de lo normal sin aparecer— y mándales algo pequeño. Es la campaña con mejor retorno porque va a gente que ya te conocía.',
      mistake:
        'Un 20 % para toda la lista. Se lo lleva sobre todo quien iba a venir igual, y los que te importan ni se enteran.',
      check: 'Mi primera campaña fue a un segmento, no a todos, y sé a cuánta gente llegó.',
    },
    en: {
      title: 'Launch the first campaign at the right group',
      body: 'Not at everyone. Pick the drifting group — the ones who have been away longer than normal — and send them something small. It is the campaign with the best return because it goes to people who already knew you.',
      mistake:
        'Twenty percent for the whole list. It mostly goes to people who were coming anyway, and the ones who matter never hear about it.',
      check:
        'My first campaign went to a segment, not to everyone, and I know how many people it reached.',
    },
  },
]

export function playbookFor(locale: Locale) {
  return playbook.map((step) => ({ id: step.id, when: step.when, ...step[locale] }))
}
