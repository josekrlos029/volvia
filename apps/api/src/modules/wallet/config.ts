import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GoogleWalletConfig, SigningMaterial } from '@volvia/wallet'
import { env } from '../../env'

/**
 * Wallet credentials, resolved once at boot.
 *
 * `WALLET_MODE` decides what we can promise:
 *  - `stub`     self-signed dev certificates. Passes are structurally real and fully
 *               testable, but an actual iPhone will refuse to install them.
 *  - `real`     Apple-issued Pass Type ID certificate and a Google service account.
 *  - `disabled` wallet endpoints return 503; the web card still works.
 *
 * Moving from stub to real is an environment change, not a code change.
 */
export interface WalletConfig {
  mode: 'stub' | 'real' | 'disabled'
  apple: {
    available: boolean
    passTypeIdentifier: string
    teamIdentifier: string
    signing: SigningMaterial | null
  }
  google: {
    available: boolean
    config: GoogleWalletConfig | null
  }
}

function repoPath(relative: string): string {
  // Paths in .env are written relative to the repository root.
  return resolve(process.cwd(), relative.startsWith('/') ? relative : `../../${relative}`)
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(repoPath(path), 'utf8')
  } catch {
    return null
  }
}

function loadApple(): WalletConfig['apple'] {
  const certificatePem = readIfPresent(env.APPLE_PASS_CERT_PATH)
  const privateKeyPem = readIfPresent(env.APPLE_PASS_KEY_PATH)
  const wwdrPem = readIfPresent(env.APPLE_WWDR_CERT_PATH) ?? undefined

  return {
    available: Boolean(certificatePem && privateKeyPem),
    passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
    teamIdentifier: env.APPLE_TEAM_ID,
    signing:
      certificatePem && privateKeyPem
        ? {
            certificatePem,
            privateKeyPem,
            passphrase: env.APPLE_PASS_KEY_PASSPHRASE || undefined,
            wwdrPem,
          }
        : null,
  }
}

function loadGoogle(): WalletConfig['google'] {
  const raw = env.GOOGLE_WALLET_SA_KEY_PATH ? readIfPresent(env.GOOGLE_WALLET_SA_KEY_PATH) : null
  if (!raw || !env.GOOGLE_WALLET_ISSUER_ID) return { available: false, config: null }

  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string }
    if (!parsed.private_key) return { available: false, config: null }

    return {
      available: true,
      config: {
        issuerId: env.GOOGLE_WALLET_ISSUER_ID,
        serviceAccountEmail: parsed.client_email ?? env.GOOGLE_WALLET_SA_EMAIL,
        privateKey: parsed.private_key,
        classPrefix: env.GOOGLE_WALLET_CLASS_PREFIX,
        origins: [env.PASS_URL, env.APP_URL],
      },
    }
  } catch {
    return { available: false, config: null }
  }
}

export function loadWalletConfig(): WalletConfig {
  if (env.WALLET_MODE === 'disabled') {
    return {
      mode: 'disabled',
      apple: { available: false, passTypeIdentifier: '', teamIdentifier: '', signing: null },
      google: { available: false, config: null },
    }
  }
  return { mode: env.WALLET_MODE, apple: loadApple(), google: loadGoogle() }
}

export const walletConfig = loadWalletConfig()
