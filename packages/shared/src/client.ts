import type { ApiErrorBody, ErrorCode } from './errors'

/**
 * Typed HTTP client shared by all three frontends.
 *
 * Deliberately thin: it handles the two things every caller would otherwise repeat —
 * turning an API error body into a real Error, and refreshing an expired access token
 * exactly once instead of on every parallel request.
 */

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Array<{ path: string; message: string }>
  readonly upgradeTo?: string
  readonly requestId?: string

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
    this.upgradeTo = body.upgradeTo
    this.requestId = body.requestId
  }

  /** True when the caller should send the user to the upgrade screen. */
  get isPlanLimit(): boolean {
    return this.code === 'FEATURE_NOT_IN_PLAN' || this.code === 'PLAN_LIMIT_REACHED'
  }

  get isAuthError(): boolean {
    return this.status === 401
  }

  /** Field errors keyed by path, ready to hand to a form library. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const detail of this.details ?? []) errors[detail.path] = detail.message
    return errors
  }
}

export interface ClientOptions {
  baseUrl: string
  /** Returns the current access token, or null when signed out. */
  getToken?: () => string | null | undefined
  /** Called on 401 so the caller can refresh; return the new token or null to give up. */
  onUnauthorized?: () => Promise<string | null>
  getOrgId?: () => string | null | undefined
  /** Send cookies — the dashboard uses httpOnly cookies rather than a stored token. */
  credentials?: RequestCredentials
  fetchImpl?: typeof fetch
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Skip the automatic refresh-and-retry, used by the refresh call itself. */
  noRetry?: boolean
}

export function createApiClient(options: ClientOptions) {
  const doFetch = options.fetchImpl ?? fetch

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const url = new URL(path.replace(/^\//, ''), `${options.baseUrl.replace(/\/$/, '')}/`)
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }

    const send = async (token: string | null | undefined): Promise<Response> => {
      const headers: Record<string, string> = { ...init.headers }
      if (init.body !== undefined) headers['content-type'] = 'application/json'
      if (token) headers.authorization = `Bearer ${token}`

      const orgId = options.getOrgId?.()
      if (orgId) headers['x-org-id'] = orgId

      return doFetch(url.toString(), {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        credentials: options.credentials ?? 'include',
        signal: init.signal,
      })
    }

    let response = await send(options.getToken?.())

    // One silent refresh, then give up — retrying a second time would loop.
    if (response.status === 401 && !init.noRetry && options.onUnauthorized) {
      const refreshed = await options.onUnauthorized()
      if (refreshed) response = await send(refreshed)
    }

    if (response.status === 204) return undefined as T

    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')

    if (!response.ok) {
      if (isJson) {
        const body = (await response.json()) as ApiErrorBody
        throw new ApiError(response.status, body.error)
      }
      throw new ApiError(response.status, {
        code: 'INTERNAL',
        message: `request failed with status ${response.status}`,
      })
    }

    return isJson ? ((await response.json()) as T) : (undefined as T)
  }

  return {
    request,
    get: <T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'GET' }),
    post: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'POST', body }),
    patch: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'PATCH', body }),
    put: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'PUT', body }),
    delete: <T>(path: string, init?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'DELETE' }),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
