import type { Locale } from './locales'
import type { SOCIAL_PLATFORMS } from './schemas/org'

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

/**
 * What a customer reads next to each link, on the public page and on the wallet pass.
 * The admin keeps its own owner-facing wording ("Tu web", "La carta").
 */
export const SOCIAL_PLATFORM_LABELS: Record<Locale, Record<SocialPlatform, string>> = {
  es: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    x: 'X',
    youtube: 'YouTube',
    website: 'Sitio web',
    menu: 'Menú',
    booking: 'Reservas',
  },
  en: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    x: 'X',
    youtube: 'YouTube',
    website: 'Website',
    menu: 'Menu',
    booking: 'Bookings',
  },
}

/** The business's own wording wins; otherwise the platform's name in the reader's language. */
export function socialLinkLabel(
  link: { platform: string; label?: string | null },
  locale: Locale,
): string {
  const custom = link.label?.trim()
  if (custom) return custom
  const labels = SOCIAL_PLATFORM_LABELS[locale] as Record<string, string>
  return labels[link.platform] ?? link.platform
}
