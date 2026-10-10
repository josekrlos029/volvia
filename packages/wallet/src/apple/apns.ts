import { constants, connect } from 'node:http2'
import type { SigningMaterial } from './signer'

/**
 * Pass update pushes over APNs.
 *
 * Wallet pushes are the simplest APNs has: an empty `{}` body, the pass type
 * identifier as topic, and TLS client authentication with the very same Pass Type ID
 * certificate that signs the `.pkpass`. The push only wakes the device; it then asks
 * our web service which serials changed and downloads them.
 */
export interface PassPushInput {
  pushTokens: string[]
  /** The pass type identifier, e.g. `pass.co.volvia.loyalty`. */
  topic: string
  signing: SigningMaterial
  /** Overridable for tests; production always talks to Apple. */
  host?: string
  /** Extra trusted CAs, only needed when `host` is a local test server. */
  ca?: string
}

export interface PassPushResult {
  token: string
  status: number
  /** APNs `reason` on failure, e.g. `BadDeviceToken` or `Unregistered`. */
  reason: string | null
}

const APNS_HOST = 'https://api.push.apple.com'
const REQUEST_TIMEOUT_MS = 10_000

/** True when APNs says the token will never work again and should be forgotten. */
export function isDeadPushToken(result: PassPushResult): boolean {
  return result.status === 410 || (result.status === 400 && result.reason === 'BadDeviceToken')
}

export async function sendPassUpdatePushes(input: PassPushInput): Promise<PassPushResult[]> {
  if (input.pushTokens.length === 0) return []

  const session = connect(input.host ?? APNS_HOST, {
    cert: input.signing.certificatePem,
    key: input.signing.privateKeyPem,
    passphrase: input.signing.passphrase,
    ca: input.ca,
  })

  // A TLS failure (expired or wrong certificate) surfaces here rather than per request.
  let sessionError: Error | null = null
  session.on('error', (error) => {
    sessionError = error
  })

  try {
    return await Promise.all(
      input.pushTokens.map((token) => pushOne(session, token, input.topic, () => sessionError)),
    )
  } finally {
    session.close()
  }
}

function pushOne(
  session: ReturnType<typeof connect>,
  token: string,
  topic: string,
  sessionError: () => Error | null,
): Promise<PassPushResult> {
  return new Promise((resolve, reject) => {
    const request = session.request({
      [constants.HTTP2_HEADER_METHOD]: 'POST',
      [constants.HTTP2_HEADER_PATH]: `/3/device/${encodeURIComponent(token)}`,
      'apns-topic': topic,
      'content-type': 'application/json',
    })

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.close(constants.NGHTTP2_CANCEL)
      reject(new Error('apns: request timed out'))
    })

    let status = 0
    let body = ''
    request.on('response', (headers) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS])
    })
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
    })
    request.on('end', () => {
      let reason: string | null = null
      if (body) {
        try {
          reason = (JSON.parse(body) as { reason?: string }).reason ?? null
        } catch {
          reason = body.slice(0, 200)
        }
      }
      resolve({ token, status, reason })
    })
    request.on('error', (error) => reject(sessionError() ?? error))

    request.end('{}')
  })
}
