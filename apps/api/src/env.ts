import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

// The monorepo keeps one .env at the root; every service reads the same file.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const bool = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()),
  )

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  REDIS_URL: z.string().min(1),

  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  APP_URL: z.string().url(),
  PASS_URL: z.string().url(),
  CORS_ORIGINS: csv,
  COOKIE_DOMAIN: z.string().default('localhost'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  TOKEN_PEPPER: z.string().min(32),

  MAIL_TRANSPORT: z.enum(['smtp', 'log']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: bool.default(false),
  MAIL_FROM: z.string().default('Volvia <hola@volvia.local>'),
  /** Where the marketing site's contact form lands. Falls back to the sender. */
  SUPPORT_EMAIL: z.string().default(''),

  STORAGE_DRIVER: z.enum(['s3', 'memory']).default('s3'),
  STORAGE_BUCKET: z.string().default('volvia-uploads'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().default(''),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().default(''),
  STORAGE_SECRET_KEY: z.string().default(''),
  STORAGE_FORCE_PATH_STYLE: bool.default(true),

  WALLET_MODE: z.enum(['stub', 'real', 'disabled']).default('stub'),
  APPLE_PASS_TYPE_ID: z.string().default('pass.co.volvia.loyalty'),
  APPLE_TEAM_ID: z.string().default('DEV0000000'),
  APPLE_PASS_CERT_PATH: z.string().default('infra/certs/pass-cert.pem'),
  APPLE_PASS_KEY_PATH: z.string().default('infra/certs/pass-key.pem'),
  APPLE_PASS_KEY_PASSPHRASE: z.string().default(''),
  APPLE_WWDR_CERT_PATH: z.string().default('infra/certs/wwdr.pem'),
  // The same credentials as inline contents, which win over the paths. Cloud Run
  // worker pools cannot mount secrets as files, only expose them as variables.
  APPLE_PASS_CERT_PEM: z.string().default(''),
  APPLE_PASS_KEY_PEM: z.string().default(''),
  APPLE_WWDR_CERT_PEM: z.string().default(''),
  GOOGLE_WALLET_ISSUER_ID: z.string().default(''),
  GOOGLE_WALLET_SA_EMAIL: z.string().default(''),
  GOOGLE_WALLET_SA_KEY_PATH: z.string().default(''),
  GOOGLE_WALLET_SA_KEY_JSON: z.string().default(''),
  GOOGLE_WALLET_CLASS_PREFIX: z.string().default('volvia_dev'),

  GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),

  BILLING_ENABLED: bool.default(true),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_PRO_MONTHLY: z.string().default(''),
  STRIPE_PRICE_PRO_YEARLY: z.string().default(''),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().default(''),
  STRIPE_PRICE_BUSINESS_YEARLY: z.string().default(''),
  STRIPE_PRICE_MULTI_MONTHLY: z.string().default(''),
  STRIPE_PRICE_MULTI_YEARLY: z.string().default(''),
  WOMPI_PUBLIC_KEY: z.string().default(''),
  WOMPI_PRIVATE_KEY: z.string().default(''),
  WOMPI_EVENTS_SECRET: z.string().default(''),
  WOMPI_INTEGRITY_SECRET: z.string().default(''),
  WOMPI_BASE_URL: z.string().default('https://sandbox.wompi.co/v1'),

  /** Off only for the end-to-end suite, which signs up many businesses from one IP. */
  RATE_LIMIT_ENABLED: bool.default(true),

  OTEL_ENABLED: bool.default(false),
  SENTRY_DSN: z.string().default(''),
})

export type Env = z.infer<typeof envSchema>

/**
 * Values that are fine on a laptop and dangerous anywhere else.
 *
 * The `.env.example` secrets are in the repository, so anyone could forge a session on
 * a deployment that kept them. Length validation alone would accept them happily, which
 * is why production refuses to start rather than warn.
 */
export function unsafeForProduction(env: Env): string[] {
  const problems: string[] = []

  const placeholder = (value: string) => /dev-only|change-me|^changeme|^secret$|^test$/i.test(value)
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TOKEN_PEPPER'] as const) {
    if (placeholder(env[key])) problems.push(`${key} still holds the development placeholder`)
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different')
  }
  if (!env.RATE_LIMIT_ENABLED) {
    problems.push('RATE_LIMIT_ENABLED is off; it may only be off for the end-to-end suite')
  }
  if (env.CORS_ORIGINS.length === 0) {
    problems.push('CORS_ORIGINS is empty; set the real dashboard and card domains')
  }
  if (env.CORS_ORIGINS.some((origin) => origin.startsWith('http://'))) {
    problems.push('CORS_ORIGINS contains a plaintext http:// origin')
  }
  if (env.COOKIE_DOMAIN === 'localhost') {
    problems.push('COOKIE_DOMAIN is still localhost')
  }
  for (const [key, value] of Object.entries({
    APP_URL: env.APP_URL,
    WEB_URL: env.WEB_URL,
    PASS_URL: env.PASS_URL,
    API_URL: env.API_URL,
  })) {
    if (value.includes('localhost') || value.startsWith('http://')) {
      problems.push(`${key} points at ${value}, which cannot be right in production`)
    }
  }

  return problems
}

function load(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }

  if (parsed.data.NODE_ENV === 'production') {
    const problems = unsafeForProduction(parsed.data)
    if (problems.length > 0) {
      throw new Error(
        `Refusing to start in production with an unsafe configuration:\n${problems
          .map((problem) => `  - ${problem}`)
          .join('\n')}`,
      )
    }
  }

  return parsed.data
}

export const env = load()
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
