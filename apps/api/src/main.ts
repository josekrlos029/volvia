import { buildApp } from './app'
import { env } from './env'

const app = await buildApp()

/**
 * Cloud Run sends SIGTERM and then waits: finish in-flight requests, close the pool,
 * and only then exit. A hard cap stops a stuck request from hanging the revision.
 */
const SHUTDOWN_TIMEOUT_MS = 15_000

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  const timer = setTimeout(() => {
    app.log.error('graceful shutdown timed out, forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  timer.unref()

  try {
    await app.close()
    app.log.info('shutdown complete')
    process.exit(0)
  } catch (error) {
    app.log.error({ err: error }, 'error during shutdown')
    process.exit(1)
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => void shutdown(signal))
}

process.on('unhandledRejection', (reason) => {
  app.log.error({ err: reason }, 'unhandled rejection')
})

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (error) {
  app.log.error({ err: error }, 'failed to start')
  process.exit(1)
}
