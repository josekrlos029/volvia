import { formatOpeningHours } from '@volvia/shared'
import type { PassContent, PassLink } from '../types'

/**
 * Builds `pass.json` for a PassKit store card.
 *
 * The layout mirrors how the card is read at the counter and in the stacked Wallet
 * list. The header is the only row visible while passes are collapsed, so it carries
 * the business (as a label) and the progress; the lockup in `logo.png` sits to its
 * left. The stamps are drawn in `strip.png`, and nothing is laid over them: on a store
 * card Wallet paints the primary fields on top of the strip, so there are none. The
 * reward the customer is working towards sits in the row under the strip instead.
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
    cardOf: 'Tarjeta de',
    address: 'Dirección',
    hours: 'Horario',
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
    cardOf: 'Card of',
    address: 'Address',
    hours: 'Hours',
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

type Field = Record<string, unknown> & { key: string; label: string; value: string }

/** PassKit only honours `<a href>` inside `attributedValue`; everything else must be text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function anchor(url: string, text: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`
}

/** `https://www.instagram.com/burgertrain/` reads as `instagram.com/burgertrain`. */
function displayUrl(url: string): string {
  return url
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
}

/**
 * A back field the customer can tap. Links carry an anchor with readable text and the
 * bare URL as the fallback value; a phone number is left to iOS's own detector, which
 * is what makes it dial, rather than relying on `tel:` inside an anchor.
 */
function linkField(link: PassLink): Field {
  const key = `link-${link.id}`
  switch (link.kind) {
    case 'phone':
      return {
        key,
        label: link.label,
        value: link.url.replace(/^tel:/, ''),
        dataDetectorTypes: ['PKDataDetectorTypePhoneNumber'],
      }
    case 'email':
      return {
        key,
        label: link.label,
        value: link.url.replace(/^mailto:/, ''),
        attributedValue: anchor(link.url, link.url.replace(/^mailto:/, '')),
      }
    case 'maps':
      return {
        key,
        label: link.label,
        value: link.url,
        attributedValue: anchor(link.url, link.label),
        dataDetectorTypes: ['PKDataDetectorTypeLink'],
      }
    default:
      return {
        key,
        label: link.label,
        value: link.url,
        attributedValue: anchor(link.url, displayUrl(link.url)),
        dataDetectorTypes: ['PKDataDetectorTypeLink'],
      }
  }
}

/**
 * The back of the pass, top to bottom: whose card it is, what the reward is, the latest
 * message, then the business itself (description, address, hours, links), the Volvia
 * link and the terms. Fields the business left empty are not emitted at all.
 */
function backFields(content: PassContent): Field[] {
  const strings = STRINGS[content.locale]
  const place = content.place
  const addressLine = place ? [place.address, place.city].filter(Boolean).join(', ') : ''
  const hoursText = place ? formatOpeningHours(place.hours, content.locale) : ''

  return [
    ...(content.customerName
      ? [{ key: 'customer', label: strings.cardOf, value: content.customerName }]
      : []),
    // A campaign may put its own words where the reward description goes.
    {
      key: 'rewardDetails',
      label: content.cardName,
      value: content.offer?.text || content.rewardDescription,
      changeMessage: '%@',
    },
    // Always present, even before the first message: the phone only alerts when a
    // field it already knew changes value, so the key has to exist from install.
    {
      key: 'message',
      label: content.latestMessage?.headline ?? strings.news,
      value: content.latestMessage?.body ?? strings.noNews,
      changeMessage: '%@',
    },
    ...(content.about
      ? [{ key: 'about', label: content.organizationName, value: content.about }]
      : []),
    ...(place?.address
      ? [
          {
            key: 'address',
            label: strings.address,
            value: addressLine,
            dataDetectorTypes: ['PKDataDetectorTypeAddress'],
          },
        ]
      : []),
    ...(hoursText ? [{ key: 'hours', label: strings.hours, value: hoursText }] : []),
    ...content.links.map(linkField),
    {
      key: 'link',
      label: 'Volvia',
      value: content.cardUrl,
      attributedValue: anchor(content.cardUrl, 'Volvia'),
    },
    ...(content.terms ? [{ key: 'terms', label: strings.terms, value: content.terms }] : []),
  ]
}

export function buildPassJson(
  content: PassContent,
  options: PassJsonOptions,
): Record<string, unknown> {
  const strings = STRINGS[content.locale]
  const hasReward = content.pendingRewardCount > 0
  const remaining = stampsRemaining(content)
  const relevantText = nearbyText(content)
  // A campaign may rename the header ("SELLOS DOBLES"), but a reward waiting to be
  // claimed is the more important news, so the business name stays while one is.
  const headerLabel =
    !hasReward && content.offer?.headerLabel ? content.offer.headerLabel : content.organizationName

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
          label: headerLabel,
          value: `${content.stampsCount}/${content.stampsRequired}`,
          // Each stamp changes this value, which is what makes the phone show a banner.
          // Silenced while a reward is pending: the reward field announces that one,
          // and the count resetting to zero is not news worth a second alert.
          ...(hasReward ? {} : { changeMessage: strings.stamped(remaining, content.rewardTitle) }),
        },
      ],
      // No primaryFields on purpose: Wallet would draw them over the stamps in the strip.
      // Secondary and auxiliary fields share the row under the strip on a store card.
      secondaryFields: hasReward
        ? [
            {
              key: 'reward',
              label: strings.rewardReady,
              value: strings.ready,
              changeMessage: strings.earned(content.organizationName),
            },
            { key: 'prize', label: strings.reward, value: content.rewardTitle },
          ]
        : [
            { key: 'reward', label: strings.nextReward, value: content.rewardTitle },
            { key: 'remaining', label: strings.remaining, value: strings.stamps(remaining) },
          ],
      auxiliaryFields: [
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
        ...(content.offer
          ? [{ key: 'offer', label: '★', value: content.offer.message, changeMessage: '%@' }]
          : []),
      ],
      backFields: backFields(content),
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
