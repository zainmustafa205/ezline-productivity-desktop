/**
 * Backend access. ApiClient and SessionProvider are implemented by Bilal
 * (src/main/core/), used by Wasi's sync.
 */

export type ApiErrorKind = 'HTTP' | 'NETWORK' | 'TIMEOUT'

export interface ApiError {
  kind: ApiErrorKind
  /** HTTP status, for kind HTTP. */
  status?: number
  /** Backend error code, when the error body has one. */
  code?: string
  message: string
  /** From the Retry-After header. */
  retryAfterSeconds?: number
}

/** The error every ApiClient throws. */
export class ApiRequestError extends Error implements ApiError {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly retryAfterSeconds?: number

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.kind = error.kind
    if (error.status !== undefined) this.status = error.status
    if (error.code !== undefined) this.code = error.code
    if (error.retryAfterSeconds !== undefined) this.retryAfterSeconds = error.retryAfterSeconds
  }
}

export function isApiRequestError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError
}

export interface ApiResponse<T> {
  status: number
  /** The `data` of the success envelope; null for 304 and for routes without data. */
  data: T | null
  etag?: string
}

export type ApiMethod = 'GET' | 'POST'

export interface ApiRequestOptions {
  body?: unknown
  /** Sends the JSON body gzip-compressed (Content-Encoding: gzip). */
  gzip?: boolean
  ifNoneMatch?: string
  /** Adds the access token; default true. */
  auth?: boolean
}

export interface ApiClient {
  /** Adds the access token, refreshes once on 401 and repeats once; throws ApiRequestError. */
  request<T>(method: ApiMethod, path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>
}

export interface SessionProvider {
  currentUserId(): string | null
  /** The workspace being tracked. */
  currentWorkspaceId(): string | null
  /** Returns a function that removes the listener. */
  onSignedIn(listener: (userId: string) => void): () => void
  /** Returns a function that removes the listener. */
  onSignedOut(listener: (reason: string) => void): () => void
}
