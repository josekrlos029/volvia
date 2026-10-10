import type { PassContent } from '../types'

/**
 * Builds `pass.json` for a PassKit store card.
 *
 * Field choices follow how the card is actually read at a counter: the progress
 * ("4 of 8") is the primary field because that is what staff and customer both look
 * for, and the reward sits in the secondary row so it is legible on the lock screen.
 */
export interface PassJsonOptions {
  passTypeIdentifier: string
  teamIdentifier: string
  /** Where the device fetches updates and registers for pushes. */
  webServiceURL: string
  authenticationToken: string
  organizationName: string
}

const STRINGS = {
  es: {
    progress: 'Progreso',
    reward: 'Tu recompensa',
    ready: '¡Listo para reclamar!',
    of: 'de',
    terms: 'Términos',
    news: 'Novedades',
    noNews: 'Aquí verás lo que te cuente el negocio.',
    nearby: (org: string, count: number, required: number) =>
      `Estás cerca de ${org}. Llevas ${count}/${required} sellos.`,
    nearbyReward: (org: string) => `Estás cerca de ${org}. ¡Tienes una recompensa lista!`,
  },
  en: {
    progress: 'Progress',
    reward: 'Your reward',
    ready: 'Ready to claim!',
    of: 'of',
    terms: 'Terms',
    news: 'News',
    noNews: 'Messages from the business will show up here.',
    nearby: (org: string, count: number, required: number) =>
      `${org} is nearby. You have ${count}/${required} stamps.`,
    nearbyReward: (org: string) => `${org} is nearby. You have a reward ready!`,
  },
} as const

/**
 * What the lock screen says next to the pass when the customer is near the shop. Built
 * from the card state rather than stored, so every rebuild (each stamp triggers one)
 * keeps it true.
 */
export function nearbyText(content: PassContent): string {
  const strings = STRINGS[content.locale]
  return content.pendingRewardCount > 0
    ? strings.nearbyReward(content.organizationName)
    : strings.nearby(content.organizationName, content.stampsCount, content.stampsRequired)
}

export function buildPassJson(
  content: PassContent,
  options: PassJsonOptions,
): Record<string, unknown> {
  const strings = STRINGS[content.locale]
  const hasReward = content.pendingRewardCount > 0
  const relevantText = nearbyText(content)

  return {
    formatVersion: 1,
    passTypeIdentifier: options.passTypeIdentifier,
    teamIdentifier: options.teamIdentifier,
    serialNumber: content.serial,
    organizationName: options.organizationName,
    description: `${content.organizationName} — ${content.cardName}`,
    logoText: content.organizationName,

    backgroundColor: hexToRgbString(content.backgroundColor),
    foregroundColor: hexToRgbString(content.foregroundColor),
    labelColor: hexToRgbString(content.labelColor),

    webServiceURL: options.webServiceURL,
    authenticationToken: options.authenticationToken,

    // A store card is the right template: no expiry, no seat, just a balance.
    storeCard: {
      headerFields: [
        {
          key: 'progress',
          label: strings.progress,
          value: `${content.stampsCount}/${content.stampsRequired}`,
        },
      ],
      primaryFields: [
        {
          key: 'stamps',
          label: content.cardName,
          value: content.stampsCount,
          // Lets the device animate the change rather than silently swapping the number.
          changeMessage: `${content.organizationName}: %@ ${strings.of} ${content.stampsRequired}`,
        },
      ],
      secondaryFields: [
        {
          key: 'reward',
          label: strings.reward,
          value: hasReward ? strings.ready : content.rewardTitle,
        },
      ],
      auxiliaryFields: content.offerMessage
        ? [{ key: 'offer', label: '★', value: content.offerMessage, changeMessage: '%@' }]
        : [],
      backFields: [
        { key: 'about', label: content.cardName, value: content.rewardDescription },
        { key: 'link', label: 'Volvia', value: content.cardUrl },
        // Always present, even before the first message: the phone only alerts when a
        // field it already knew changes value, so the key has to exist from install.
        {
          key: 'message',
          label: content.latestMessage?.headline ?? strings.news,
          value: content.latestMessage?.body ?? strings.noNews,
          changeMessage: '%@',
        },
        ...(content.terms ? [{ key: 'terms', label: strings.terms, value: content.terms }] : []),
      ],
    },

    barcodes: [
      {
        // The staff scanner reads this to identify the customer's card.
        format: 'PKBarcodeFormatQR',
        message: content.cardUrl,
        messageEncoding: 'iso-8859-1',
        altText: content.serial.slice(0, 8).toUpperCase(),
      },
    ],

    // Surfaces the pass on the lock screen when the customer is near a branch. iOS
    // picks the radius itself (about a hundred metres for a store card); `maxDistance`
    // could only shrink it, so it is left out.
    locations: content.places.map((place) => ({
      latitude: place.latitude,
      longitude: place.longitude,
      relevantText,
    })),

    sharingProhibited: true,
    voided: false,
  }
}

/** PassKit wants `rgb(r, g, b)`, not hex. */
export function hexToRgbString(hex: string): string {
  const normalised = hex.replace('#', '')
  const full =
    normalised.length === 3
      ? normalised
          .split('')
          .map((char) => char + char)
          .join('')
      : normalised
  const value = Number.parseInt(full, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgb(${r}, ${g}, ${b})`
}
