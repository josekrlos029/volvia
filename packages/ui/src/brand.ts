/**
 * Volvia brand tokens — the single place the brand is defined.
 *
 * PLACEHOLDER PALETTE: the real assets and colours arrive in a later session.
 * Swapping them means editing this file and `styles/theme.css` (a test keeps the
 * two in sync), nothing else. Everything downstream — the marketing site, the
 * dashboard, the customer card, wallet passes and OG images — reads from here.
 */

export const brand = {
  name: 'Volvia',
  legalName: 'Volvia',
  tagline: {
    es: 'Tarjetas de fidelización que hacen volver a tus clientes',
    en: 'Loyalty cards that bring your customers back',
  },
  domain: 'volvia.co',
  supportEmail: 'hola@volvia.co',

  colors: {
    /**
     * Primary: a deep green rather than the SaaS-default violet. Volvia is about
     * customers coming back, and green reads as growth and steadiness to a shop
     * owner in a way that a tech-purple does not.
     */
    primary: '#16624A',
    primaryHover: '#114F3B',
    primarySoft: '#E7F1ED',
    /** Accent: the stamp itself. Warm gold, because a stamp should feel earned. */
    accent: '#E9A23B',
    accentSoft: '#FBF1E0',
    ink: '#10120F',
    inkMuted: '#565B57',
    line: '#E2E6E2',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F8F6',
    inverseSurface: '#14171A',
    success: '#166B45',
    warning: '#9A6206',
    danger: '#B3261E',
    info: '#175E9E',
  },

  /** Defaults applied to a brand-new stamp card before the business customises it. */
  cardDefaults: {
    backgroundColor: '#14171A',
    foregroundColor: '#FFFFFF',
    accentColor: '#E9A23B',
    emptyStampColor: '#31363A',
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
