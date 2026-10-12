import { ApiError } from '@volvia/shared/client'

/**
 * API errors in the person's language.
 *
 * The API answers with stable codes and, for validation, with message keys like
 * `password_too_short`. Translating here keeps the copy next to the screens that show
 * it instead of hard-coding Spanish into the API.
 */
const BY_FIELD_MESSAGE: Record<string, string> = {
  password_too_short: 'La contraseña necesita al menos 12 caracteres.',
  password_too_common: 'Esa contraseña es demasiado común. Elige otra.',
}

const BY_CODE: Partial<Record<string, string>> = {
  EMAIL_TAKEN: 'Ese correo ya tiene una cuenta. Entra con tu contraseña.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  TOKEN_EXPIRED: 'Este enlace ya no sirve. Pide uno nuevo.',
  TOKEN_REUSED: 'Por seguridad cerramos tu sesión. Entra de nuevo.',
  UNAUTHENTICATED: 'Necesitas entrar para continuar.',
  FORBIDDEN: 'No tienes permiso para esto.',
  CONFLICT: 'Esta invitación ya se usó.',
  RATE_LIMITED: 'Demasiados intentos. Espera unos minutos.',
  SERVICE_UNAVAILABLE: 'Ese método de entrada no está disponible ahora.',
  SOCIAL_EMAIL_HIDDEN:
    'Apple nos dio un correo oculto. Vuelve a intentarlo y elige "Compartir mi correo": Volvia necesita tu dirección real.',
  ACCOUNT_NOT_FOUND: 'Ese correo no tiene cuenta en Volvia. Crea tu negocio primero.',
}

/**
 * The social callbacks cannot show a page of their own, so they land on `/login?error=`
 * with the API code. Unknown codes get the generic line rather than leaking the code.
 */
export function socialErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  return BY_CODE[code] ?? 'No pudimos completar la entrada. Intenta de nuevo.'
}

export function authErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    for (const detail of caught.details ?? []) {
      const translated = BY_FIELD_MESSAGE[detail.message]
      if (translated) return translated
    }
    if (caught.code === 'VALIDATION_FAILED') return 'Revisa los datos del formulario.'
    const byCode = BY_CODE[caught.code]
    if (byCode) return byCode
  }
  if (caught instanceof TypeError) return 'No pudimos conectar. Revisa tu internet.'
  return 'Algo salió mal. Intenta de nuevo.'
}
