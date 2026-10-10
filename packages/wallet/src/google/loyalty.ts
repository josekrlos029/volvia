import { GoogleAuth } from 'google-auth-library'
import { SignJWT, importPKCS8 } from 'jose'
import type { PassContent } from '../types'

/**
 * Google Wallet works differently to Apple: instead of shipping a signed file, we
 * create (or update) a LoyaltyObject through the API and hand the customer a signed
 * "Save to Google Wallet" JWT that references it.
 */
export interface GoogleWalletConfig {
  issuerId: string
  serviceAccountEmail: string
  /** PKCS#8 private key from the service-account JSON. */
  privateKey: string
  classPrefix: string
  origins: string[]
}

const API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1'
const SAVE_URL = 'https://pay.google.com/gp/v/save'

export function classId(config: GoogleWalletConfig, orgId: string): string {
  // One class per business: it carries the branding every one of their cards shares.
  return `${config.issuerId}.${config.classPrefix}_${orgId.replace(/-/g, '')}`
}

export function objectId(config: GoogleWalletConfig, serial: string): string {
  return `${config.issuerId}.${serial.replace(/[^A-Za-z0-9_-]/g, '')}`
}

/** Images Google fetches by URL. Each URL must change when the picture does. */
export interface LoyaltyClassImages {
  /** The Volvia · business lockup, 1032×336. Replaces the round logo in the header. */
  wideProgramLogoUrl: string | null
  /** The business alone, square; Google crops it round. Shown where the wide one is not. */
  programLogoUrl: string | null
}

export function buildLoyaltyClass(
  config: GoogleWalletConfig,
  input: {
    orgId: string
    organizationName: string
    backgroundColor: string
    images?: Partial<LoyaltyClassImages>
    /** @deprecated use `images.programLogoUrl` */
    programLogoUrl?: string | null
  },
): Record<string, unknown> {
  const description = { defaultValue: { language: 'es', value: input.organizationName } }
  const programLogoUrl = input.images?.programLogoUrl ?? input.programLogoUrl ?? null
  const wideProgramLogoUrl = input.images?.wideProgramLogoUrl ?? null

  return {
    id: classId(config, input.orgId),
    issuerName: input.organizationName,
    programName: input.organizationName,
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: input.backgroundColor,
    ...(programLogoUrl
      ? { programLogo: { sourceUri: { uri: programLogoUrl }, contentDescription: description } }
      : {}),
    ...(wideProgramLogoUrl
      ? {
          wideProgramLogo: {
            sourceUri: { uri: wideProgramLogoUrl },
            contentDescription: {
              defaultValue: { language: 'es', value: `Volvia · ${input.organizationName}` },
            },
          },
        }
      : {}),
  }
}

