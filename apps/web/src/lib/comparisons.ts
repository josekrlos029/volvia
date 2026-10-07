import type { Locale } from './i18n'

/**
 * Honest comparisons.
 *
 * Each page names what the alternative is genuinely better at before saying where
 * Volvia fits. A comparison where the other option has no advantages is an
 * advertisement, and readers can tell within one paragraph.
 */
export interface ComparisonCopy {
  title: string
  description: string
  headline: string
  lede: string
  /** What the alternative does better. First, and in full. */
  theirStrengths: Array<{ title: string; body: string }>
  ourStrengths: Array<{ title: string; body: string }>
  verdict: { forThem: string; forUs: string }
}

export interface Comparison {
  slug: string
  es: ComparisonCopy
  en: ComparisonCopy
}

export const comparisons: Comparison[] = [
  {
    slug: 'tarjeta-de-carton',
    es: {
      title: 'Tarjeta de sellos digital o de cartón: cuál conviene',
      description:
        'El cartón es más barato, más rápido y no se cae nunca. Lo que no hace es decirte quién dejó de venir. Comparación honesta de las dos.',
      headline: 'Digital o cartón',
      lede: 'El cartón lleva cincuenta años funcionando. Si te lo vendemos como si fuera malo, no nos vas a creer el resto.',
      theirStrengths: [
        {
          title: 'No falla nunca',
          body: 'No necesita batería, ni señal, ni que el cliente sepa escanear un QR. Un sello de tinta funciona el día que se cae el internet y el día que se cae tu proveedor.',
        },
        {
          title: 'Es inmediato',
          body: 'Un golpe de sello tarda medio segundo. Nada digital va a ser más rápido que eso.',
        },
        {
          title: 'No cuesta casi nada',
          body: 'Mil cartones cuestan menos que un mes de cualquier software. Si tu margen es muy justo, esto importa.',
        },
      ],
      ourStrengths: [
        {
          title: 'No se pierde',
          body: 'La mitad de los cartones acaban en una chaqueta o en la basura. Cuando eso pasa, el cliente no empieza otro: deja el programa.',
        },
        {
          title: 'Te dice quién se fue',
          body: 'El cartón no sabe contar. No puede decirte que doce clientes habituales llevan dos meses sin aparecer, que es la única información que te permite hacer algo.',
        },
        {
          title: 'Puedes hablarles',
          body: 'Con el cartón, el cliente que dejó de venir es inalcanzable. Con la tarjeta digital tienes un canal para escribirle, si él lo aceptó.',
        },
      ],
      verdict: {
        forThem:
          'Quédate con el cartón si tu programa funciona, tu local es pequeño y no vas a mirar ningún número. Cambiar por cambiar no mejora nada.',
        forUs:
          'Cámbiate si ya te preguntaste alguna vez cuántos clientes habituales tienes y no supiste responder.',
      },
    },
    en: {
      title: 'Digital or paper stamp cards: which one to use',
      description:
        'Paper is cheaper, faster and never goes down. What it cannot do is tell you who stopped coming. An honest comparison of both.',
      headline: 'Digital or paper',
      lede: 'Paper has worked for fifty years. If we sell it to you as if it were bad, you will not believe the rest.',
      theirStrengths: [
        {
          title: 'It never fails',
          body: 'No battery, no signal, no need for the customer to know how to scan a QR code. An ink stamp works on the day the internet goes down and on the day your supplier does.',
        },
        {
          title: 'It is instant',
          body: 'One press takes half a second. Nothing digital is going to beat that.',
        },
        {
          title: 'It costs almost nothing',
          body: 'A thousand paper cards cost less than a month of any software. If your margin is tight, that matters.',
        },
      ],
      ourStrengths: [
        {
          title: 'It cannot be lost',
          body: 'Half the paper cards end up in a jacket or a bin. When that happens the customer does not start another: they leave the programme.',
        },
        {
          title: 'It tells you who left',
          body: 'Paper cannot count. It cannot tell you that twelve regulars have not appeared in two months, which is the only information you can act on.',
        },
        {
          title: 'You can talk to them',
          body: 'With paper, the customer who stopped coming is unreachable. With a digital card you have a channel to write to them, if they agreed to it.',
        },
      ],
      verdict: {
        forThem:
          'Stay on paper if your programme works, your shop is small and you are not going to look at any numbers. Change for its own sake improves nothing.',
        forUs: 'Switch if you have ever wondered how many regulars you have and could not answer.',
      },
    },
  },
  {
    slug: 'app-propia',
    es: {
      title: 'App propia o tarjeta en el navegador: qué le conviene a un negocio local',
      description:
        'Una app propia da control total y notificaciones. También exige que el cliente la instale, que es donde se pierde casi todo el mundo.',
      headline: 'App propia o tarjeta sin app',
      lede: 'La pregunta no es cuál es más potente. Es cuánta gente llega hasta el final.',
      theirStrengths: [
        {
          title: 'Notificaciones de verdad',
          body: 'Una app instalada puede avisar cuando quieras, sin pedir permiso de correo ni depender de la wallet.',
        },
        {
          title: 'Control total',
          body: 'Pedidos, pagos, reservas, puntos y lo que se te ocurra, en un sitio que es tuyo de principio a fin.',
        },
        {
          title: 'Un icono en su pantalla',
          body: 'Si consigues que la instalen y la usen, ganas un espacio en el teléfono que ningún enlace te da.',
        },
      ],
      ourStrengths: [
        {
          title: 'Nadie instala nada',
          body: 'Entre escanear un QR y tener la tarjeta no hay tienda de aplicaciones, ni contraseña, ni 80 MB de descarga. Ahí es donde se cae la mayoría.',
        },
        {
          title: 'Cuesta lo que cuesta',
          body: 'Una app propia son varios miles en desarrollo y un mantenimiento permanente en dos plataformas. Para un local, casi nunca sale la cuenta.',
        },
        {
          title: 'La wallet avisa igual',
          body: 'El pase de Apple o Google Wallet muestra aviso en la pantalla bloqueada cuando hay recompensa. Cubre el caso que de verdad importa.',
        },
      ],
      verdict: {
        forThem:
          'Hazte una app si ya tienes miles de clientes recurrentes y la app va a hacer mucho más que fidelizar: pedidos, pagos, reservas.',
        forUs:
          'Quédate con la tarjeta sin app si tu objetivo es que vuelvan más, y quieres que empiece a funcionar esta semana.',
      },
    },
    en: {
      title: 'Your own app or a card in the browser: what suits a local shop',
      description:
        'Your own app gives full control and real notifications. It also requires the customer to install it, which is where almost everyone is lost.',
      headline: 'Your own app or no app at all',
      lede: 'The question is not which is more powerful. It is how many people make it to the end.',
      theirStrengths: [
        {
          title: 'Real notifications',
          body: 'An installed app can notify whenever you like, with no email permission and no dependence on the wallet.',
        },
        {
          title: 'Full control',
          body: 'Orders, payments, bookings, points and whatever else, in a place that is yours end to end.',
        },
        {
          title: 'An icon on their screen',
          body: 'If you get it installed and used, you win a place on the phone that no link can give you.',
        },
      ],
      ourStrengths: [
        {
          title: 'Nobody installs anything',
          body: 'Between scanning a QR code and having the card there is no app store, no password and no 80 MB download. That is where most people drop out.',
        },
        {
          title: 'It costs what it costs',
          body: 'Your own app is several thousand in development and permanent maintenance on two platforms. For one shop the sums almost never work.',
        },
        {
          title: 'The wallet notifies anyway',
          body: 'An Apple or Google Wallet pass shows a lock-screen notice when a reward is ready. It covers the case that actually matters.',
        },
      ],
      verdict: {
        forThem:
          'Build an app if you already have thousands of recurring customers and it will do much more than loyalty: orders, payments, bookings.',
        forUs:
          'Stay with the no-app card if your goal is getting people back, and you want it working this week.',
      },
    },
  },
  {
    slug: 'puntos-y-descuentos',
    es: {
      title: 'Sellos o puntos: qué entiende mejor tu cliente',
      description:
        'Un sistema de puntos es flexible y cada cliente gasta lo suyo. También es más difícil de explicar en el mostrador, que es donde se decide todo.',
      headline: 'Sellos o puntos',
      lede: 'El sistema más listo pierde contra el que se entiende en tres segundos.',
      theirStrengths: [
        {
          title: 'Se ajusta al gasto',
          body: 'Quien gasta el triple acumula el triple. Con sellos, un café y una comida valen lo mismo, y eso no siempre es justo.',
        },
        {
          title: 'Más margen de diseño',
          body: 'Puedes poner catálogos de premios, niveles y promociones de puntos dobles sobre productos concretos.',
        },
        {
          title: 'Encaja con ticket alto',
          body: 'En negocios donde el ticket varía mucho, los puntos describen mejor lo que aporta cada cliente.',
        },
      ],
      ourStrengths: [
        {
          title: 'Se entiende sin explicar',
          body: 'Diez sellos, un café gratis. No hay conversión, ni equivalencias, ni «¿cuántos puntos me faltan?». Esa claridad es la mitad de por qué funciona.',
        },
        {
          title: 'Se ve el avance',
          body: 'Siete casillas llenas y tres vacías dicen más que «730 puntos». La tarjeta de sellos tiene forma, y la forma motiva.',
        },
        {
          title: 'Es rápido en caja',
          body: 'Un escaneo. Nada que calcular, nada que teclear, nada que pueda salir mal cuando hay cola.',
        },
      ],
      verdict: {
        forThem:
          'Usa puntos si tu ticket varía mucho entre clientes y tienes capacidad de explicar el sistema sin que se note.',
        forUs:
          'Usa sellos si tu producto es parecido en precio y quieres que un cliente nuevo lo entienda sin que nadie se lo cuente.',
      },
    },
    en: {
      title: 'Stamps or points: what your customer understands better',
      description:
        'A points system is flexible and each customer earns what they spend. It is also harder to explain at the counter, which is where everything is decided.',
      headline: 'Stamps or points',
      lede: 'The cleverer system loses to the one that is understood in three seconds.',
      theirStrengths: [
        {
          title: 'It follows spend',
          body: 'Someone spending triple earns triple. With stamps a coffee and a full meal count the same, and that is not always fair.',
        },
        {
          title: 'More room to design',
          body: 'You can have reward catalogues, tiers, and double-point promotions on particular products.',
        },
        {
          title: 'It fits a high ticket',
          body: 'Where the ticket varies a lot, points describe what each customer contributes more accurately.',
        },
      ],
      ourStrengths: [
        {
          title: 'No explanation needed',
          body: 'Ten stamps, one free coffee. No conversion, no equivalences, no “how many points do I need?”. That clarity is half the reason it works.',
        },
        {
          title: 'Progress is visible',
          body: 'Seven filled slots and three empty ones say more than “730 points”. A stamp card has a shape, and shape motivates.',
        },
        {
          title: 'It is fast at the till',
          body: 'One scan. Nothing to calculate, nothing to type, nothing that can go wrong with a queue behind.',
        },
      ],
      verdict: {
        forThem:
          'Use points if your ticket varies widely between customers and you can explain the system without it showing.',
        forUs:
          'Use stamps if your products are similar in price and you want a new customer to understand it with nobody explaining.',
      },
    },
  },
]

export function findComparison(slug: string): Comparison | undefined {
  return comparisons.find((comparison) => comparison.slug === slug)
}

export function comparisonCopy(comparison: Comparison, locale: Locale): ComparisonCopy {
  return comparison[locale]
}
