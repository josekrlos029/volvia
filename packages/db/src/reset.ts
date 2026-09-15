import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

// Guard rail: this drops everything, so refuse anything that is not a local database.
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)
if (!isLocal && process.env.ALLOW_REMOTE_RESET !== 'yes-i-am-sure') {
  console.error(
    'Refusing to reset a non-local database. Set ALLOW_REMOTE_RESET=yes-i-am-sure to override.',
  )
  process.exit(1)
}

const sql = postgres(url, { max: 1 })
try {
  await sql`drop schema if exists public cascade`
  await sql`create schema public`
  await sql`drop schema if exists drizzle cascade`
  console.log('✓ database reset')
} finally {
  await sql.end({ timeout: 5 })
}