export function buildLoyaltyObject(
  config: GoogleWalletConfig,
  content: PassContent,
  orgId: string,
  images: { heroImageUrl?: string | null } = {},
): Record<string, unknown> {
  const labels =
    content.locale === 'es'
      ? {
          points: 'Sellos',
          nextReward: 'Próxima recompensa',
          rewardReady: 'Recompensa lista',
          reward: 'Tu recompensa',
          ready: '¡Listo para reclamar!',
          remaining: 'Te faltan',
          stamps: (count: number) => (count === 1 ? '1 sello' : `${count} sellos`),
          cycle: 'Vuelta',
        }
      : {
          points: 'Stamps',
          nextReward: 'Next reward',
          rewardReady: 'Reward ready',
          reward: 'Your reward',
          ready: 'Ready to claim!',
          remaining: 'You need',
          stamps: (count: number) => (count === 1 ? '1 more stamp' : `${count} more stamps`),
          cycle: 'Round',
        }
  const hasReward = content.pendingRewardCount > 0
  const target = content.nextRewardAt ?? content.stampsRequired
  const remaining = Math.max(0, target - content.stampsCount)
  const lap = content.cycleIndex > 0 ? ` · ${labels.cycle} ${content.cycleIndex + 1}` : ''

  return {
    id: objectId(config, content.serial),
    classId: classId(config, orgId),
    state: 'ACTIVE',
    accountName: content.organizationName,
    accountId: content.serial,
    loyaltyPoints: {
      label: labels.points,
      balance: { string: `${content.stampsCount} / ${content.stampsRequired}` },
    },
    // The second balance slot is the reward: the thing the stamps are for.
    secondaryLoyaltyPoints: {
      label: hasReward ? labels.rewardReady : labels.nextReward,
      balance: { string: hasReward ? labels.ready : content.rewardTitle },
    },
    barcode: {
      type: 'QR_CODE',
      value: content.cardUrl,
      alternateText: content.serial.slice(0, 8).toUpperCase(),
    },
    textModulesData: [
      hasReward
        ? { id: 'reward', header: labels.reward, body: content.rewardTitle }
        : {
            id: 'reward',
            header: labels.remaining,
            body: `${labels.stamps(remaining)} · ${content.rewardTitle}${lap}`,
          },
      ...(content.offerMessage ? [{ id: 'offer', header: '★', body: content.offerMessage }] : []),
    ],
    linksModuleData: {
      uris: [{ uri: content.cardUrl, description: 'Volvia', id: 'card' }],
    },
    // Google sends its own "pass nearby" notification around these points. The older
    // `locations` key still validates but no longer triggers anything.
    merchantLocations: content.places.map((place) => ({
      latitude: place.latitude,
      longitude: place.longitude,
    })),
    hexBackgroundColor: content.backgroundColor,
    // The stamp grid, the same picture Apple gets as strip.png. Set on the object, not
    // the class, because it is this customer's progress.
    ...(images.heroImageUrl
      ? {
          heroImage: {
            sourceUri: { uri: images.heroImageUrl },
            contentDescription: {
              defaultValue: {
                language: content.locale,
                value: `${content.stampsCount} / ${content.stampsRequired}`,
              },
            },
          },
        }
      : {}),
  }
}

/**
 * The "Save to Google Wallet" link. The JWT embeds the object, so the pass can be
 * saved even before it exists server-side — Google creates it on first save.
 */
export async function buildSaveUrl(
  config: GoogleWalletConfig,
  payload: {
    loyaltyObjects: Array<Record<string, unknown>>
    loyaltyClasses?: Array<Record<string, unknown>>
  },
): Promise<string> {
  const key = await importPKCS8(config.privateKey, 'RS256')

  const token = await new SignJWT({
    iss: config.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    origins: config.origins,
    payload,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .sign(key)

  return `${SAVE_URL}/${token}`
}

async function walletClient(config: GoogleWalletConfig) {
  const auth = new GoogleAuth({
    credentials: { client_email: config.serviceAccountEmail, private_key: config.privateKey },
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  })
  return auth.getClient()
}

/** Pushes the new stamp count to Google so an already-saved pass updates itself. */
export async function patchLoyaltyObject(
  config: GoogleWalletConfig,
  serial: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const client = await walletClient(config)

  await client.request({
    url: `${API_BASE}/loyaltyObject/${objectId(config, serial)}`,
    method: 'PATCH',
    data: patch,
  })
}

/**
 * Attaches a message to the saved pass and asks Google to notify the phone.
 *
 * This is the only way a Google Wallet pass produces a notification: patching the
 * object updates it quietly. Google caps how many of these an object gets per day, so
 * a rejection here is expected now and then and should be recorded, not retried.
 */
export async function addLoyaltyObjectMessage(
  config: GoogleWalletConfig,
  serial: string,
  message: { id: string; header: string; body: string },
): Promise<void> {
  const client = await walletClient(config)

  await client.request({
    url: `${API_BASE}/loyaltyObject/${objectId(config, serial)}/addMessage`,
    method: 'POST',
    data: {
      message: {
        id: message.id,
        header: message.header,
        body: message.body,
        messageType: 'TEXT_AND_NOTIFY',
      },
    },
  })
}

export async function upsertLoyaltyClass(
  config: GoogleWalletConfig,
  loyaltyClass: Record<string, unknown>,
): Promise<void> {
  const client = await walletClient(config)
  const id = loyaltyClass.id as string

  try {
    await client.request({ url: `${API_BASE}/loyaltyClass/${id}`, method: 'GET' })
    await client.request({
      url: `${API_BASE}/loyaltyClass/${id}`,
      method: 'PUT',
      data: loyaltyClass,
    })
  } catch {
    // Not found: create it. Any other failure surfaces on the create attempt.
    await client.request({ url: `${API_BASE}/loyaltyClass`, method: 'POST', data: loyaltyClass })
  }
}
