import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'
import { env, isProduction } from '../env'

/** OpenAPI is generated from the same zod schemas the handlers validate with. */
export const docsPlugin = fp(async (app: FastifyInstance) => {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Volvia API',
        description: 'Digital loyalty cards: businesses, stamp cards, customers and wallet passes.',
        version: '0.1.0',
      },
      servers: [{ url: env.API_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          orgHeader: { type: 'apiKey', in: 'header', name: 'x-org-id' },
        },
      },
    },
    transform: jsonSchemaTransform,
  })

  if (!isProduction) {
    await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'list' } })
  }
})
