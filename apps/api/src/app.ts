import { randomUUID } from 'node:crypto'
import sensible from '@fastify/sensible'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { env, isProduction, isTest } from './env'
import { authPlugin } from './plugins/auth'
import { contextPlugin } from './plugins/context'
import { docsPlugin } from './plugins/docs'
import { errorsPlugin } from './plugins/errors'
import { observabilityPlugin } from './plugins/observability'
import { securityPlugin } from './plugins/security'
import { registerRoutes } from './routes'

export type App = FastifyInstance<
  import('node:http').Server,
  import('node:http').IncomingMessage,
  import('node:http').ServerResponse,
  import('pino').Logger,
  ZodTypeProvider
>

export async function buildApp(): Promise<App> {
  const app = Fastify({
    logger: {
      level: isTest ? 'silent' : env.LOG_LEVEL,
      // Structured in production, readable locally.
      transport:
        isProduction || isTest
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
      redact: {
        // Nothing that identifies a person ever reaches the log sink.
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.newPassword',
          'req.body.currentPassword',
          'req.body.email',
          'req.body.token',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      serializers: {
        req: (request) => ({
          method: request.method,
          url: request.url.split('?')[0],
          ip: request.ip,
        }),
      },
    },
    genReqId: (request) => (request.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
    bodyLimit: 1_048_576,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id)
    return payload
  })

  await app.register(sensible)
  await app.register(contextPlugin)
  await app.register(observabilityPlugin)
  await app.register(securityPlugin)
  await app.register(errorsPlugin)
  await app.register(authPlugin)
  await app.register(docsPlugin)
  await app.register(registerRoutes)

  await app.ready()
  return app as unknown as App
}
