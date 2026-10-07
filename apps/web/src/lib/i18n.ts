export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/** Marketing copy. Written for Volvia, in each language, not translated word for word. */
export const site = {
  es: {
    nav: {
      features: 'Funciones',
      pricing: 'Precios',
      industries: 'Sectores',
      resources: 'Recursos',
      blog: 'Blog',
      login: 'Entrar',
      cta: 'Crear mi tarjeta',
    },
    hero: {
      title: 'Tus clientes vuelven cuando les das una razón',
      subtitle:
        'Tarjeta de sellos digital para tu negocio. Sin app para el cliente, sin cartones que se pierden.',
      cta: 'Crear mi tarjeta gratis',
      secondary: 'Ver cómo funciona',
    },
    trust: { title: 'Pensado para negocios de barrio' },
    steps: {
      title: 'De cero a sellando en una tarde',
      items: [
        {
          title: 'Diseña tu tarjeta',
          body: 'Elige cuántos sellos y qué se lleva tu cliente. Te toma cinco minutos.',
        },
        {
          title: 'Pega el QR en el mostrador',
          body: 'Tu cliente lo escanea y su tarjeta queda en el teléfono. No instala nada.',
        },
        {
          title: 'Sella y ve quién vuelve',
          body: 'Tu equipo escanea desde su celular. Tú ves quién viene, cada cuánto y qué se lleva.',
        },
      ],
    },
    wallet: {
      title: 'Vive en el teléfono, no en la billetera',
      body: 'La tarjeta se guarda en Apple Wallet o Google Wallet, junto a las tarjetas del banco. Se actualiza sola con cada sello y avisa cuando hay recompensa lista.',
      points: [
        'Se actualiza sola tras cada visita',
        'Avisa en pantalla bloqueada',
        'Aparece cerca de tu local',
      ],
    },
    features: { title: 'Lo que puedes hacer con Volvia' },
    industries: { title: 'Negocios que ya funcionan así', cta: 'Ver todos los sectores' },
    pricing: {
      title: 'Empieza gratis, crece si te sirve',
      subtitle: 'Sin tarjeta de crédito para empezar.',
      monthly: 'Mensual',
      yearly: 'Anual',
      save: 'Dos meses gratis al año',
      cta: 'Empezar',
      current: 'Gratis para siempre',
    },
    faq: { title: 'Preguntas frecuentes' },
    finalCta: {
      title: 'Tu próxima tarjeta la creas hoy',
      body: 'Cinco minutos para montarla. Gratis mientras la pruebas.',
      cta: 'Crear mi tarjeta',
    },
    footer: {
      product: 'Producto',
      company: 'Volvia',
      legal: 'Legal',
      rights: 'Todos los derechos reservados.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      pricing: 'Pricing',
      industries: 'Industries',
      resources: 'Resources',
      blog: 'Blog',
      login: 'Log in',
      cta: 'Create my card',
    },
    hero: {
      title: 'Customers come back when you give them a reason',
      subtitle:
        'A digital stamp card for your shop. No app for your customers, no paper cards to lose.',
      cta: 'Create my free card',
      secondary: 'See how it works',
    },
    trust: { title: 'Built for neighbourhood businesses' },
    steps: {
      title: 'From nothing to stamping in an afternoon',
      items: [
        {
          title: 'Design your card',
          body: 'Pick how many stamps and what your customer earns. Five minutes.',
        },
        {
          title: 'Put the QR on the counter',
          body: 'Your customer scans it and the card lands on their phone. Nothing to install.',
        },
        {
          title: 'Stamp and see who returns',
          body: 'Your team scans from their own phone. You see who visits, how often, and what they claim.',
        },
      ],
    },
    wallet: {
      title: 'It lives on the phone, not in a wallet',
      body: 'The card saves into Apple Wallet or Google Wallet, next to their bank cards. It updates itself after every stamp and says when a reward is ready.',
      points: [
        'Updates itself after each visit',
        'Shows up on the lock screen',
        'Appears when they are near your shop',
      ],
    },
    features: { title: 'What you can do with Volvia' },
    industries: { title: 'Businesses already running on this', cta: 'See every industry' },
    pricing: {
      title: 'Start free, grow when it pays off',
      subtitle: 'No credit card to start.',
      monthly: 'Monthly',
      yearly: 'Yearly',
      save: 'Two months free per year',
      cta: 'Get started',
      current: 'Free forever',
    },
    faq: { title: 'Common questions' },
    finalCta: {
      title: 'Your next card starts today',
      body: 'Five minutes to set up. Free while you try it.',
      cta: 'Create my card',
    },
    footer: {
      product: 'Product',
      company: 'Volvia',
      legal: 'Legal',
      rights: 'All rights reserved.',
    },
  },
} as const

export type SiteCopy = (typeof site)['es']

export function copyFor(locale: Locale): SiteCopy {
  return site[locale] as SiteCopy
}
