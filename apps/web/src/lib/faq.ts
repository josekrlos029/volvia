import type { Locale } from './i18n'

/**
 * The questions a shop owner actually asks before signing up.
 *
 * Written to be answered, not to be sold to: where the honest answer is "no" or "it
 * depends", it says so. A FAQ that only reassures is read as marketing and skipped.
 */
export interface FaqEntry {
  id: string
  group: string
  es: { question: string; answer: string }
  en: { question: string; answer: string }
}

export const FAQ_GROUPS = {
  es: {
    start: 'Empezar',
    customers: 'Tus clientes',
    team: 'Tu equipo',
    money: 'Precio y datos',
  },
  en: {
    start: 'Getting started',
    customers: 'Your customers',
    team: 'Your team',
    money: 'Price and data',
  },
} as const

export const faq: FaqEntry[] = [
  {
    id: 'app',
    group: 'customers',
    es: {
      question: '¿Mi cliente tiene que descargar una aplicación?',
      answer:
        'No. Escanea un QR y la tarjeta se abre en el navegador que ya tiene en el teléfono. Si quiere, con un toque la guarda en Apple Wallet o Google Wallet y queda junto a las tarjetas del banco.',
    },
    en: {
      question: 'Does my customer have to download an app?',
      answer:
        'No. They scan a QR code and the card opens in the browser already on their phone. If they want, one tap saves it to Apple Wallet or Google Wallet, next to their bank cards.',
    },
  },
  {
    id: 'setup-time',
    group: 'start',
    es: {
      question: '¿Cuánto se tarda en dejarlo funcionando?',
      answer:
        'Una tarde. Crear la tarjeta y publicarla son diez minutos; lo que de verdad lleva tiempo es decidir cuántos sellos y qué regalas, y eso conviene pensarlo bien porque no se puede cambiar una vez que hay clientes dentro.',
    },
    en: {
      question: 'How long does it take to get running?',
      answer:
        'An afternoon. Creating and publishing the card is ten minutes; what really takes time is deciding how many stamps and what you are giving away — and that is worth thinking through, because it cannot be changed once customers are collecting.',
    },
  },
  {
    id: 'change-deal',
    group: 'start',
    es: {
      question: '¿Puedo cambiar la recompensa después?',
      answer:
        'Mientras la tarjeta no tenga clientes, sí. Cuando ya hay gente juntando sellos, no te dejamos cambiar ni el número de sellos ni la recompensa: sería reescribir un trato que alguien empezó a cumplir. El diseño y las palabras sí se pueden cambiar cuando quieras. Si necesitas otra oferta, creas otra tarjeta.',
    },
    en: {
      question: 'Can I change the reward later?',
      answer:
        'While the card has no customers, yes. Once people are collecting, we do not let you change the stamp count or the reward: that would rewrite a deal somebody started working towards. Design and wording can change any time. If you need a different offer, you make another card.',
    },
  },
  {
    id: 'paper',
    group: 'start',
    es: {
      question: 'Ya tengo tarjetas de cartón. ¿Qué hago con ellas?',
      answer:
        'Lo que mejor funciona es dar por válidos los sellos de cartón durante un mes: el cliente enseña su cartón, tú le pones esos sellos a mano en la tarjeta nueva y el cartón se queda. Sin ese puente, la gente siente que pierde lo que llevaba y no se cambia.',
    },
    en: {
      question: 'I already have paper cards. What do I do with them?',
      answer:
        'What works is honouring the paper stamps for a month: the customer shows the card, you add those stamps by hand to the new one and keep the paper. Without that bridge people feel they are losing what they had, and they do not switch.',
    },
  },
  {
    id: 'no-smartphone',
    group: 'customers',
    es: {
      question: '¿Y los clientes que no se manejan con el teléfono?',
      answer:
        'Les pasa a todos los negocios. Lo honesto es que una parte de tu clientela no va a usar esto, y para esa parte el cartón sigue siendo mejor. Convivir las dos cosas durante un tiempo no es un fracaso, es lo normal.',
    },
    en: {
      question: 'What about customers who are not comfortable with phones?',
      answer:
        'Every shop has them. The honest answer is that part of your customers will not use this, and for them paper is still better. Running both for a while is not a failure, it is normal.',
    },
  },
  {
    id: 'data-owner',
    group: 'money',
    es: {
      question: '¿De quién son los datos de mis clientes?',
      answer:
        'Tuyos. Los exportas en CSV cuando quieras desde el plan Pro, con los filtros que tengas puestos. Nosotros no vendemos ni cedemos esos datos, y el aviso de privacidad que ve tu cliente va a nombre de tu negocio, no del nuestro.',
    },
    en: {
      question: 'Who owns my customers’ data?',
      answer:
        'You do. Export it to CSV whenever you like from the Pro plan, with whatever filters you have set. We do not sell or share it, and the privacy notice your customer reads is in your business’s name, not ours.',
    },
  },
  {
    id: 'fraud',
    group: 'team',
    es: {
      question: '¿Qué impide que alguien se ponga sellos de más?',
      answer:
        'Tres cosas: una espera mínima entre sellos que tú defines, un tope diario por cliente, y el registro de quién puso cada sello. En modo kiosko, además, el código de la pantalla caduca a los 30 segundos para que no se pueda compartir por foto.',
    },
    en: {
      question: 'What stops someone from giving themselves extra stamps?',
      answer:
        'Three things: a minimum wait between stamps that you set, a daily cap per customer, and a record of who added each stamp. In kiosk mode the on-screen code also expires after 30 seconds, so it cannot be shared as a photo.',
    },
  },
  {
    id: 'offline',
    group: 'team',
    es: {
      question: '¿Funciona si se cae el internet?',
      answer:
        'El escáner sí. Guarda los sellos en el teléfono de tu equipo y los envía cuando vuelve la conexión; el cliente ve su sello actualizado un momento después. Lo que no funciona sin conexión es unirse por primera vez.',
    },
    en: {
      question: 'Does it work when the internet drops?',
      answer:
        'The scanner does. It keeps the stamps on your team’s phone and sends them when the connection returns; the customer sees the stamp a moment later. What does not work offline is joining for the first time.',
    },
  },
  {
    id: 'staff-accounts',
    group: 'team',
    es: {
      question: '¿Cada empleado necesita su cuenta?',
      answer:
        'Es lo recomendable y viene incluido desde el plan Negocio. Con cuentas separadas sabes quién selló qué, que es lo único que te deja aclarar un número raro sin acusar a nadie. Una cuenta compartida también funciona.',
    },
    en: {
      question: 'Does every employee need an account?',
      answer:
        'It is the better way and it is included from the Business plan. With separate accounts you know who stamped what, which is the only thing that lets you clear up an odd number without accusing anyone. A shared account works too.',
    },
  },
  {
    id: 'cost',
    group: 'money',
    es: {
      question: '¿Hay plan gratis de verdad o es una prueba?',
      answer:
        'Hay un plan Gratis permanente, con la tarjeta, el escáner y tu página pública. Además, todo negocio nuevo tiene abiertas las funciones premium hasta llegar a 30 clientes, para que pruebe con datos reales antes de pagar nada.',
    },
    en: {
      question: 'Is the free plan really free, or is it a trial?',
      answer:
        'There is a permanent Free plan with the card, the scanner and your public page. On top of that, every new business has the premium features open until it reaches 30 customers, so you can judge them on real data before paying anything.',
    },
  },
  {
    id: 'cancel',
    group: 'money',
    es: {
      question: '¿Qué pasa si me doy de baja?',
      answer:
        'Tu página y tus tarjetas dejan de funcionar al momento, y tus clientes ya no pueden abrir las suyas. Guardamos los datos un tiempo por si fue un error: si escribes, los recuperamos. Antes de cerrar, exporta tus clientes.',
    },
    en: {
      question: 'What happens if I close my account?',
      answer:
        'Your page and your cards stop working immediately, and your customers can no longer open theirs. We keep the data for a while in case it was a mistake: write to us and we restore it. Export your customers before you close.',
    },
  },
  {
    id: 'reviews',
    group: 'customers',
    es: {
      question: '¿Volvia escribe reseñas en Google por mí?',
      answer:
        'No, y no deberías querer una herramienta que lo haga. Lo que hacemos es ponerle el enlace delante a un cliente que acaba de decirte en una encuesta que le fue bien. Lo que escriba, y si escribe, es cosa suya.',
    },
    en: {
      question: 'Does Volvia write Google reviews for me?',
      answer:
        'No, and you should not want a tool that does. What we do is put the link in front of a customer who has just told you in a survey that it went well. What they write, and whether they write, is up to them.',
    },
  },
  {
    id: 'pos',
    group: 'start',
    es: {
      question: '¿Se conecta con mi caja o mi punto de venta?',
      answer:
        'Todavía no. Hoy el sello se pone escaneando desde el celular o con el modo kiosko, al lado de la caja pero por fuera de ella. Si tu caja es la pieza central de tu operación, tenlo en cuenta antes de empezar.',
    },
    en: {
      question: 'Does it connect to my till or point of sale?',
      answer:
        'Not yet. Today the stamp is added by scanning from a phone or through kiosk mode — beside the till, not inside it. If your till is the centre of how you work, factor that in before starting.',
    },
  },
  {
    id: 'languages',
    group: 'customers',
    es: {
      question: '¿En qué idioma ve la tarjeta mi cliente?',
      answer:
        'En el idioma que configures para tu negocio: español o inglés. El cliente no elige, porque escanea un QR en tu mostrador y lo que espera es leerlo en el idioma en que le hablas.',
    },
    en: {
      question: 'What language does my customer see the card in?',
      answer:
        'The language you set for your shop: Spanish or English. The customer does not choose, because they scan a QR on your counter and expect to read it in the language you speak to them in.',
    },
  },
]

export function faqFor(locale: Locale) {
  return faq.map((entry) => ({ ...entry, ...entry[locale] }))
}
