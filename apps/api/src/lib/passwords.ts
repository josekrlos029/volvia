import { hash, verify } from '@node-rs/argon2'

/**
 * Argon2id with OWASP's recommended baseline (19 MiB, t=2, p=1). Tuned for a Cloud Run
 * container: enough work to make offline cracking expensive without stalling a request.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(plain: string, digest: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS)
  } catch {
    return false
  }
}
