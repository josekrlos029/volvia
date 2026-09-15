import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * Route modules receive a plain `FastifyInstance` from `register`, which loses the zod
 * type provider. Narrowing through `typed()` restores inference, so `request.body`,
 * `request.query` and `request.params` come back typed from the route's own schema.
 */
export function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>()
}

export type TypedApp = ReturnType<typeof typed>
