/** Cross-cutting domain constants. Anything a handler would otherwise hardcode lives here. */

export const APP_NAME = 'Volvia'

/** Stamp cards */
export const MIN_STAMPS_REQUIRED = 2
export const MAX_STAMPS_REQUIRED = 20
export const DEFAULT_STAMPS_REQUIRED = 8
export const MAX_REWARDS_PER_CARD = 10
export const MAX_STAMPS_PER_SCAN = 10

/** Anti-fraud defaults, overridable per card within these bounds. */
export const DEFAULT_STAMP_COOLDOWN_MINUTES = 30
export const MAX_STAMP_COOLDOWN_MINUTES = 24 * 60
export const DEFAULT_DAILY_STAMP_CAP = 3
export const MAX_DAILY_STAMP_CAP = 50

/** Kiosk QR rotates this often; each nonce is single-use. */
export const KIOSK_NONCE_TTL_SECONDS = 30
export const KIOSK_NONCE_GRACE_SECONDS = 10

/** Opaque public tokens (card links, pass auth tokens): bytes of entropy. */
export const PUBLIC_TOKEN_BYTES = 24
export const JOIN_SLUG_LENGTH = 10
export const REDEEM_CODE_LENGTH = 6

/** Sessions */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
export const MAGIC_LINK_TTL_SECONDS = 15 * 60
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60
export const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60

/** A head start, capped so the reward still has to be earned. */
export const MAX_INITIAL_STAMPS = 3

/** Rotating card messages. More than five and a business stops writing good ones. */
export const MAX_CARD_MESSAGE_VARIANTS = 5

/** How many customers one selection in the list can carry into an action. */
export const MAX_SELECTED_CUSTOMERS = 500

/** Nobody is asked for a public Google review more than twice a year. */
export const REVIEW_REQUEST_COOLDOWN_DAYS = 180

/** Idempotency window for a stamp scan replay. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60

/** Pagination */
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

/** Uploads */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

/** Surveys */
export const MAX_SURVEY_QUESTIONS = 10
export const MAX_PROFILE_QUESTIONS = 8
