import { type Database, createDatabase } from '@volvia/db'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { env } from '../env'
import { type Mailer, createMailer } from '../lib/email'
import { type RedisClient, createRedis } from '../lib/redis'
import { type StorageAdapter, createStorage } from '../lib/storage'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
    redis: RedisClient
    mailer: Mailer
    storage: StorageAdapter
    pingDb: () => Promise<void>
  }
}

/**
 * Wires the long-lived dependencies onto the Fastify instance and, critically, tears
 * them down in order on shutdown so in-flight requests finish before the pool closes.
 */
export const contextPlugin = fp(async (app: FastifyInstance) => {
  const database = createDatabase({
    url: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    debug: env.LOG_LEVEL === 'trace',
  })
  const redis = createRedis()
  const mailer = createMailer(app.log)
  const storage = createStorage()

  app.decorate('db', database.db)
  app.decorate('redis', redis)
  app.decorate('mailer', mailer)
  app.decorate('storage', storage)
  app.decorate('pingDb', () => database.ping())

  app.addHook('onClose', async () => {
    await database.close()
    redis.disconnect()
  })
})
