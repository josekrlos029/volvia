import { type ErrorCode, statusForErrorCode } from '@volvia/shared'

export interface AppErrorOptions {
  message?: string
  details?: Array<{ path: string; message: string }>
  /** Plan a business would need to upgrade to; surfaced so the UI can deep-link. */
  upgradeTo?: string
  cause?: unknown
  /** Extra context for logs only — never serialised to the client. */
  logContext?: Record<string, unknown>
}

/** The only error type route handlers should throw. Anything else becomes a 500. */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly details?: Array<{ path: string; message: string }>
  readonly upgradeTo?: string
  readonly logContext?: Record<string, unknown>

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? code, { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusForErrorCode(code)
    this.details = options.details
    this.upgradeTo = options.upgradeTo
    this.logContext = options.logContext
  }

  static notFound(what = 'resource') {
    return new AppError('NOT_FOUND', { message: `${what} not found` })
  }

  static forbidden(message = 'not allowed') {
    return new AppError('FORBIDDEN', { message })
  }

  static conflict(message: string) {
    return new AppError('CONFLICT', { message })
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
