import { ApiError } from '@volvia/shared/client'

/**
 * The same words Volvia Biz uses on the phone, so a cashier who uses both never has to
 * learn a second vocabulary.
 */
export function stampErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  switch (error.code) {
    case 'CUSTOMER_CARD_NOT_FOUND':
      return 'Esa tarjeta ya no existe.'
    case 'CARD_NOT_ACTIVE':
      return 'Esa tarjeta no está activa.'
    case 'CUSTOMER_CARD_BLOCKED':
      return 'Esa tarjeta está bloqueada.'
    case 'STAMP_COOLDOWN_ACTIVE':
      return 'Ya tiene un sello muy reciente.'
    case 'STAMP_DAILY_CAP_REACHED':
      return 'Llegó al tope de sellos de hoy.'
    case 'REMOTE_STAMPING_DISABLED':
      return 'Tu negocio ya no permite sellos a distancia.'
    case 'VALIDATION_FAILED':
      return error.details?.some((detail) => detail.message === 'order_required')
        ? 'Escribe el número de pedido.'
        : error.message === 'purchase amount required'
          ? 'Esta tarjeta sella por monto de compra; hazlo desde el teléfono.'
          : 'Revisa los datos e intenta de nuevo.'
    case 'FORBIDDEN':
    case 'NOT_A_MEMBER':
      return 'Tu cuenta ya no tiene acceso a este negocio.'
    default:
      return 'Algo salió mal. Intenta de nuevo.'
  }
}

export function signInErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (error.code === 'INVALID_CREDENTIALS') return 'Correo o clave incorrectos.'
  if (error.code === 'RATE_LIMITED') return 'Demasiados intentos. Espera unos minutos.'
  return 'No pudimos entrar. Intenta de nuevo.'
}

/** "300 555 7788" → "···7788": enough for the cashier to confirm, nothing more. */
export const masked = (tail: string | null) => (tail ? `···${tail}` : null)
