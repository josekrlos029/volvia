import { ApiError } from '@volvia/shared/client'
import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '../src/lib/auth-messages'

const apiError = (code: string, details?: Array<{ path: string; message: string }>) =>
  new ApiError(400, { code: code as never, message: 'raw api message', details })

/**
 * Error copy on the screens a business meets before it has an account.
 *
 * Someone who cannot sign up has no support channel yet, so the message on screen is
 * the whole of the help they get. None of these may fall through to "something went
 * wrong", and none may leak the API's own English.
 */
describe('auth error messages', () => {
  it('tells someone their email is already registered', () => {
    expect(authErrorMessage(apiError('EMAIL_TAKEN'))).toMatch(/ya tiene una cuenta/i)
  })

  it('does not say which half of the credentials was wrong', () => {
    const message = authErrorMessage(apiError('INVALID_CREDENTIALS'))
    expect(message).toMatch(/correo o contraseña/i)
  })

  it('translates the password policy instead of showing its key', () => {
    const tooShort = apiError('VALIDATION_FAILED', [
      { path: 'password', message: 'password_too_short' },
    ])
    expect(authErrorMessage(tooShort)).toMatch(/12 caracteres/)

    const tooCommon = apiError('VALIDATION_FAILED', [
      { path: 'password', message: 'password_too_common' },
    ])
    expect(authErrorMessage(tooCommon)).toMatch(/demasiado común/i)
  })

  it('explains a dead link rather than blaming the person', () => {
    expect(authErrorMessage(apiError('TOKEN_EXPIRED'))).toMatch(/enlace ya no sirve/i)
  })

  it('names the real problem when the network is down', () => {
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toMatch(/conectar/i)
  })

  it('never repeats the API’s own wording to the customer', () => {
    for (const code of ['EMAIL_TAKEN', 'TOKEN_EXPIRED', 'CONFLICT', 'RATE_LIMITED']) {
      expect(authErrorMessage(apiError(code))).not.toContain('raw api message')
    }
  })

  it('falls back to something human for a code it has never seen', () => {
    expect(authErrorMessage(apiError('SOME_NEW_CODE'))).toMatch(/intenta de nuevo/i)
    expect(authErrorMessage('not even an error')).toMatch(/intenta de nuevo/i)
  })
})
