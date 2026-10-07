import type { Locale } from './i18n'

/**
 * Reference numbers, with their provenance attached.
 *
 * Every figure here is an observed range from loyalty programmes in small shops, not a
 * promise and not a study we ran. Saying so is the difference between a useful
 * reference and a number invented to sell. Where we do not know, the page says so.
 */
export interface Benchmark {
  id: string
  /** The honest basis for the number. Shown next to it, never hidden in a footnote. */
  basis: 'observed' | 'arithmetic' | 'rule-of-thumb'
  es: { metric: string; range: string; note: string }
  en: { metric: string; range: string; note: string }
}

export const BENCHMARK_BASIS = {
  es: {
    observed: 'Observado en programas reales',
    arithmetic: 'Aritmética, no estadística',
    'rule-of-thumb': 'Regla práctica del oficio',
  },
  en: {
    observed: 'Observed in real programmes',
    arithmetic: 'Arithmetic, not statistics',
    'rule-of-thumb': 'Trade rule of thumb',
  },
} as const

export const benchmarks: Benchmark[] = [
  {
    id: 'join-rate',
    basis: 'observed',
    es: {
      metric: 'Clientes que se unen cuando se les ofrece',
      range: '25 % – 45 %',
      note: 'Depende casi por completo de quién lo ofrece. Si tu equipo lo menciona al cobrar, está en la banda alta; si solo hay un cartel, en la baja.',
    },
    en: {
      metric: 'Customers who join when offered',
      range: '25% – 45%',
      note: 'It depends almost entirely on who offers it. If your team mentions it while taking payment you are at the top of the range; if there is only a sign, at the bottom.',
    },
  },
  {
    id: 'consent-rate',
    basis: 'observed',
    es: {
      metric: 'De los que se unen, cuántos aceptan promociones',
      range: '55 % – 75 %',
      note: 'Por eso tu alcance de campañas siempre es menor que tu número de clientes. Es la diferencia entre tener el correo y poder usarlo.',
    },
    en: {
      metric: 'Of those who join, how many accept offers',
      range: '55% – 75%',
      note: 'This is why your campaign reach is always smaller than your customer count. It is the difference between holding an email and being allowed to use it.',
    },
  },
  {
    id: 'completion',
    basis: 'observed',
    es: {
      metric: 'Tarjetas que llegan a completarse',
      range: '20 % – 40 %',
      note: 'Baja mucho si la tarjeta es larga para la frecuencia real del negocio. Doce sellos en un sitio al que se va una vez al mes es casi un año: casi nadie llega.',
    },
    en: {
      metric: 'Cards that get completed',
      range: '20% – 40%',
      note: 'It drops sharply when the card is long for the real frequency of the business. Twelve stamps somewhere people visit monthly is nearly a year: almost nobody gets there.',
    },
  },
  {
    id: 'redemption',
    basis: 'observed',
    es: {
      metric: 'Recompensas ganadas que se canjean',
      range: '70 % – 90 %',
      note: 'Si en tu negocio baja de 70 %, revisa dos cosas: que el premio valga la pena y que pedirlo no dé vergüenza.',
    },
    en: {
      metric: 'Earned rewards that get claimed',
      range: '70% – 90%',
      note: 'If yours drops below 70%, check two things: that the prize is worth it, and that asking for it is not embarrassing.',
    },
  },
  {
    id: 'reward-cost',
    basis: 'arithmetic',
    es: {
      metric: 'Lo que cuesta la recompensa por visita',
      range: 'Coste del premio ÷ sellos',
      note: 'Un café que te cuesta 1.000 repartido en diez sellos son 100 por visita. Compáralo con lo que ganas en esa visita, no con el precio de carta.',
    },
    en: {
      metric: 'What the reward costs per visit',
      range: 'Prize cost ÷ stamps',
      note: 'A coffee that costs you 1,000 spread over ten stamps is 100 per visit. Compare that to what you make on the visit, not to the menu price.',
    },
  },
  {
    id: 'review-ctr',
    basis: 'observed',
    es: {
      metric: 'Clientes contentos que llegan a escribir la reseña',
      range: '15 % – 30 %',
      note: 'De los que abren el enlace de Google. Pedirle a más gente no sube este porcentaje: solo sube el número de veces que molestas.',
    },
    en: {
      metric: 'Happy customers who go on to write the review',
      range: '15% – 30%',
      note: 'Of those who open the Google link. Asking more people does not raise this percentage: it only raises how often you bother someone.',
    },
  },
  {
    id: 'winback',
    basis: 'rule-of-thumb',
    es: {
      metric: 'Recuperación de clientes que se alejaron',
      range: '5 % – 15 %',
      note: 'Una campaña de recuperación bien dirigida trae de vuelta a una minoría. Sigue valiendo la pena porque el coste de esa campaña es casi cero, pero no esperes milagros.',
    },
    en: {
      metric: 'Win-back of drifting customers',
      range: '5% – 15%',
      note: 'A well-aimed win-back campaign brings a minority back. It is still worth doing because the campaign costs almost nothing, but do not expect miracles.',
    },
  },
  {
    id: 'stamps-per-card',
    basis: 'rule-of-thumb',
    es: {
      metric: 'Cuántos sellos poner',
      range: 'Entre 6 y 10',
      note: 'La regla que mejor funciona: la tarjeta debería completarse en unos dos meses a tu frecuencia real. Si se tarda más de cuatro, es demasiado larga.',
    },
    en: {
      metric: 'How many stamps to use',
      range: 'Between 6 and 10',
      note: 'The rule that works best: the card should be finishable in about two months at your real frequency. More than four months and it is too long.',
    },
  },
]

export function benchmarksFor(locale: Locale) {
  return benchmarks.map((benchmark) => ({
    id: benchmark.id,
    basis: benchmark.basis,
    ...benchmark[locale],
  }))
}
