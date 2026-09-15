import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

// A single, non-pooled connection: migrations must not race across instances.
const sql = postgres(url, { max: 1, ssl: /neon\.tech/i.test(url) ? 'require' : false })

try {
  console.log('→ running migrations')
  await migrate(drizzle(sql), { migrationsFolder })
  console.log('✓ migrations applied')
} catch (error) {
  console.error('✗ migration failed:', error)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
