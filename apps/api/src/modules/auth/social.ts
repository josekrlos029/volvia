import type { Database } from '@volvia/db'
import { AppError } from '../../lib/errors'
import type { SocialProfile } from './id-token'
import { findUserByEmail, findUserByIdentity, issueAuthToken, linkIdentity } from './service'

/** What the signup token carries from the provider to the "name your business" form. */
export interface SocialSignupPayload {
  provider: SocialProfile['provider']
  sub: string
  name: string | null
  picture: string | null
}

export type SocialOutcome =
  | { kind: 'user'; user: NonNullable<Awaited<ReturnType<typeof findUserByEmail>>> }
  | { kind: 'signup'; token: string; email: string; name: string | null }

/**
 * Turns a verified provider identity into a Volvia account, in this order:
 *
 *   1. an account already linked to this provider id;
 *   2. an account with the same (verified) address, which gets linked now, so a
 *      business owner who signed up with a password can start using the button;
 *   3. nobody — the web flow sends them to signup with a short-lived token, the
 *      native apps refuse, because a business is created from the dashboard.
 *
 * Shared by the Google and Apple web callbacks and both native endpoints so the
 * linking rules cannot drift between the four of them.
 */
export async function resolveSocialProfile(
  db: Database,
  profile: SocialProfile,
  options: { allowSignup: boolean; ip: string; nameHint?: string | null },
): Promise<SocialOutcome> {
  if (profile.isPrivateEmail) {
    throw new AppError('SOCIAL_EMAIL_HIDDEN', {
      message: 'share your real email with Volvia instead of a relay address',
    })
  }
  if (!profile.emailVerified) {
    throw new AppError('FORBIDDEN', { message: `${profile.provider} email is not verified` })
  }

  const name = profile.name ?? options.nameHint?.trim() ?? null
  const link = {
    provider: profile.provider,
    providerUserId: profile.sub,
    profile: { name, picture: profile.picture },
  }

  const linked = await findUserByIdentity(db, profile.provider, profile.sub)
  if (linked) return { kind: 'user', user: linked }

  const existing = await findUserByEmail(db, profile.email)
  if (existing) {
    await linkIdentity(db, { userId: existing.id, ...link })
    return { kind: 'user', user: existing }
  }

  if (!options.allowSignup) {
    throw new AppError('ACCOUNT_NOT_FOUND', {
      message: 'no Volvia account uses this email; create the business on the dashboard first',
    })
  }

  const payload: SocialSignupPayload = {
    provider: profile.provider,
    sub: profile.sub,
    name,
    picture: profile.picture,
  }
  const { token } = await issueAuthToken(db, {
    purpose: 'social_signup',
    email: profile.email,
    payload: { ...payload },
    ip: options.ip,
  })
  return { kind: 'signup', token, email: profile.email, name }
}
