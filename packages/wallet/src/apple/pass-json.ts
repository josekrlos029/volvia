import type { PassContent } from '../types'

/**
 * Builds `pass.json` for a PassKit store card.
 *
 * The layout mirrors how the card is read at the counter and in the stacked Wallet
 * list. The header is the only row visible while passes are collapsed, so it carries
 * the business (as a label) and the progress; the lockup in `logo.png` sits to its
 * left. The primary row is the reward the customer is working towards, because that
 * is the question the card answers; the stamps themselves are drawn in `strip.png`.
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
    nextReward: 'Próxima recompensa',
    rewardReady: 'Recompensa lista',
    reward: 'Tu recompensa',
    ready: '¡Listo para reclamar!',
    remaining: 'Te faltan',
    stamps: (count: number) => (count === 1 ? '1 sello' : `${count} sellos`),
    cycle: 'Vuelta',
    lastVisit: 'Última visita',
    terms: 'Términos',
    news: 'Novedades',
    noNews: 'Aquí verás lo que te cuente el negocio.',
    stamped: (remaining: number, reward: string) =>
      `¡Sello sumado! Llevas %@. Te faltan ${remaining} para ${reward}.`,
    earned: (org: string) => `${org}: %@`,
    nearby: (org: string, count: number, required: number) =>
      `Estás cerca de ${org}. Llevas ${count}/${required} sellos.`,
    nearbyReward: (org: string) => `Estás cerca de ${org}. ¡Tienes una recompensa lista!`,
  },
  en: {
    nextReward: 'Next reward',
    rewardReady: 'Reward ready',
    reward: 'Your reward',
    ready: 'Ready to claim!',
    remaining: 'You need',
    stamps: (count: number) => (count === 1 ? '1 more stamp' : `${count} more stamps`),
    cycle: 'Round',
    lastVisit: 'Last visit',
    terms: 'Terms',
    news: 'News',
    noNews: 'Messages from the business will show up here.',
    stamped: (remaining: number, reward: string) =>
      `Stamp added! You have %@. ${remaining} more for ${reward}.`,
    earned: (org: string) => `${org}: %@`,
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

/** Stamps still to earn before the next reward (or the end of the card). */
export function stampsRemaining(content: PassContent): number {
  const target = content.nextRewardAt ?? content.stampsRequired
  return Math.max(0, target - content.stampsCount)
}

export function buildPassJson(
  content: PassContent,
  options: PassJsonOptions,
): Record<string, unknown> {
  const strings = STRINGS[content.locale]
  const hasReward = content.pendingRewardCount > 0
  const remaining = stampsRemaining(content)
  const relevantText = nearbyText(content)

  return {
    formatVersion: 1,
    passTypeIdentifier: options.passTypeIdentifier,
    teamIdentifier: options.teamIdentifier,
    serialNumber: content.serial,
    organizationName: options.organizationName,
    description: `${content.organizationName} — ${content.cardName}`,
    // No `logoText`: the lockup in logo.png already names both brands, and the business
    // appears again as the header label on the right.

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
          label: content.organizationName,
          value: `${content.stampsCount}/${content.stampsRequired}`,
          // Each stamp changes this value, which is what makes the phone show a banner.
          // Silenced while a reward is pending: the primary field announces that one,
          // and the count resetting to zero is not news worth a second alert.
          ...(hasReward ? {} : { changeMessage: strings.stamped(remaining, content.rewardTitle) }),
        },
      ],
      primaryFields: [
        {
          key: 'reward',
          label: hasReward ? strings.rewardReady : strings.nextReward,
          value: hasReward ? strings.ready : content.rewardTitle,
          ...(hasReward ? { changeMessage: strings.earned(content.organizationName) } : {}),
        },
      ],
      secondaryFields: [
        hasReward
          ? { key: 'remaining', label: strings.reward, value: content.rewardTitle }
          : { key: 'remaining', label: strings.remaining, value: strings.stamps(remaining) },
        ...(content.cycleIndex > 0
          ? [{ key: 'cycle', label: strings.cycle, value: String(content.cycleIndex + 1) }]
          : content.lastStampAt
            ? [
                {
                  key: 'lastVisit',
                  label: strings.lastVisit,
                  value: content.lastStampAt.toISOString(),
                  dateStyle: 'PKDateStyleMedium',
                  ignoresTimeZone: false,
                },
              ]
            : []),
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
