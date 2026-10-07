import { type Database, eq, users } from '@volvia/db'
import type { SessionUser } from '@volvia/shared'
import { signAccessToken, signRefreshToken } from '../../lib/jwt'
import type { RedisClient } from '../../lib/redis'
import { buildSessionUser } from './service'
import { createSession } from './sessions'

export interface IssuedSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: SessionUser
}

/**
 * Mints a session for a user who has just proved who they are.
 *
 * Shared by every entry point — password, magic link, Google, accepting an invitation —
 * so all of them produce the exact same token pair and nobody can drift into issuing a
 * session with, say, a missing session id.
 */
export async function issueSession(
  deps: { db: Database; redis: RedisClient },
  userId: string,
  email: string,
  meta: { ip: string; userAgent: string },
): Promise<IssuedSession> {
  const { sessionId } = await createSession(deps.redis, { userId, ...meta })
  const user = await buildSessionUser(deps.db, userId)

  // The live token version, never a literal: `requireAuth` rejects any token whose `tv`
  // does not match the column, so minting a fixed 1 would lock out every user who has
  // ever changed their password.
  const [row] = await deps.db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const tv = row?.tokenVersion ?? 1

  const accessToken = await signAccessToken({ sub: userId, email, tv, sid: sessionId })
  const refreshToken = await signRefreshToken({ sub: userId, sid: sessionId, gen: 0, tv })
  return { accessToken, refreshToken, expiresIn: 900, user }
}
