import type { Locale } from './i18n'

/**
 * One page per feature.
 *
 * A shop owner does not search for "loyalty platform": they search for the problem they
 * have at eleven on a Tuesday — "cómo saber quién dejó de venir", "tarjeta de sellos en
 * el celular sin app". Each page answers one of those questions and only then explains
 * what Volvia does about it.
 */
export interface FeatureCopy {
  name: string
  /** The page's own <title>, written as a search would be typed. */
  title: string
  description: string
  headline: string
  lede: string
  /** The situation, in the business's own terms, before any product talk. */
  problem: { title: string; body: string }
  how: { title: string; body: string }
  details: Array<{ title: string; body: string }>
  /** Honest limits. A page that only praises itself is not read as information. */
  caveat: string
  question: string
  answer: string
}

export interface Feature {
  slug: string
  photoSeed: string
  /** Feature keys that answer a neighbouring question; drives the internal linking. */
  related: string[]
  es: FeatureCopy
  en: FeatureCopy
}

export const features: Feature[] = [
  {
    slug: 'tarjeta-de-sellos-digital',
    photoSeed: 'volvia-stamp-card-phone',
    related: ['wallet', 'escaner-para-el-equipo', 'diseno-de-tarjeta'],
    es: {
      name: 'Tarjeta de sellos digital',
      title: 'Tarjeta de sellos digital, sin app para el cliente',
      description:
        'Tu tarjeta de sellos en el teléfono del cliente. Se une escaneando un QR, sin instalar nada, y la tarjeta se actualiza sola con cada visita.',
      headline: 'La tarjeta de sellos, en el teléfono',
      lede: 'El cartón funcionaba. El problema es que se pierde, se moja, se olvida en la otra chaqueta y nadie sabe cuántas van.',
      problem: {
        title: 'Lo que pasa con el cartón',
        body: 'Un cartón de sellos cuesta poco y se pierde mucho. Cuando el cliente lo pierde, pierde también las ganas de empezar de cero, y tú pierdes la única señal que tenías de que estaba volviendo. Además no te deja saber nada: cuántos van por la mitad, quién dejó de venir, cuántos terminaron.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Pones un QR en el mostrador. El cliente lo escanea, deja su nombre y su correo, y la tarjeta queda en su teléfono. No instala ninguna aplicación. Cada vez que vuelve, tu equipo escanea la tarjeta y el sello aparece al instante.',
      },
      details: [
        {
          title: 'No se pierde',
          body: 'La tarjeta vive en un enlace y en la wallet del teléfono. Si cambia de celular, entra con el mismo correo y sigue donde iba.',
        },
        {
          title: 'Se ve como tu negocio',
          body: 'Tus colores, tu logo y tus palabras. No parece una herramienta genérica con tu nombre encima.',
        },
        {
          title: 'Sabe contar',
          body: 'Cada sello queda registrado con la hora, la sede y quién lo puso. Eso es lo que después te deja saber quién vuelve y quién no.',
        },
      ],
      caveat:
        'No sirve para un negocio donde la gente compra una vez en la vida. Una tarjeta de sellos necesita repetición: si tus clientes no vuelven por naturaleza, primero hay que resolver eso.',
      question: '¿El cliente tiene que descargar una app?',
      answer:
        'No. Escanea un QR y la tarjeta se abre en el navegador que ya tiene. Si quiere, la guarda en Apple Wallet o Google Wallet con un toque.',
    },
    en: {
      name: 'Digital stamp card',
      title: 'A digital stamp card, with no app for your customers',
      description:
        'Your stamp card on the customer’s phone. They join by scanning a QR code, install nothing, and the card updates itself on every visit.',
      headline: 'The stamp card, on the phone',
      lede: 'Paper worked. The trouble is it gets lost, gets wet, stays in the other jacket, and nobody knows how many stamps are on it.',
      problem: {
        title: 'What happens with paper',
        body: 'A paper card is cheap and easily lost. When the customer loses it they also lose the appetite to start again, and you lose the only sign you had that they were coming back. It also tells you nothing: how many are halfway, who stopped coming, how many finished.',
      },
      how: {
        title: 'How it works',
        body: 'You put a QR code on the counter. The customer scans it, leaves a name and an email, and the card lives on their phone. No app to install. Every time they come back your team scans the card and the stamp lands instantly.',
      },
      details: [
        {
          title: 'It cannot be lost',
          body: 'The card lives at a link and in the phone’s wallet. New phone, same email, same card, same progress.',
        },
        {
          title: 'It looks like your shop',
          body: 'Your colours, your logo, your words. Not a generic tool with your name stuck on top.',
        },
        {
          title: 'It counts',
          body: 'Every stamp is recorded with the time, the location and who added it. That is what later tells you who comes back and who does not.',
        },
      ],
      caveat:
        'It is no use for a business people buy from once in a lifetime. A stamp card needs repetition: if your customers do not naturally return, that is the problem to solve first.',
      question: 'Does the customer have to download an app?',
      answer:
        'No. They scan a QR code and the card opens in the browser they already have. If they want, one tap saves it to Apple Wallet or Google Wallet.',
    },
  },
  {
    slug: 'wallet',
    photoSeed: 'volvia-wallet-pass',
    related: ['tarjeta-de-sellos-digital', 'campanas', 'pagina-publica'],
    es: {
      name: 'Apple y Google Wallet',
      title: 'Tarjeta de fidelización en Apple Wallet y Google Wallet',
      description:
        'La tarjeta de tu negocio junto a las del banco. Se actualiza sola con cada sello y avisa en la pantalla bloqueada cuando hay recompensa lista.',
      headline: 'Junto a las tarjetas del banco',
      lede: 'La wallet del teléfono es el único sitio donde una tarjeta no se pierde: está siempre a dos toques.',
      problem: {
        title: 'El problema no es unirse, es volver a encontrarla',
        body: 'Mucha gente se une a un programa y nunca vuelve a abrir el enlace. No porque no le interese, sino porque no se acuerda de dónde quedó. Un correo de hace tres semanas no se encuentra en el mostrador.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Desde su tarjeta, el cliente toca «añadir a la wallet». El pase queda guardado en el teléfono. Cada sello que pones actualiza ese pase en segundos, sin que nadie abra nada.',
      },
      details: [
        {
          title: 'Aviso cuando hay premio',
          body: 'Al completar la tarjeta, el pase avisa en la pantalla bloqueada. Es el único mensaje que puedes mandar sin pedir permiso para enviar correos.',
        },
        {
          title: 'Se actualiza sola',
          body: 'El teléfono consulta los cambios por su cuenta. El cliente abre la wallet y ve el número correcto, aunque el sello se lo pusieras ayer.',
        },
        {
          title: 'Funciona en los dos sistemas',
          body: 'Apple Wallet en iPhone y Google Wallet en Android, con el mismo diseño y las mismas reglas.',
        },
      ],
      caveat:
        'Los pases de Apple necesitan un certificado de Apple Developer a nombre de tu negocio o del nuestro. Es un trámite anual, y mientras no esté, la tarjeta funciona igual en el navegador.',
      question: '¿Funciona si el cliente tiene Android?',
      answer:
        'Sí. En Android la tarjeta se guarda en Google Wallet y se comporta igual: se actualiza sola y avisa cuando hay recompensa.',
    },
    en: {
      name: 'Apple and Google Wallet',
      title: 'Loyalty cards in Apple Wallet and Google Wallet',
      description:
        'Your shop’s card next to the bank cards. It updates itself on every stamp and shows a lock-screen notice when a reward is ready.',
      headline: 'Next to the bank cards',
      lede: 'The phone’s wallet is the one place a card does not get lost: it is always two taps away.',
      problem: {
        title: 'Joining is easy; finding it again is not',
        body: 'Plenty of people join a programme and never open the link again. Not for lack of interest — they simply cannot remember where it went. An email from three weeks ago is not findable at a counter.',
      },
      how: {
        title: 'How it works',
        body: 'From their card the customer taps “add to wallet”. The pass is saved on the phone. Every stamp you add updates that pass within seconds, with nobody opening anything.',
      },
      details: [
        {
          title: 'A notice when there is a reward',
          body: 'When the card fills up, the pass shows a notice on the lock screen. It is the one message you can send without asking permission to email.',
        },
        {
          title: 'It refreshes itself',
          body: 'The phone checks for changes on its own. The customer opens the wallet and sees the right number, even if you stamped it yesterday.',
        },
        {
          title: 'Both platforms',
          body: 'Apple Wallet on iPhone, Google Wallet on Android, same design and same rules.',
        },
      ],
      caveat:
        'Apple passes need an Apple Developer certificate in your business’s name or in ours. It is a yearly piece of paperwork, and until it is in place the card works the same in the browser.',
      question: 'Does it work if the customer has Android?',
      answer:
        'Yes. On Android the card saves to Google Wallet and behaves the same: it updates itself and gives notice when a reward is ready.',
    },
  },
  {
    slug: 'escaner-para-el-equipo',
    photoSeed: 'volvia-staff-scanner',
    related: ['modo-kiosko', 'tarjeta-de-sellos-digital', 'equipo-y-sedes'],
    es: {
      name: 'Escáner para tu equipo',
      title: 'Escáner de sellos para el personal, también sin señal',
      description:
        'Tu equipo suma sellos desde su propio celular en un segundo, con reglas anti abuso y registro de quién puso cada uno. Funciona sin internet.',
      headline: 'Un segundo en el mostrador',
      lede: 'Si sellar tarda más que cobrar, nadie sella. Esa es la única prueba que importa.',
      problem: {
        title: 'La hora pico no perdona',
        body: 'A las ocho de la mañana con seis personas en fila, cualquier paso extra se salta. Un programa de fidelización que necesita abrir una aplicación, buscar al cliente y confirmar dos veces se deja de usar en una semana.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Tu equipo abre el escáner en el navegador de su celular, apunta al QR del cliente y el sello queda puesto. No hay aplicación que instalar ni contraseña que recordar en cada turno.',
      },
      details: [
        {
          title: 'Sin señal también',
          body: 'Si se cae el internet, el escáner guarda los sellos y los envía cuando vuelve la conexión. Nadie se queda sin su sello por culpa del wifi.',
        },
        {
          title: 'Imposible sellar dos veces',
          body: 'Cada escaneo lleva una llave única. Si el botón se toca dos veces, el sello sigue siendo uno.',
        },
        {
          title: 'Sabes quién selló',
          body: 'Cada sello queda con el nombre de quien lo puso y la sede. No para vigilar, sino para poder responder cuando un número no cuadra.',
        },
      ],
      caveat:
        'El escáner necesita cámara y permiso del navegador. En un celular muy antiguo puede ir lento; para esos casos existe el modo kiosko con código en pantalla.',
      question: '¿Cada persona del equipo necesita su propia cuenta?',
      answer:
        'Es lo recomendable, y el plan Negocio incluye varias. Así sabes quién selló qué. Si prefieres una cuenta compartida, también funciona.',
    },
    en: {
      name: 'A scanner for your team',
      title: 'A stamp scanner for staff that works without signal',
      description:
        'Your team adds stamps from their own phone in a second, with anti-abuse rules and a record of who added each one. It works offline.',
      headline: 'One second at the counter',
      lede: 'If stamping takes longer than taking the money, nobody stamps. That is the only test that matters.',
      problem: {
        title: 'The morning rush forgives nothing',
        body: 'At eight in the morning with six people queuing, any extra step gets skipped. A loyalty programme that needs an app opened, a customer looked up and two confirmations stops being used within a week.',
      },
      how: {
        title: 'How it works',
        body: 'Your team opens the scanner in their phone’s browser, points it at the customer’s QR code, and the stamp lands. No app to install, no password to remember every shift.',
      },
      details: [
        {
          title: 'Offline too',
          body: 'If the internet drops, the scanner keeps the stamps and sends them when the connection comes back. Nobody misses a stamp because of the wifi.',
        },
        {
          title: 'Double-stamping is impossible',
          body: 'Every scan carries a unique key. Tap the button twice and the stamp is still one.',
        },
        {
          title: 'You know who stamped',
          body: 'Each stamp records who added it and where. Not to police anyone — so you can answer when a number looks wrong.',
        },
      ],
      caveat:
        'The scanner needs a camera and the browser’s permission. On a very old phone it can be slow; kiosk mode with an on-screen code covers those cases.',
      question: 'Does each team member need their own account?',
      answer:
        'It is the better way, and the Business plan includes several. That is how you know who stamped what. A shared account works too.',
    },
  },
  {
    slug: 'modo-kiosko',
    photoSeed: 'volvia-kiosk-tablet',
    related: ['escaner-para-el-equipo', 'tarjeta-de-sellos-digital'],
    es: {
      name: 'Modo kiosko',
      title: 'Modo kiosko: el cliente se sella solo, sin fraude',
      description:
        'Una pantalla en el mostrador muestra un código que cambia cada 30 segundos. El cliente se sella solo y tu equipo no interrumpe lo que está haciendo.',
      headline: 'El cliente se sella solo',
      lede: 'En un sitio con mucha gente y poco personal, el sello se convierte en una interrupción. El kiosko la quita.',
      problem: {
        title: 'Cuando parar a sellar cuesta más que el sello',
        body: 'En una panadería a mediodía o en un gimnasio a las siete, nadie va a dejar lo que está haciendo para escanear tarjetas. El programa se usa el primer mes y luego se abandona.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Dejas una tablet o un celular viejo en el mostrador con un código en pantalla. El cliente lo escanea con su teléfono y su sello se suma. El código cambia cada 30 segundos.',
      },
      details: [
        {
          title: 'El código caduca',
          body: 'Treinta segundos. Lo suficiente para escanear estando ahí, insuficiente para mandarle una foto a un amigo que no vino.',
        },
        {
          title: 'Tope por cliente',
          body: 'Defines cuántos sellos puede sumarse una persona por día en kiosko. Normalmente uno.',
        },
        {
          title: 'Convive con el escáner',
          body: 'Puedes tener el kiosko encendido y seguir sellando a mano cuando haga falta. Las mismas reglas se aplican a los dos.',
        },
      ],
      caveat:
        'El kiosko confía en que quien escanea está en tu local. Con el código rotando y el tope diario el fraude es marginal, pero no es cero: no lo pongas en un sitio donde la recompensa sea muy cara.',
      question: '¿Hace falta comprar una tablet?',
      answer:
        'No. Sirve cualquier celular viejo con el navegador abierto. Lo único que necesita es pantalla y corriente.',
    },
    en: {
      name: 'Kiosk mode',
      title: 'Kiosk mode: customers stamp themselves, without the fraud',
      description:
        'A screen on the counter shows a code that changes every 30 seconds. Customers stamp themselves and your team never stops what they are doing.',
      headline: 'The customer stamps themselves',
      lede: 'In a busy shop with a small team, stamping becomes an interruption. Kiosk mode removes it.',
      problem: {
        title: 'When stopping to stamp costs more than the stamp',
        body: 'In a bakery at lunchtime or a gym at seven, nobody is going to drop what they are doing to scan cards. The programme gets used for a month and then quietly abandoned.',
      },
      how: {
        title: 'How it works',
        body: 'You leave a tablet or an old phone on the counter showing a code. The customer scans it with their phone and their stamp lands. The code changes every 30 seconds.',
      },
      details: [
        {
          title: 'The code expires',
          body: 'Thirty seconds. Long enough to scan while standing there, too short to photograph and send to a friend who never came.',
        },
        {
          title: 'A cap per customer',
          body: 'You set how many stamps one person can give themselves per day at the kiosk. Usually one.',
        },
        {
          title: 'It lives alongside the scanner',
          body: 'You can run the kiosk and still stamp by hand when you need to. The same rules apply to both.',
        },
      ],
      caveat:
        'Kiosk mode trusts that whoever scans is standing in your shop. With a rotating code and a daily cap the fraud is marginal, but it is not zero: do not use it where the reward is expensive.',
      question: 'Do I need to buy a tablet?',
      answer:
        'No. Any old phone with the browser open will do. All it needs is a screen and power.',
    },
  },
  {
    slug: 'clientes-y-segmentos',
    photoSeed: 'volvia-customer-list',
    related: ['campanas', 'analitica', 'automatizaciones'],
    es: {
      name: 'Clientes y segmentos',
      title: 'Saber quién vuelve, quién se está alejando y quién ya no viene',
      description:
        'Tus clientes repartidos en cinco grupos según su ritmo real de visitas, con la frecuencia que tú defines. Sin etiquetas que mantener a mano.',
      headline: 'Tu comunidad, en cinco números',
      lede: 'La pregunta no es cuántos clientes tienes. Es cuántos de ellos todavía vuelven.',
      problem: {
        title: 'Una lista no es información',
        body: 'Tener 800 correos no dice nada. Entre esos 800 hay gente que viene cada semana y gente que pasó una vez hace dos años. Tratarlos igual es la razón por la que los correos de fidelización no funcionan.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Dices cada cuánto esperas que vuelva un buen cliente —cada semana, cada quince días, cada mes, cada tres meses— y Volvia reparte a todos en cinco grupos medidos contra ese ritmo: habituales, vuelven, nuevos, se alejan y perdidos.',
      },
      details: [
        {
          title: 'Medido con tu reloj',
          body: 'Cuarenta días sin venir es normal en una barbería y es una fuga en una cafetería. Los grupos se calculan contra tu frecuencia, no contra un mes del calendario.',
        },
        {
          title: 'Nadie en dos grupos',
          body: 'Cada cliente cae en uno y solo uno, así que los cinco números suman tu total. Sirven para leer el negocio de un vistazo.',
        },
        {
          title: 'De ahí sale la acción',
          body: 'Marcas a los que te interesan y de ahí salen una campaña o una exportación. No es un informe para mirar, es una lista para usar.',
        },
      ],
      caveat:
        'Los grupos se calculan con las visitas que registras. Si tu equipo sella solo la mitad de las veces, los números dirán que mucha gente se está alejando cuando en realidad sigue viniendo.',
      question: '¿Puedo cambiar la frecuencia después?',
      answer:
        'Sí, cuando quieras. Los grupos se recalculan al momento, porque no se guardan: se leen de las visitas cada vez.',
    },
    en: {
      name: 'Customers and segments',
      title: 'Know who still comes back, who is drifting and who is gone',
      description:
        'Your customers split into five groups by their real visit rhythm, against the frequency you set. No tags to maintain by hand.',
      headline: 'Your community, in five numbers',
      lede: 'The question is not how many customers you have. It is how many of them still come back.',
      problem: {
        title: 'A list is not information',
        body: 'Having 800 emails tells you nothing. Among those 800 are people who come weekly and people who passed through once two years ago. Treating them the same is why loyalty emails do not work.',
      },
      how: {
        title: 'How it works',
        body: 'You say how often you expect a good customer back — weekly, fortnightly, monthly, quarterly — and Volvia sorts everyone into five groups measured against that rhythm: regulars, returning, new, drifting and lost.',
      },
      details: [
        {
          title: 'Measured by your clock',
          body: 'Forty days away is normal at a barber and a leak at a coffee shop. The groups are calculated against your frequency, not a calendar month.',
        },
        {
          title: 'Nobody in two groups',
          body: 'Every customer falls in exactly one, so the five numbers add up to your total. They are there to read the business at a glance.',
        },
        {
          title: 'Action comes out of it',
          body: 'You tick the ones you care about and that becomes a campaign or an export. It is not a report to look at, it is a list to use.',
        },
      ],
      caveat:
        'The groups are built from the visits you record. If your team only stamps half the time, the numbers will say people are drifting when in fact they are still coming.',
      question: 'Can I change the frequency later?',
      answer:
        'Any time. The groups recalculate immediately, because they are not stored: they are read from the visits each time.',
    },
  },
  {
    slug: 'campanas',
    photoSeed: 'volvia-campaign-evening',
    related: ['clientes-y-segmentos', 'automatizaciones', 'wallet'],
    es: {
      name: 'Campañas',
      title: 'Campañas para llenar un día flojo o recuperar clientes',
      description:
        'Promociones temporales que aparecen en la tarjeta del cliente y se retiran solas. Con plantillas para empezar y el alcance real antes de enviar.',
      headline: 'Mover la aguja un martes',
      lede: 'Una promoción no sirve si la ve todo el mundo. Sirve cuando llega a quien estaba a punto de no volver.',
      problem: {
        title: 'El descuento general sale caro',
        body: 'Un 20 % para todos se lo lleva sobre todo quien iba a venir de todas formas. Pagas por visitas que ya tenías, y los que dejaron de venir ni se enteran.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Eliges una plantilla, el grupo al que va y cuántos días dura. La promoción aparece dentro de la tarjeta de esas personas y desaparece sola al terminar. Antes de lanzar ves a cuántas personas llega de verdad.',
      },
      details: [
        {
          title: 'Nueve plantillas',
          body: 'Día flojo, hora feliz, recupéralos, sellos dobles, gasta y gana, novedad, gracias habitual, última llamada y oferta puntual. Todas editables.',
        },
        {
          title: 'Cada uno ve lo suyo',
          body: 'Puedes escribir «te faltan {{remaining}} sellos» y cada cliente lee su número, no un promedio.',
        },
        {
          title: 'Se apaga sola',
          body: 'Pones la fecha de fin y te olvidas. Nada se queda colgado dando descuentos tres semanas de más.',
        },
      ],
      caveat:
        'Las campañas llegan por la tarjeta y por correo a quien aceptó promociones. Si tu lista es pequeña o casi nadie aceptó, el alcance será pequeño por mucho que la campaña sea buena.',
      question: '¿Cuántas campañas puedo mandar?',
      answer:
        'Depende del plan, y el panel te muestra cuántas llevas del mes antes de que choques con el límite. El contador vuelve a cero el día 1.',
    },
    en: {
      name: 'Campaigns',
      title: 'Campaigns to fill a slow day or win customers back',
      description:
        'Temporary offers that appear on the customer’s card and retire themselves. Templates to start from, and the real reach before you send.',
      headline: 'Moving the needle on a Tuesday',
      lede: 'An offer is not useful when everyone sees it. It is useful when it reaches the person who was about to stop coming.',
      problem: {
        title: 'A blanket discount is expensive',
        body: 'Twenty percent for everyone mostly goes to the people who were coming anyway. You pay for visits you already had, and the ones who stopped coming never hear about it.',
      },
      how: {
        title: 'How it works',
        body: 'You pick a template, the group it goes to, and how many days it runs. The offer appears inside those people’s cards and disappears on its own. Before launching you see how many people it really reaches.',
      },
      details: [
        {
          title: 'Nine templates',
          body: 'Slow day, happy hour, win-back, double stamps, spend and get, something new, thank you regular, last chance and a one-off deal. All editable.',
        },
        {
          title: 'Everyone sees their own',
          body: 'You can write “you are {{remaining}} stamps away” and each customer reads their number, not an average.',
        },
        {
          title: 'It switches itself off',
          body: 'Set the end date and forget it. Nothing is left running discounts three weeks too long.',
        },
      ],
      caveat:
        'Campaigns arrive through the card and by email to people who opted in. If your list is small or few people opted in, the reach will be small however good the campaign is.',
      question: 'How many campaigns can I send?',
      answer:
        'It depends on the plan, and the dashboard shows how many you have used this month before you hit the limit. The counter resets on the 1st.',
    },
  },
  {
    slug: 'automatizaciones',
    photoSeed: 'volvia-birthday-table',
    related: ['campanas', 'clientes-y-segmentos', 'encuestas-y-resenas'],
    es: {
      name: 'Automatizaciones',
      title: 'Cumpleaños y bienvenida que salen solos',
      description:
        'El detalle de cumpleaños y el correo de bienvenida se configuran una vez y se envían solos, en la hora de tu negocio.',
      headline: 'Configurado una vez, enviado siempre',
      lede: 'Lo que depende de que alguien se acuerde, no pasa.',
      problem: {
        title: 'Las buenas intenciones no se ejecutan',
        body: 'Todo el mundo quiere felicitar a sus clientes por su cumpleaños. Casi nadie lo hace dos meses seguidos, porque implica revisar una lista cada mañana.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Escribes el mensaje y decides qué regalas. A partir de ahí sale solo el día que toca, a la hora de tu zona horaria, a quien corresponda.',
      },
      details: [
        {
          title: 'Cumpleaños',
          body: 'Pides solo el día y el mes, nunca el año. El detalle llega el día exacto con los sellos de regalo que elijas.',
        },
        {
          title: 'Bienvenida',
          body: 'El correo que llega segundos después de unirse, cuando la persona todavía está en tu mostrador. Es el que más se abre de todos.',
        },
        {
          title: 'Con tus palabras',
          body: 'Si no escribes nada, se envía un texto correcto a nombre de tu negocio. Si escribes, suena a ti.',
        },
      ],
      caveat:
        'Solo se felicita a quien dio su cumpleaños al unirse. Si quitaste esa pregunta del formulario de alta, no hay a quién felicitar.',
      question: '¿A qué hora salen?',
      answer:
        'En la mañana de la zona horaria de tu negocio, no de la nuestra. Un cliente en Bogotá no recibe su felicitación a las tres de la madrugada.',
    },
    en: {
      name: 'Automations',
      title: 'Birthday and welcome messages that send themselves',
      description:
        'The birthday treat and the welcome email are set up once and sent on their own, in your shop’s own time zone.',
      headline: 'Set up once, sent every time',
      lede: 'Anything that depends on somebody remembering does not happen.',
      problem: {
        title: 'Good intentions do not run themselves',
        body: 'Everyone wants to wish their customers a happy birthday. Almost nobody does it two months running, because it means checking a list every morning.',
      },
      how: {
        title: 'How it works',
        body: 'You write the message and decide what you are giving. From then on it goes out on the right day, at the right hour for your time zone, to the right person.',
      },
      details: [
        {
          title: 'Birthdays',
          body: 'You ask only for the day and the month, never the year. The treat arrives on the exact day with the bonus stamps you chose.',
        },
        {
          title: 'Welcome',
          body: 'The email that lands seconds after someone joins, while they are still at your counter. It is the most-opened message you will ever send.',
        },
        {
          title: 'In your words',
          body: 'Write nothing and a sensible message goes out in your shop’s name. Write something and it sounds like you.',
        },
      ],
      caveat:
        'Only people who gave a birthday when they joined get one. If you removed that question from the signup form, there is nobody to greet.',
      question: 'What time do they go out?',
      answer:
        'In the morning of your shop’s time zone, not ours. A customer in Bogotá does not get their greeting at three in the morning.',
    },
  },
  {
    slug: 'encuestas-y-resenas',
    photoSeed: 'volvia-review-counter',
    related: ['automatizaciones', 'clientes-y-segmentos', 'pagina-publica'],
    es: {
      name: 'Encuestas y reseñas',
      title: 'Más reseñas en Google, sin perseguir a nadie',
      description:
        'Una pregunta corta en la tarjeta del cliente. Quien está contento pasa a dejar la reseña; quien no, te lo cuenta en privado.',
      headline: 'Pedir reseña en el momento justo',
      lede: 'La reseña se pide cuando la persona acaba de decirte que le fue bien. Nunca antes.',
      problem: {
        title: 'Pedir reseñas a ciegas sale mal',
        body: 'Mandar «déjanos cinco estrellas» a toda la lista es la forma más rápida de que alguien molesto escriba lo que piensa en público. Y el que sí estaba contento no se acuerda de en qué momento le gustó.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Una encuesta corta aparece en la tarjeta del cliente en el momento que tú elijas: al unirse, al ganar una recompensa o a los X sellos. Si puntúa alto, le ofrecemos dejar la reseña en Google. Si puntúa bajo, el comentario se queda contigo.',
      },
      details: [
        {
          title: 'Una vez cada seis meses',
          body: 'A la misma persona no se le pide reseña dos veces en medio año, conteste las encuestas que conteste.',
        },
        {
          title: 'Pedidas y abiertas',
          body: 'Ves cuántas veces se ofreció y cuántas la persona fue de verdad a Google. La diferencia entre esos dos números es lo único honesto que se puede medir aquí.',
        },
        {
          title: 'Se puede pausar',
          body: 'Una mala semana se para con un botón, sin desconectar tu ficha ni perder el historial.',
        },
      ],
      caveat:
        'Nunca pedimos una reseña a quien puntuó bajo, y tampoco te dejamos hacerlo. Filtrar opiniones negativas hacia el buzón privado es legítimo; empujar a los contentos y esconder a los demás sería otra cosa.',
      question: '¿Volvia escribe reseñas?',
      answer:
        'No. Solo le ponemos el enlace delante a quien ya dijo que estaba contento. Lo que escriba, y si escribe, es cosa suya.',
    },
    en: {
      name: 'Surveys and reviews',
      title: 'More Google reviews, without chasing anyone',
      description:
        'A short question on the customer’s card. Happy people go on to leave the review; unhappy ones tell you in private.',
      headline: 'Asking at the right moment',
      lede: 'You ask for the review when the person has just told you it went well. Never before.',
      problem: {
        title: 'Asking blind goes badly',
        body: 'Sending “leave us five stars” to the whole list is the fastest way to get an annoyed customer writing in public. And the happy one cannot remember what they liked.',
      },
      how: {
        title: 'How it works',
        body: 'A short survey appears on the customer’s card at the moment you choose: on joining, on earning a reward, or at X stamps. Score it high and we offer the Google review. Score it low and the comment stays with you.',
      },
      details: [
        {
          title: 'Once every six months',
          body: 'The same person is never asked twice in half a year, however many surveys they answer.',
        },
        {
          title: 'Asked and opened',
          body: 'You see how many times it was offered and how many actually went to Google. The gap between those two numbers is the only honest thing to measure here.',
        },
        {
          title: 'It can be paused',
          body: 'A bad week is stopped with one button, without unlinking your listing or losing the history.',
        },
      ],
      caveat:
        'We never ask for a review from someone who scored low, and we do not let you either. Routing unhappy feedback to a private inbox is fair; nudging the happy ones while hiding the rest would be something else.',
      question: 'Does Volvia write reviews?',
      answer:
        'No. We only put the link in front of someone who already said they were happy. What they write, and whether they write, is up to them.',
    },
  },
  {
    slug: 'analitica',
    photoSeed: 'volvia-dashboard-morning',
    related: ['clientes-y-segmentos', 'campanas', 'equipo-y-sedes'],
    es: {
      name: 'Analítica',
      title: 'Analítica de fidelización: quién vuelve y cuánto tardan',
      description:
        'Repetición, ritmo de visitas, horas con más movimiento y recompensas canjeadas. Los números que cambian una decisión, no los que decoran un informe.',
      headline: 'Pocos números, de los que deciden',
      lede: 'Un panel con treinta gráficas no se mira. Uno con cinco respuestas, sí.',
      problem: {
        title: 'Vender bien no es lo mismo que fidelizar',
        body: 'La caja te dice cuánto vendiste. No te dice si vendiste a los mismos de siempre o a gente nueva que no volverá. Dos negocios con la misma caja pueden tener futuros muy distintos.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Cada sello queda registrado con su hora, su sede y su origen. De ahí salen las respuestas: cuántos repiten, cada cuántos días vuelven, a qué horas, y cuántas recompensas se canjean de verdad.',
      },
      details: [
        {
          title: 'Hoy, primero',
          body: 'El panel abre con lo de hoy: sellos, altas y canjes. Lo abres entre un cliente y otro, no en una reunión.',
        },
        {
          title: 'Días entre visitas',
          body: 'La mediana de días que pasan entre una visita y la siguiente. Es el número que de verdad mide si el programa está funcionando.',
        },
        {
          title: 'Tus horas flojas',
          body: 'El mapa de horas con más y menos movimiento, que es de donde salen las campañas de día flojo y hora feliz.',
        },
      ],
      caveat:
        'Solo sabemos de las visitas que pasan por la tarjeta. Si la mitad de tus clientes no se unió al programa, los números describen a la otra mitad.',
      question: '¿Puedo exportar los datos?',
      answer:
        'Sí, tus clientes salen en CSV desde el plan Pro, con los filtros que tengas puestos. Son tus datos.',
    },
    en: {
      name: 'Analytics',
      title: 'Loyalty analytics: who comes back and how long they take',
      description:
        'Repeat rate, visit rhythm, your busiest hours and rewards actually claimed. The numbers that change a decision, not the ones that decorate a report.',
      headline: 'Few numbers, the deciding ones',
      lede: 'A dashboard with thirty charts does not get looked at. One with five answers does.',
      problem: {
        title: 'Selling well is not the same as keeping people',
        body: 'The till tells you how much you sold. It does not tell you whether you sold to the same people as always or to new people who will not come back. Two shops with the same takings can have very different futures.',
      },
      how: {
        title: 'How it works',
        body: 'Every stamp is recorded with its hour, its location and its source. The answers come out of that: how many repeat, how many days between visits, at what hours, and how many rewards are really claimed.',
      },
      details: [
        {
          title: 'Today, first',
          body: 'The dashboard opens on today: stamps, signups, redemptions. You open it between customers, not in a meeting.',
        },
        {
          title: 'Days between visits',
          body: 'The median number of days from one visit to the next. It is the number that really measures whether the programme works.',
        },
        {
          title: 'Your quiet hours',
          body: 'The map of busiest and emptiest hours — which is where slow-day and happy-hour campaigns come from.',
        },
      ],
      caveat:
        'We only know about visits that go through the card. If half your customers never joined, the numbers describe the other half.',
      question: 'Can I export the data?',
      answer:
        'Yes, your customers export to CSV from the Pro plan, with whatever filters you have set. It is your data.',
    },
  },
  {
    slug: 'diseno-de-tarjeta',
    photoSeed: 'volvia-card-design',
    related: ['tarjeta-de-sellos-digital', 'pagina-publica', 'wallet'],
    es: {
      name: 'Diseño de la tarjeta',
      title: 'Diseña tu tarjeta de sellos: colores, sellos y mensajes',
      description:
        'Cuatro formas de sello, degradados, catorce texturas y frases que cambian entre visitas. La vista previa es la tarjeta, no una aproximación.',
      headline: 'Que parezca tuya, no nuestra',
      lede: 'El cliente abre esa tarjeta veinte veces al mes. Si parece un formulario, es un formulario.',
      problem: {
        title: 'Las plantillas con tu logo encima se notan',
        body: 'Una tarjeta genérica con el logo pegado arriba dice exactamente lo que es: una herramienta contratada. Lo que debería decir es que entraste en un sitio que cuida los detalles.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Eliges paleta, forma de sello, fondo y textura, y escribes lo que la tarjeta dice. Lo que ves mientras editas es exactamente lo que verá el cliente, porque es el mismo componente.',
      },
      details: [
        {
          title: 'Cuatro formas de sello',
          body: 'Redondo, redondeado, cuadrado y con aro. Pequeño cambio, mucha diferencia según el oficio.',
        },
        {
          title: 'Catorce texturas',
          body: 'Se dibujan con tus propios colores, así que cambias la paleta y la textura te sigue sin volver a subir nada.',
        },
        {
          title: 'Frases que cambian',
          body: 'Hasta cinco frases que rotan entre visitas, más frases escritas para un momento exacto: el primer sello, o el que falta para el premio.',
        },
      ],
      caveat:
        'Los colores propios y las texturas llegan con el plan Pro. En el plan Gratis la tarjeta funciona igual, con la paleta por defecto.',
      question: '¿Puedo cambiar el diseño con clientes dentro?',
      answer:
        'Sí. Los colores y las palabras se cambian cuando quieras. Lo que no se puede tocar es el trato: cuántos sellos y qué recompensa, porque alguien ya empezó a cumplirlo.',
    },
    en: {
      name: 'Card design',
      title: 'Design your stamp card: colours, stamps and messages',
      description:
        'Four stamp shapes, gradients, fourteen textures and lines that change between visits. The preview is the card, not an approximation.',
      headline: 'It should look like yours, not ours',
      lede: 'Your customer opens that card twenty times a month. If it looks like a form, it is a form.',
      problem: {
        title: 'Templates with a logo on top are obvious',
        body: 'A generic card with your logo stuck at the top says exactly what it is: a tool someone bought. What it should say is that you walked into a place that cares about details.',
      },
      how: {
        title: 'How it works',
        body: 'You pick a palette, a stamp shape, a background and a texture, and you write what the card says. What you see while editing is exactly what the customer sees, because it is the same component.',
      },
      details: [
        {
          title: 'Four stamp shapes',
          body: 'Round, rounded, square and ringed. A small change that reads very differently from trade to trade.',
        },
        {
          title: 'Fourteen textures',
          body: 'Drawn from your own colours, so change the palette and the texture follows without re-uploading anything.',
        },
        {
          title: 'Lines that change',
          body: 'Up to five lines rotating between visits, plus lines written for an exact moment: the first stamp, or the one before the reward.',
        },
      ],
      caveat:
        'Custom colours and textures come with the Pro plan. On the Free plan the card works the same, with the default palette.',
      question: 'Can I change the design with customers on the card?',
      answer:
        'Yes. Colours and wording change whenever you like. What cannot be touched is the deal — the stamp count and the reward — because somebody has already started working towards it.',
    },
  },
  {
    slug: 'pagina-publica',
    photoSeed: 'volvia-public-page',
    related: ['tarjeta-de-sellos-digital', 'diseno-de-tarjeta', 'encuestas-y-resenas'],
    es: {
      name: 'Tu página pública',
      title: 'Una página para tu negocio con tu tarjeta y tus enlaces',
      description:
        'Tu tarjeta, tu horario, tu ubicación y tus redes en un enlace. Sirve como la bio de Instagram y como el QR del mostrador.',
      headline: 'El enlace que pones en todas partes',
      lede: 'Muchos negocios no tienen web. Tienen un Instagram, un WhatsApp y un cartel en la puerta.',
      problem: {
        title: 'Un enlace para cada cosa',
        body: 'Uno para la carta, otro para reservar, otro para el WhatsApp y ninguno para la tarjeta de sellos. En la bio solo cabe uno, y al final nadie encuentra lo que busca.',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Cada negocio tiene una página en somosvolvia.com con su nombre. Ahí está la tarjeta para unirse, tus enlaces, tus sedes con horario y mapa, y el aviso de privacidad a tu nombre.',
      },
      details: [
        {
          title: 'Tus enlaces',
          body: 'WhatsApp, Telegram, Instagram, la carta, reservas, tu web. Con el nombre que tú les pongas.',
        },
        {
          title: 'Tu color y tu botón',
          body: 'El color de tu marca y el texto del botón principal. «Obtener mi tarjeta» o lo que tú dirías.',
        },
        {
          title: 'Privacidad a tu nombre',
          body: 'Un aviso propio con tu razón social y tu correo de datos. El cliente te dio el correo a ti, no a nosotros.',
        },
      ],
      caveat:
        'No es un constructor de webs. Es una página buena para lo que hace; si necesitas secciones, blog y tienda, necesitas otra cosa.',
      question: '¿Puedo usar mi propio dominio?',
      answer:
        'Hoy la página vive en somosvolvia.com con tu nombre. Un dominio propio no está disponible todavía.',
    },
    en: {
      name: 'Your public page',
      title: 'A page for your shop with your card and your links',
      description:
        'Your card, your hours, your location and your socials at one link. It works as your Instagram bio and as the QR on the counter.',
      headline: 'The link you put everywhere',
      lede: 'Plenty of shops have no website. They have an Instagram, a WhatsApp and a sign on the door.',
      problem: {
        title: 'One link for each thing',
        body: 'One for the menu, one for bookings, one for WhatsApp and none for the stamp card. The bio fits one, and in the end nobody finds what they were looking for.',
      },
      how: {
        title: 'How it works',
        body: 'Every shop gets a page at somosvolvia.com under its own name. The card to join is there, with your links, your locations with hours and a map, and a privacy notice in your name.',
      },
      details: [
        {
          title: 'Your links',
          body: 'WhatsApp, Telegram, Instagram, the menu, bookings, your site. Named whatever you call them.',
        },
        {
          title: 'Your colour and your button',
          body: 'Your brand colour and the wording of the main button. “Get my card”, or whatever you would say.',
        },
        {
          title: 'Privacy in your name',
          body: 'Your own notice with your legal name and your data contact. The customer gave their email to you, not to us.',
        },
      ],
      caveat:
        'It is not a website builder. It is a good page for what it does; if you need sections, a blog and a shop, you need something else.',
      question: 'Can I use my own domain?',
      answer:
        'Today the page lives at somosvolvia.com under your name. A custom domain is not available yet.',
    },
  },
  {
    slug: 'equipo-y-sedes',
    photoSeed: 'volvia-two-locations',
    related: ['escaner-para-el-equipo', 'analitica', 'modo-kiosko'],
    es: {
      name: 'Equipo y sedes',
      title: 'Varias sedes y cuentas para tu equipo, con permisos',
      description:
        'Cada persona con su cuenta y su sede, el dueño con la vista completa, y los números separados por local cuando hace falta.',
      headline: 'Dos locales, un programa',
      lede: 'Cuando abres el segundo local, lo que se rompe primero no es la caja: es saber qué pasa en el que no estás.',
      problem: {
        title: 'Lo que no se ve no se dirige',
        body: 'Con un local, lo sabes porque estás ahí. Con dos, las preguntas se vuelven invisibles: ¿sellan igual de seguido?, ¿los clientes del nuevo vuelven como los del viejo?',
      },
      how: {
        title: 'Cómo funciona',
        body: 'Invitas a tu equipo por correo con un rol: dueño, administrador o mostrador. A quien trabaja en un local lo atas a esa sede, y sus sellos quedan contados ahí.',
      },
      details: [
        {
          title: 'Tres roles',
          body: 'Dueño ve y cambia todo. Administrador gestiona el día a día. Mostrador solo sella.',
        },
        {
          title: 'La tarjeta es la misma',
          body: 'Un cliente suma sellos en cualquiera de tus sedes y su tarjeta es una sola. Es tu negocio, no tus locales.',
        },
        {
          title: 'Quién selló qué',
          body: 'Cada sello guarda persona y sede. Sirve para entender un número raro sin tener que acusar a nadie.',
        },
      ],
      caveat:
        'Las cuentas de equipo y las sedes extra van por plan. Un negocio de un solo local no necesita nada de esto.',
      question: '¿Un empleado puede ver los datos de los clientes?',
      answer:
        'Quien tiene rol de mostrador sella y poco más. Los datos de contacto y la analítica son para dueño y administrador.',
    },
    en: {
      name: 'Team and locations',
      title: 'Several locations and staff accounts, with roles',
      description:
        'Everyone with their own account and their own location, the owner with the full view, and the numbers split by shop when you need them.',
      headline: 'Two shops, one programme',
      lede: 'When you open the second shop, the first thing that breaks is not the till: it is knowing what happens in the one you are not standing in.',
      problem: {
        title: 'What you cannot see, you cannot run',
        body: 'With one shop you know because you are there. With two, the questions turn invisible: are they stamping as often? Do the new shop’s customers come back like the old one’s?',
      },
      how: {
        title: 'How it works',
        body: 'You invite your team by email with a role: owner, admin or counter. Anyone who works in one shop is tied to that location, and their stamps are counted there.',
      },
      details: [
        {
          title: 'Three roles',
          body: 'Owner sees and changes everything. Admin runs the day to day. Counter only stamps.',
        },
        {
          title: 'One card everywhere',
          body: 'A customer collects stamps at any of your shops and has a single card. It is your business, not your buildings.',
        },
        {
          title: 'Who stamped what',
          body: 'Every stamp keeps the person and the location. It is for understanding an odd number, not for accusing anyone.',
        },
      ],
      caveat:
        'Team accounts and extra locations depend on the plan. A single-shop business needs none of this.',
      question: 'Can a staff member see customer data?',
      answer:
        'Someone with the counter role stamps and little else. Contact details and analytics are for the owner and admins.',
    },
  },
]

export function featureCopy(feature: Feature, locale: Locale): FeatureCopy {
  return feature[locale]
}

export function findFeature(slug: string): Feature | undefined {
  return features.find((feature) => feature.slug === slug)
}
