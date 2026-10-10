import { applePassRegistrations, customerCards, eq, inArray, walletPasses } from '@volvia/db'
import type { Database } from '@volvia/db'
import { renderCampaignText } from '@volvia/shared'
import {
  addLoyaltyObjectMessage,
  buildLoyaltyObject,
  isDeadPushToken,
  patchLoyaltyObject,
  sendPassUpdatePushes,
} from '@volvia/wallet'
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
    .select({ id: applePassRegistrations.id, pushToken: applePassRegistrations.pushToken })
    .from(applePassRegistrations)
    .where(eq(applePassRegistrations.passId, passId))

  if (registrations.length === 0) return

  if (walletConfig.mode !== 'real') {
    // Development certificates cannot authenticate against APNs. The device still
    // refreshes on its own schedule, so the pass is correct, just not instant.
    logger.debug({ devices: registrations.length }, 'apple push skipped (stub wallet mode)')
    return
  }

  const signing = walletConfig.apple.signing
  if (!signing) {
    logger.warn({ devices: registrations.length }, 'apple push skipped (no pass certificate)')
    return
  }

  const results = await sendPassUpdatePushes({
    pushTokens: registrations.map((row) => row.pushToken),
    topic: walletConfig.apple.passTypeIdentifier,
    signing,
  })

  // A removed pass or a wiped phone leaves a token APNs will reject forever.
  const dead = new Set(results.filter(isDeadPushToken).map((result) => result.token))
  const deadIds = registrations.filter((row) => dead.has(row.pushToken)).map((row) => row.id)
  if (deadIds.length > 0) {
    await db.delete(applePassRegistrations).where(inArray(applePassRegistrations.id, deadIds))
  }

  const sent = results.filter((result) => result.status === 200).length
  const failures = results.filter((result) => result.status !== 200 && !dead.has(result.token))
  logger.info(
    {
      devices: registrations.length,
      sent,
      removed: deadIds.length,
      failures: failures.map(({ status, reason }) => ({ status, reason })),
    },
    'apple push sent',
  )

  // Nothing delivered and not because the devices are gone: a certificate or topic
  // problem, which must surface as a failed push rather than a quiet log line.
  if (sent === 0 && failures.length > 0) {
    throw new Error(`apns rejected every push: ${failures[0]!.status} ${failures[0]!.reason}`)
  }
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
    merchantLocations: object.merchantLocations,
  })
}

/**
 * A message or a campaign, as a Google Wallet notification. The text is rendered for
 * this customer here, the same way the Apple pass renders it when it is rebuilt.
 */
export async function pushGoogleMessage(
  db: Database,
  serial: string,
  notice: { id: string; headline: string; body: string },
  logger: FastifyBaseLogger,
): Promise<void> {
  if (walletConfig.mode !== 'real' || !walletConfig.google.available) {
    logger.debug({ serial: serial.slice(0, 8) }, 'google wallet message skipped (not configured)')
    return
  }

  const [pass] = await db
    .select({ customerCardId: walletPasses.customerCardId })
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

  // Keep the pass itself current too: the message arrives on top of fresh data.
  await patchGooglePass(db, serial, logger)

  const { textContext } = await loadPassContent(db, card.token)
  await addLoyaltyObjectMessage(walletConfig.google.config!, serial, {
    // Unique per object: the same notice reaching one pass twice is rejected, not shown twice.
    id: `${notice.id}-${serial.slice(0, 8)}`,
    header: renderCampaignText(notice.headline, textContext),
    body: renderCampaignText(notice.body, textContext),
  })
}
