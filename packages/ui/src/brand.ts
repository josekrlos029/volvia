/**
 * Volvia brand tokens — the single place the brand is defined.
 *
 * The palette is the one in `/assets`: navy, violet and orange on an off-white ground.
 * Changing it means editing this file and `styles/theme.css` (a test keeps the two in
 * sync), nothing else. Everything downstream — the dashboard, the customer card, wallet
 * passes and OG images — reads from here; the marketing site layers its own skin on top.
 */

export const brand = {
  name: 'Volvia',
  legalName: 'Volvia',
  tagline: {
    es: 'Tarjetas de fidelización que hacen volver a tus clientes',
    en: 'Loyalty cards that bring your customers back',
  },
  domain: 'somosvolvia.com',
  supportEmail: 'hola@somosvolvia.com',

  colors: {
    /** Primary: the navy of the Volvia mark. Buttons, links, focus rings. */
    primary: '#1E3A8A',
    primaryHover: '#172E6E',
    primarySoft: '#EAEFFB',
    /** Secondary: the violet of the mark, for highlights that are not actions. */
    secondary: '#7C3AED',
    secondarySoft: '#F3EDFD',
    /** Accent: the stamp itself. Orange, because a stamp should feel earned. */
    accent: '#FB923C',
    accentSoft: '#FFF1E5',
    ink: '#0F172A',
    inkMuted: '#475569',
    line: '#E2E8F0',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    inverseSurface: '#0F172A',
    success: '#15803D',
    warning: '#9A4A06',
    danger: '#B3261E',
    info: '#1D4ED8',
  },

  /** Defaults applied to a brand-new stamp card before the business customises it. */
  cardDefaults: {
    backgroundColor: '#1E3A8A',
    foregroundColor: '#FFFFFF',
    accentColor: '#FB923C',
    emptyStampColor: '#3A56A6',
  },

  radius: { sm: '6px', md: '10px', lg: '16px', xl: '24px', full: '9999px' },

  font: {
    sans: "var(--font-geist-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
    display: 'var(--font-geist-sans), system-ui, sans-serif',
    mono: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
  },

  assets: {
    logo: '/brand/logo.svg',
    logoMark: '/brand/mark.svg',
    logoInverse: '/brand/logo-inverse.svg',
    favicon: '/favicon.ico',
    ogImage: '/brand/og.png',
  },
} as const

export type Brand = typeof brand
export type BrandColor = keyof typeof brand.colors
