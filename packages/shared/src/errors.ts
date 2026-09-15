/** Stable, client-facing error codes. The admin UI maps these to translated copy. */

export const ERROR_CODES = {
  // auth
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_REUSED: 401,
  EMAIL_NOT_VERIFIED: 403,
  FORBIDDEN: 403,
  EMAIL_TAKEN: 409,

  // tenancy / plans
  ORG_NOT_FOUND: 404,
  NOT_A_MEMBER: 403,
  FEATURE_NOT_IN_PLAN: 402,
  PLAN_LIMIT_REACHED: 402,

  // loyalty
  CARD_NOT_FOUND: 404,
  CARD_NOT_ACTIVE: 409,
  CUSTOMER_CARD_NOT_FOUND: 404,
  CUSTOMER_CARD_BLOCKED: 403,
  STAMP_COOLDOWN_ACTIVE: 429,
  STAMP_DAILY_CAP_REACHED: 429,
  REWARD_NOT_AVAILABLE: 409,
  REWARD_ALREADY_REDEEMED: 409,
  KIOSK_NONCE_INVALID: 401,
  KIOSK_NONCE_USED: 409,

  // generic
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export function statusForErrorCode(code: ErrorCode): number {
  return ERROR_CODES[code]
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode
    message: string
    /** Field-level detail for VALIDATION_FAILED. */
    details?: Array<{ path: string; message: string }>
    /** Present on FEATURE_NOT_IN_PLAN / PLAN_LIMIT_REACHED so the UI can deep-link to upgrade. */
    upgradeTo?: string
    requestId?: string
  }
}
