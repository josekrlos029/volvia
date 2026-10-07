import type { Locale } from './i18n'

/**
 * Plain definitions of the words this industry uses badly.
 *
 * Half of them get used to mean three different things depending on who is selling.
 * Each entry says what it means, how it is measured, and what it is often confused with.
 */
export interface GlossaryTerm {
  slug: string
  es: { term: string; short: string; body: string; confusedWith?: string }
  en: { term: string; short: string; body: string; confusedWith?: string }
}

export const glossary: GlossaryTerm[] = [
  {
    slug: 'tasa-de-repeticion',
    es: {
      term: 'Tasa de repetición',
      short: 'Qué parte de tus clientes volvió al menos una vez más.',
      body: 'De cada cien personas que se unieron a tu tarjeta, cuántas han vuelto al menos una segunda vez. Es el número más honesto de un programa de fidelización, porque una primera visita la compra cualquiera con un descuento; la segunda hay que ganársela.',
      confusedWith:
        'No es lo mismo que «clientes activos»: alguien puede haber vuelto una vez hace un año y seguir contando como repetidor.',
    },
    en: {
      term: 'Repeat rate',
      short: 'How many of your customers came back at least once more.',
      body: 'Out of a hundred people who joined your card, how many came back a second time. It is the most honest number in a loyalty programme, because anyone can buy a first visit with a discount; the second one has to be earned.',
      confusedWith:
        'Not the same as “active customers”: someone may have returned once a year ago and still count as a repeater.',
    },
  },
  {
    slug: 'frecuencia-de-visita',
    es: {
      term: 'Frecuencia de visita',
      short: 'Cada cuántos días vuelve un cliente, de mediana.',
      body: 'La mediana de días entre una visita y la siguiente. Se usa la mediana y no el promedio porque dos clientes muy fieles distorsionan el promedio hacia abajo y te hacen creer que todo va bien.',
      confusedWith:
        'No es la frecuencia que tú esperas, sino la que realmente ocurre. La diferencia entre las dos es el trabajo pendiente.',
    },
    en: {
      term: 'Visit frequency',
      short: 'How many days pass between visits, as a median.',
      body: 'The median number of days from one visit to the next. A median rather than an average, because two very loyal customers drag an average down and make everything look fine.',
      confusedWith:
        'Not the frequency you expect, but the one that actually happens. The gap between the two is the work to be done.',
    },
  },
  {
    slug: 'churn',
    es: {
      term: 'Fuga (churn)',
      short: 'La gente que dejó de venir sin avisar.',
      body: 'En una suscripción el cliente se da de baja y queda registrado. En un negocio de barrio nadie se da de baja: simplemente deja de aparecer. Por eso la fuga se define por tiempo sin visita, y ese plazo depende de tu oficio: cuarenta días son normales en una barbería y son una fuga en una cafetería.',
      confusedWith:
        'No es lo mismo que un cliente perdido. Alguien que se aleja todavía se puede recuperar; por eso conviene separar «se alejan» de «perdidos».',
    },
    en: {
      term: 'Churn',
      short: 'The people who stopped coming without saying so.',
      body: 'In a subscription a customer cancels and it is recorded. In a neighbourhood shop nobody cancels: they simply stop turning up. So churn is defined by time since the last visit, and that window depends on your trade: forty days is normal at a barber and a leak at a coffee shop.',
      confusedWith:
        'Not the same as a lost customer. Someone drifting can still be won back; that is why “drifting” and “lost” are worth separating.',
    },
  },
  {
    slug: 'ventaja-inicial',
    es: {
      term: 'Ventaja inicial',
      short: 'Sellos que la tarjeta ya trae al entregarse.',
      body: 'Dar la tarjeta con uno o dos sellos puestos. Es una de las pocas cosas en fidelización con evidencia repetida a favor: una tarjeta empezada se completa más que una en blanco, aunque el esfuerzo real sea idéntico.',
      confusedWith:
        'No es un descuento. No cuesta margen hasta que la tarjeta se completa, y mientras tanto cambia la sensación de avance.',
    },
    en: {
      term: 'Head start',
      short: 'Stamps the card already carries when you hand it over.',
      body: 'Giving the card with one or two stamps already on it. It is one of the few things in loyalty with repeated evidence behind it: a started card gets finished more often than a blank one, even when the real effort is identical.',
      confusedWith:
        'It is not a discount. It costs no margin until the card is completed, and in the meantime it changes the feeling of progress.',
    },
  },
  {
    slug: 'canje',
    es: {
      term: 'Canje',
      short: 'La recompensa entregada de verdad.',
      body: 'Completar la tarjeta y reclamar el premio son dos cosas distintas. El canje es la segunda. Si mucha gente completa y poca canjea, el premio no vale lo suficiente o es incómodo de pedir.',
      confusedWith:
        'No es lo mismo que recompensa ganada. La diferencia entre ganadas y canjeadas es la señal más barata de que algo falla en tu oferta.',
    },
    en: {
      term: 'Redemption',
      short: 'The reward actually handed over.',
      body: 'Filling the card and claiming the prize are two different things. Redemption is the second. If many fill and few claim, the prize is not worth enough or it is awkward to ask for.',
      confusedWith:
        'Not the same as a reward earned. The gap between earned and redeemed is the cheapest signal that something is wrong with your offer.',
    },
  },
  {
    slug: 'segmento',
    es: {
      term: 'Segmento',
      short: 'Un grupo de clientes definido por lo que hacen, no por una etiqueta.',
      body: 'Un segmento útil se calcula solo a partir del comportamiento: cuándo vino la última vez, cuántas veces ha venido, cuándo se unió. Un segmento que alguien tiene que mantener a mano deja de ser cierto en dos semanas.',
      confusedWith:
        'No es una lista de correo. Una lista es estática; un segmento cambia cada día porque la gente cambia de comportamiento.',
    },
    en: {
      term: 'Segment',
      short: 'A group of customers defined by what they do, not by a tag.',
      body: 'A useful segment is computed from behaviour alone: when they last came, how often they have come, when they joined. A segment somebody has to maintain by hand stops being true within a fortnight.',
      confusedWith:
        'Not a mailing list. A list is static; a segment changes daily because people change behaviour.',
    },
  },
  {
    slug: 'pase-de-wallet',
    es: {
      term: 'Pase de wallet',
      short: 'La tarjeta guardada en Apple Wallet o Google Wallet.',
      body: 'Un archivo firmado que el teléfono guarda junto a las tarjetas del banco. Se actualiza solo cuando cambia algo y puede mostrar un aviso en la pantalla bloqueada. Es el único canal que no depende de que el cliente abra un correo.',
      confusedWith:
        'No es una aplicación. El cliente no instala nada: el pase vive dentro de la wallet que ya trae el teléfono.',
    },
    en: {
      term: 'Wallet pass',
      short: 'The card saved in Apple Wallet or Google Wallet.',
      body: 'A signed file the phone keeps next to the bank cards. It refreshes itself when something changes and can show a notice on the lock screen. It is the only channel that does not depend on the customer opening an email.',
      confusedWith:
        'Not an app. The customer installs nothing: the pass lives inside the wallet the phone already has.',
    },
  },
  {
    slug: 'modo-kiosko',
    es: {
      term: 'Modo kiosko',
      short: 'El cliente se sella solo desde una pantalla en el mostrador.',
      body: 'Una pantalla muestra un código que cambia cada pocos segundos. El cliente lo escanea con su teléfono y se pone el sello sin que nadie del equipo intervenga. Sirve en sitios con cola y poco personal.',
      confusedWith:
        'No es lo mismo que dejar la tarjeta abierta. El código caduca y hay un tope diario, que es lo que impide que se comparta por foto.',
    },
    en: {
      term: 'Kiosk mode',
      short: 'The customer stamps themselves from a screen on the counter.',
      body: 'A screen shows a code that changes every few seconds. The customer scans it with their phone and the stamp lands without anyone on the team stepping in. It earns its place where there are queues and few staff.',
      confusedWith:
        'Not the same as leaving the card open. The code expires and there is a daily cap, which is what stops it being shared as a photo.',
    },
  },
  {
    slug: 'consentimiento',
    es: {
      term: 'Consentimiento de marketing',
      short: 'El permiso explícito para enviar promociones.',
      body: 'Unirse a una tarjeta no es permiso para enviar publicidad. Son dos cosas separadas y la segunda se pide aparte, con una casilla que el cliente marca él. Por eso tu lista de clientes y tu alcance de campañas casi nunca coinciden.',
      confusedWith:
        'No es lo mismo que tener el correo. Tener la dirección y poder usarla para promociones son permisos distintos.',
    },
    en: {
      term: 'Marketing consent',
      short: 'Explicit permission to send offers.',
      body: 'Joining a card is not permission to advertise. They are two separate things, and the second is asked for separately with a box the customer ticks themselves. That is why your customer count and your campaign reach almost never match.',
      confusedWith:
        'Not the same as having the email. Holding the address and being allowed to use it for offers are different permissions.',
    },
  },
  {
    slug: 'coste-de-recompensa',
    es: {
      term: 'Coste de la recompensa',
      short: 'Lo que te cuesta a ti el premio, no lo que vale en carta.',
      body: 'Un café que vendes a cinco te cuesta uno. La recompensa se calcula sobre el coste, no sobre el precio: ese es el número que decides repartir entre las visitas que hacen falta para ganarla.',
      confusedWith:
        'No es un descuento del 10 %. Un sello de cada diez suena a eso, pero se paga una vez y solo a quien de verdad volvió diez veces.',
    },
    en: {
      term: 'Reward cost',
      short: 'What the prize costs you, not what it says on the menu.',
      body: 'A coffee you sell for five costs you one. The reward is worked out on cost, not on price: that is the number you are spreading across the visits it takes to earn it.',
      confusedWith:
        'Not a 10% discount. One stamp in ten sounds like one, but it is paid once and only to someone who really came back ten times.',
    },
  },
]

export function glossaryFor(locale: Locale) {
  return glossary
    .map((term) => ({ slug: term.slug, ...term[locale] }))
    .sort((a, b) => a.term.localeCompare(b.term, locale))
}
