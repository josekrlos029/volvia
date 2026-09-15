import { createApiClient } from '@volvia/shared/client'

/**
 * Server-side client. The public endpoints need no credentials, so this runs on the
 * server and the customer's browser never talks to the API directly for reads.
 */
export const api = createApiClient({
  baseUrl: process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  credentials: 'omit',
})

/** Same base URL, but resolved in the browser for the join form's POST. */
export const browserApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export function walletUrl(path: string): string {
  return `${browserApiUrl}${path}`
}
