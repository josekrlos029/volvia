import type { ApiErrorBody } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { isProduction } from '../env'
import { AppError } from '../lib/errors'

/** Fastify wraps zod issues in its own validation array; unwrap them for the client. */
interface FastifyValidationIssue {
  instancePath?: string
  message?: string
  params?: { issue?: { path?: Array<string | number>; message?: string } }
}

function fromFastifyValidation(validation: unknown): Array<{ path: string; message: string }> {
  if (!Array.isArray(validation)) return []
  return (validation as FastifyValidationIssue[]).map((entry) => ({
    path:
      entry.params?.issue?.path?.join('.') ??
      (entry.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.'),
    message: entry.params?.issue?.message ?? entry.message ?? 'invalid value',
  }))
}

function fromZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

/** Postgres error codes we can translate into something the client can act on. */
const PG_UNIQUE_VIOLATION = '23505'
const PG_FK_VIOLATION = '23503'

export const errorsPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id
    // `error` is narrowed away by the checks below, so keep an untyped handle to it.
    const raw = error as Error & { code?: string; statusCode?: number; validation?: unknown }

    if (error instanceof AppError) {
      // Expected, handled conditions: log at debug so real problems stay visible.
      request.log.debug({ code: error.code, ...error.logContext }, error.message)
      const body: ApiErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          upgradeTo: error.upgradeTo,
          requestId,
        },
      }
      return reply.status(error.statusCode).send(body)
    }

    if (error instanceof ZodError || raw.validation) {
      const issues =
        error instanceof ZodError ? fromZodError(error) : fromFastifyValidation(raw.validation)
      const body: ApiErrorBody = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'invalid request',
          details: issues,
          requestId,
        },
      }
      return reply.status(422).send(body)
    }

    const pgCode = raw.code
    if (pgCode === PG_UNIQUE_VIOLATION) {
      const body: ApiErrorBody = {
        error: { code: 'CONFLICT', message: 'resource already exists', requestId },
      }
      return reply.status(409).send(body)
    }
    if (pgCode === PG_FK_VIOLATION) {
      const body: ApiErrorBody = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'referenced resource does not exist',
          requestId,
        },
      }
      return reply.status(422).send(body)
    }

    if (raw.statusCode === 429) {
      const body: ApiErrorBody = {
        error: { code: 'RATE_LIMITED', message: 'too many requests', requestId },
      }
      return reply.status(429).send(body)
    }

    request.log.error({ err: raw }, 'unhandled error')
    const body: ApiErrorBody = {
      error: {
        code: 'INTERNAL',
        // Never leak internals to clients in production.
        message: isProduction ? 'internal error' : raw.message,
        requestId,
      },
    }
    return reply.status(500).send(body)
  })

  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = {
      error: { code: 'NOT_FOUND', message: 'route not found', requestId: request.id },
    }
    return reply.status(404).send(body)
  })
})
