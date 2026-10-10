import {
  and,
  applePassLogs,
  applePassRegistrations,
  customerCards,
  eq,
  gt,
  inArray,
  walletPasses,
} from '@volvia/db'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../lib/errors'
import { passAuthTokenMatches } from '../../lib/tokens'
import { rateLimits } from '../../plugins/security'
import { typed } from '../../types'
import { issueApplePass, issueGoogleSaveUrl, renderGooglePassImage } from './service'

/**
 * Apple's device-side calls send `Authorization: ApplePass <token>`. The token is
 * derived from the serial, so verification needs no database lookup.
 */
function assertPassAuth(request: FastifyRequest, serial: string): void {
  const header = request.headers.authorization ?? ''
  if (!header.startsWith('ApplePass ')) {
    throw new AppError('UNAUTHENTICATED', { message: 'missing pass authentication' })
  }
  if (!passAuthTokenMatches(serial, header.slice('ApplePass '.length))) {
    throw new AppError('UNAUTHENTICATED', { message: 'invalid pass authentication' })
  }
}

const serialParams = z.object({ serial: z.string().min(16).max(128) })

export async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  // ── Download ───────────────────────────────────────────────────────────────
  app.get(
    '/apple/pass/:token',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: { params: z.object({ token: z.string().min(16).max(128) }), tags: ['wallet'] },
    },
    async (request, reply) => {
      const { buffer, serial } = await issueApplePass(app.db, request.params.token)
      return (
        reply
          .header('content-type', 'application/vnd.apple.pkpass')
          .header(
            'content-disposition',
            `attachment; filename="volvia-${serial.slice(0, 8)}.pkpass"`,
          )
          // The pass changes on every stamp, so it must never be cached.
          .header('cache-control', 'no-store')
          .send(buffer)
      )
    },
  )

  app.get(
    '/google/save/:token',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: { params: z.object({ token: z.string().min(16).max(128) }), tags: ['wallet'] },
    },
    async (request, reply) => {
      const url = await issueGoogleSaveUrl(app.db, request.params.token, request.log)
      return reply.redirect(url, 302)
    },
  )

  /**
   * The pictures a Google pass shows: Google's servers fetch them from here when the
   * class or object is written. The `v` query is a fingerprint of what the picture
   * depends on, so a cached copy is never shown for a newer stamp count.
   */
  app.get(
    '/google/images/:serial/:kind.png',
    {
      config: { rateLimit: rateLimits.publicRead },
      schema: {
        params: z.object({
          serial: z.string().min(16).max(128),
          kind: z.enum(['hero', 'lockup', 'logo']),
        }),
        querystring: z.object({ v: z.string().max(40).optional() }),
        tags: ['wallet'],
      },
    },
    async (request, reply) => {
      const png = await renderGooglePassImage(app.db, request.params.serial, request.params.kind)
      return (
        reply
          .header('content-type', 'image/png')
          // Safe to cache for a day: a change in the picture is a change in the URL.
          .header('cache-control', 'public, max-age=86400')
          .send(png)
      )
    },
  )

  /**
   * ── Apple PassKit web service ────────────────────────────────────────────
   * These four routes are dictated by Apple and must match their spec exactly:
   * register a device, list serials changed since a tag, fetch an updated pass, and
   * unregister. Getting any of them wrong means passes silently stop updating.
   */

  // Register a device to receive update pushes for a pass.
  app.post(
    '/apple/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serial',
    {
      schema: {
        params: z.object({
          deviceLibraryIdentifier: z.string().min(1).max(200),
          passTypeIdentifier: z.string().min(1).max(200),
          serial: z.string().min(16).max(128),
        }),
        body: z.object({ pushToken: z.string().min(1).max(400) }),
        tags: ['wallet'],
      },
    },
    async (request, reply) => {
      assertPassAuth(request, request.params.serial)

      const [pass] = await app.db
        .select()
        .from(walletPasses)
        .where(
          and(eq(walletPasses.serial, request.params.serial), eq(walletPasses.platform, 'apple')),
        )
        .limit(1)
      if (!pass) return reply.status(404).send()

      const existing = await app.db
        .select({ id: applePassRegistrations.id })
        .from(applePassRegistrations)
        .where(
          and(
            eq(applePassRegistrations.passId, pass.id),
            eq(
              applePassRegistrations.deviceLibraryIdentifier,
              request.params.deviceLibraryIdentifier,
            ),
          ),
        )
        .limit(1)

      await app.db
        .insert(applePassRegistrations)
        .values({
          passId: pass.id,
          deviceLibraryIdentifier: request.params.deviceLibraryIdentifier,
          pushToken: request.body.pushToken,
        })
        .onConflictDoUpdate({
          target: [applePassRegistrations.passId, applePassRegistrations.deviceLibraryIdentifier],
          set: { pushToken: request.body.pushToken },
        })

      // 201 on first registration, 200 when it already existed — Apple relies on this.
      return reply.status(existing.length > 0 ? 200 : 201).send()
    },
  )

  // Serials of passes changed since the tag the device last saw.
  app.get(
    '/apple/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
    {
      schema: {
        params: z.object({
          deviceLibraryIdentifier: z.string().min(1).max(200),
          passTypeIdentifier: z.string().min(1).max(200),
        }),
        querystring: z.object({ passesUpdatedSince: z.string().optional() }),
        tags: ['wallet'],
      },
    },
    async (request, reply) => {
      const since = request.query.passesUpdatedSince
        ? new Date(Number(request.query.passesUpdatedSince) * 1000)
        : new Date(0)

      const rows = await app.db
        .select({ serial: walletPasses.serial, updatedAt: walletPasses.updatedAt })
        .from(applePassRegistrations)
        .innerJoin(walletPasses, eq(walletPasses.id, applePassRegistrations.passId))
        .where(
          and(
            eq(
              applePassRegistrations.deviceLibraryIdentifier,
              request.params.deviceLibraryIdentifier,
            ),
            gt(walletPasses.updatedAt, since),
          ),
        )

      // 204 tells the device there is nothing new, which is the common case.
      if (rows.length === 0) return reply.status(204).send()

      const latest = rows.reduce(
        (max, row) => (row.updatedAt > max ? row.updatedAt : max),
        new Date(0),
      )

      return reply.send({
        serialNumbers: rows.map((row) => row.serial),
        lastUpdated: String(Math.floor(latest.getTime() / 1000)),
      })
    },
  )

  // Deliver the updated pass file.
  app.get(
    '/apple/v1/passes/:passTypeIdentifier/:serial',
    {
      schema: {
        params: z.object({
          passTypeIdentifier: z.string().min(1).max(200),
          serial: z.string().min(16).max(128),
        }),
        tags: ['wallet'],
      },
    },
    async (request, reply) => {
      assertPassAuth(request, request.params.serial)

      // The pass serial is the customer card's public token.
      const [card] = await app.db
        .select({ token: customerCards.token })
        .from(customerCards)
        .where(eq(customerCards.token, request.params.serial))
        .limit(1)
      if (!card) return reply.status(404).send()

      const { buffer } = await issueApplePass(app.db, card.token)
      return reply
        .header('content-type', 'application/vnd.apple.pkpass')
        .header('last-modified', new Date().toUTCString())
        .header('cache-control', 'no-store')
        .send(buffer)
    },
  )

  // Device removed the pass.
  app.delete(
    '/apple/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serial',
    {
      schema: {
        params: z.object({
          deviceLibraryIdentifier: z.string().min(1).max(200),
          passTypeIdentifier: z.string().min(1).max(200),
          serial: z.string().min(16).max(128),
        }),
        tags: ['wallet'],
      },
    },
    async (request, reply) => {
      assertPassAuth(request, request.params.serial)

      const passIds = await app.db
        .select({ id: walletPasses.id })
        .from(walletPasses)
        .where(
          and(eq(walletPasses.serial, request.params.serial), eq(walletPasses.platform, 'apple')),
        )

      if (passIds.length > 0) {
        await app.db.delete(applePassRegistrations).where(
          and(
            inArray(
              applePassRegistrations.passId,
              passIds.map((row) => row.id),
            ),
            eq(
              applePassRegistrations.deviceLibraryIdentifier,
              request.params.deviceLibraryIdentifier,
            ),
          ),
        )
      }
      return reply.status(200).send()
    },
  )

  /**
   * Devices post here when a pass fails to install or update. Worth keeping: it is
   * the only visibility we get into a failure that happens entirely on the phone.
   */
  app.post(
    '/apple/v1/log',
    {
      schema: { body: z.object({ logs: z.array(z.string().max(2000)).max(50) }), tags: ['wallet'] },
    },
    async (request, reply) => {
      request.log.warn({ entries: request.body.logs.length }, 'apple wallet device log')
      await app.db.insert(applePassLogs).values({ entries: request.body.logs })
      return reply.status(200).send()
    },
  )
}
