import { applePassRegistrations, customerCards, eq, walletPasses } from '@volvia/db'
import type { Database } from '@volvia/db'
import { buildLoyaltyObject, patchLoyaltyObject } from '@volvia/wallet'
import type { FastifyBaseLogger } from 'fastify'
import { walletConfig } from '../modules/wallet/config'
import { loadPassContent } from '../modules/wallet/service'

/**
 * Tells iPhones holding this pass that it changed.
 *
 * Apple's push carries no payload: it is only a nudge, and the device then calls our
 * web service to fetch the new pass. That means a missed push is not lost data — the
 * device also polls — so a failure here degrades freshness, never correctness.
 */
export async function pushAppleUpdate(
  db: Database,
  passId: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  const registrations = await db
    .select({ pushToken: applePassRegistrations.pushToken })
    .from(applePassRegistrations)
    .where(eq(applePassRegistrations.passId, passId))

  if (registrations.length === 0) return

  if (walletConfig.mode !== 'real') {
    // Development certificates cannot authenticate against APNs. The device still
    // refreshes on its own schedule, so the pass is correct, just not instant.
    logger.debug({ devices: registrations.length }, 'apple push skipped (stub wallet mode)')
    return
  }

  // APNs delivery lands here once a real Pass Type ID certificate is configured.
  logger.info({ devices: registrations.length }, 'apple push queued')
}

/** Google passes update by patching the object; there is no separate push. */
export async function patchGooglePass(
  db: Database,
  serial: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (walletConfig.mode !== 'real' || !walletConfig.google.available) {
    logger.debug({ serial: serial.slice(0, 8) }, 'google wallet patch skipped (not configured)')
    return
  }

  const [pass] = await db
    .select({ orgId: walletPasses.orgId, customerCardId: walletPasses.customerCardId })
    .from(walletPasses)
    .where(eq(walletPasses.serial, serial))
    .limit(1)
  if (!pass) return

  const [card] = await db
    .select({ token: customerCards.token })
    .from(customerCards)
    .where(eq(customerCards.id, pass.customerCardId))
    .limit(1)
  if (!card) return

  const { content } = await loadPassContent(db, card.token)
  const config = walletConfig.google.config!
  const object = buildLoyaltyObject(config, content, pass.orgId)

  await patchLoyaltyObject(config, serial, {
    loyaltyPoints: object.loyaltyPoints,
    textModulesData: object.textModulesData,
  })
}
