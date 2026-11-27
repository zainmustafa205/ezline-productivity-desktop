import { gzipSync } from 'node:zlib'
import { API_CONFIG, APP_CONFIG, MOCK_API_CONFIG } from '../config/app-config'
import type { ApiClient, ApiMethod, ApiRequestOptions, ApiResponse } from '../contracts/api'
import { ApiRequestError } from '../contracts/api'
import { httpError, unwrapEnvelope } from '../http/response'

export interface MockApiClientOptions {
  /** Default: the local mock API. Never the production backend. */
  baseUrl?: string
  /** Default: the fixed test token of the mock member account. */
  accessToken?: string
  timeoutMs?: number
  appVersion?: string
}

/**
 * A simple ApiClient for Wasi's sync until Bilal's real client is merged. It
 * calls the mock API with a fixed test token. It does not refresh tokens: a
 * 401 is thrown to the caller, as the real client does after its one refresh.
 */
export class MockApiClient implements ApiClient {
  private readonly baseUrl: string
  private readonly accessToken: string
  private readonly timeoutMs: number
  private readonly userAgent: string
  /** Paths of every request sent (for tests). */
  readonly sentPaths: string[] = []

  constructor(options: MockApiClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ?? `http://${MOCK_API_CONFIG.host}:${MOCK_API_CONFIG.port}`
    ).replace(/\/+$/, '')
    this.accessToken = options.accessToken ?? MOCK_API_CONFIG.testAccessToken
    this.timeoutMs = options.timeoutMs ?? API_CONFIG.requestTimeoutMs
    this.userAgent = `${APP_CONFIG.userAgentPrefix}/${options.appVersion ?? '0.0.0'}`
  }

  async request<T>(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    }
    if (options.auth !== false) headers['Authorization'] = `Bearer ${this.accessToken}`
    if (options.ifNoneMatch !== undefined) headers['If-None-Match'] = options.ifNoneMatch

    let body: string | Uint8Array | undefined
    if (options.body !== undefined) {
      const json = JSON.stringify(options.body)
      headers['Content-Type'] = 'application/json'
      if (options.gzip === true) {
        headers['Content-Encoding'] = 'gzip'
        body = new Uint8Array(gzipSync(json))
      } else {
        body = json
      }
    }

    this.sentPaths.push(path)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
      throw new ApiRequestError({
        kind: timedOut ? 'TIMEOUT' : 'NETWORK',
        message: timedOut ? 'The request timed out.' : 'The server could not be reached.',
      })
    }

    const etag = response.headers.get('ETag') ?? undefined
    if (response.status === 304) {
      return { status: 304, data: null, ...(etag !== undefined ? { etag } : {}) }
    }

    const text = await response.text()
    const parsed: unknown = text === '' ? null : safeJsonParse(text)
    if (!response.ok) throw httpError(response.status, parsed, response.headers.get('Retry-After'))
    return {
      status: response.status,
      // The route contract (api-types.ts) defines the shape of data; this is the one trust boundary.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      data: unwrapEnvelope(parsed) as T | null,
      ...(etag !== undefined ? { etag } : {}),
    }
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}
