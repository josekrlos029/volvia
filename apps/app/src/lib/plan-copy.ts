import { PLANS } from '@volvia/shared'

/** What each plan feature is called in the dashboard. */
export const FEATURE_LABELS: Record<string, string> = {
  wallet_passes: 'Tarjeta en Apple y Google Wallet',
  custom_branding: 'Colores propios',
  custom_stamp_icons: 'Icono de sello propio',
  premium_card_display: 'Tarjeta destacada',
  customer_contact_details: 'Correos de tus clientes',
  birthday_automation: 'Cumpleaños automáticos',
  customer_messages: 'Mensajes a clientes',
  custom_segments: 'Segmentos propios',
  campaigns: 'Campañas',
  surveys: 'Encuestas',
  google_review_requests: 'Pedir reseñas en Google',
  full_analytics: 'Analítica completa',
  csv_export: 'Exportar a CSV',
  team_accounts: 'Cuentas para tu equipo',
  kiosk_mode: 'Modo kiosko',
  page_catalogue: 'Carta y productos en tu página',
  multi_location: 'Varias sedes',
  priority_support: 'Soporte prioritario',
}

/** Shorter names for the sidebar, where a sentence has to fit in three lines. */
const SHORT_LABELS: Record<string, string> = {
  wallet_passes: 'Wallet',
  custom_branding: 'colores propios',
  custom_stamp_icons: 'icono de sello propio',
  premium_card_display: 'tarjeta destacada',
  customer_contact_details: 'correos de clientes',
  birthday_automation: 'cumpleaños',
  customer_messages: 'mensajes',
  custom_segments: 'segmentos',
  campaigns: 'campañas',
  surveys: 'encuestas',
  google_review_requests: 'reseñas en Google',
  full_analytics: 'analítica',
  csv_export: 'exportar a CSV',
  team_accounts: 'equipo',
  page_catalogue: 'carta y productos en tu página',
  kiosk_mode: 'kiosko',
  multi_location: 'varias sedes',
  priority_support: 'soporte prioritario',
}

/** The features a trial business is using for free, in the order they matter at a counter. */
const TRIAL_PRIORITY = [
  'wallet_passes',
  'custom_branding',
  'campaigns',
  'birthday_automation',
  'customer_messages',
  'google_review_requests',
  'surveys',
  'kiosk_mode',
  'csv_export',
  'team_accounts',
]

/**
 * One sentence saying what closes when the trial ends: the first `max` features by
 * name, then "y N más". Pure, so the sidebar copy can be tested without React.
 */
export function trialLockSummary(
  features: readonly string[] = PLANS.business.features,
  max = 4,
): string {
  const ordered = [
    ...TRIAL_PRIORITY.filter((feature) => features.includes(feature)),
    ...features.filter((feature) => !TRIAL_PRIORITY.includes(feature)),
  ]
  const named = ordered.slice(0, max).map((feature) => SHORT_LABELS[feature] ?? feature)
  const rest = ordered.length - named.length
  if (named.length === 0) return ''
  const list = named.join(', ')
  return rest > 0 ? `${list} y ${rest} más` : list
}
