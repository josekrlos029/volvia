import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

export type Database = ReturnType<typeof createDatabase>['db']

export interface DatabaseOptions {
  url: string
  /** Cloud Run keeps containers small; a modest pool avoids exhausting Neon's limits. */
  max?: number
  idleTimeoutSeconds?: number
  connectTimeoutSeconds?: number
  /** Neon requires TLS; local Docker Postgres does not offer it. */
  ssl?: boolean
  onNotice?: (notice: unknown) => void
  debug?: boolean
}

/**
 * Creates a Drizzle client over postgres-js.
 *
 * The same driver serves local Docker Postgres and Neon — only the URL differs — so a
 * query that works locally behaves identically in production.
 */
export function createDatabase(options: DatabaseOptions) {
  const isNeon = /neon\.tech/i.test(options.url)
  const sql = postgres(options.url, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
    ssl: options.ssl ?? (isNeon ? 'require' : false),
    prepare: !isNeon, // pooled Neon connections cannot use named prepared statements
    onnotice: options.onNotice ?? (() => {}),
    transform: { undefined: null },
  })

  const db = drizzle(sql, { schema, casing: 'snake_case', logger: options.debug ?? false })

  return {
    db,
    sql,
    async close() {
      await sql.end({ timeout: 5 })
    },
    async ping() {
      await sql`select 1`
    },
  }
}

export { schema }
