import type { Locale } from '@/lib/i18n'

export const PHONE_DISPLAY = '+57 300 5475055'
export const PHONE_E164 = '+573005475055'

const GREETING = {
  es: 'Hola, quiero saber más sobre Volvia',
  en: 'Hi, I would like to know more about Volvia',
} as const

/** A wa.me link to Jook Agencia's number, with a first message already written. */
export function whatsAppUrl(locale: Locale) {
  return `https://wa.me/${PHONE_E164.slice(1)}?text=${encodeURIComponent(GREETING[locale])}`
}

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.32 11.32 0 0 0 12.05.63C5.77.63.66 5.74.66 12.02c0 2.01.52 3.97 1.52 5.69L.57 23.6l6.04-1.58a11.37 11.37 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.34-8.05z" />
    </svg>
  )
}

/** The WhatsApp glyph plus the number, opening a chat with Jook Agencia. */
export function WhatsAppLink({ locale, className = '' }: { locale: Locale; className?: string }) {
  return (
    <a
      href={whatsAppUrl(locale)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <WhatsAppIcon />
      <span>{PHONE_DISPLAY}</span>
    </a>
  )
}

/** A round WhatsApp button pinned to the bottom-right corner of every page. */
export function WhatsAppFloat({ locale }: { locale: Locale }) {
  return (
    <a
      href={whatsAppUrl(locale)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={locale === 'es' ? 'Escríbenos por WhatsApp' : 'Message us on WhatsApp'}
      className="fixed bottom-5 right-5 z-40 mb-[env(safe-area-inset-bottom)] grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-nav)] transition-transform duration-200 hover:scale-105"
    >
      <WhatsAppIcon size={28} />
    </a>
  )
}
