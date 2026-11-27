import type { IncomingMessage, ServerResponse } from 'node:http'
import { gunzipSync } from 'node:zlib'

/** HTTP helpers of the mock API: the backend's success envelope and error body. */

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

export interface ErrorOptions {
  code?: string
  retryAfterSeconds?: number
  extra?: Record<string, unknown>
}

export function errorText(status: number): string {
  return STATUS_TEXT[status] ?? 'Error'
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const json = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    ...headers,
  })
  response.end(json)
}

/** Success envelope (API reference 1.3); `data` is omitted when undefined. */
export function sendSuccess(
  response: ServerResponse,
  status: number,
  message: string,
  data?: unknown,
  headers: Record<string, string> = {},
): void {
  sendJson(
    response,
    status,
    { success: true, statusCode: status, message, ...(data !== undefined ? { data } : {}) },
    headers,
  )
}

/** Error body (API reference 1.4), not wrapped. */
export function sendError(
  response: ServerResponse,
  status: number,
  message: string | string[],
  options: ErrorOptions = {},
): void {
  const headers: Record<string, string> = {}
  if (options.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(options.retryAfterSeconds)
  }
  sendJson(
    response,
    status,
    {
      statusCode: status,
      message,
      error: errorText(status),
      ...(options.code !== undefined ? { code: options.code } : {}),
      ...options.extra,
    },
    headers,
  )
}

export function sendNotModified(response: ServerResponse, etag: string): void {
  response.writeHead(304, { ETag: etag, 'Cache-Control': 'private, no-cache' })
  response.end()
}

export class BodyError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Reads a JSON body. A gzip body (Content-Encoding: gzip) is decompressed; the
 * limit applies after decompression. An empty body is undefined.
 */
export async function readJsonBody(request: IncomingMessage, limitBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    received += buffer.length
    // The compressed size can never be larger than allowed after decompression.
    if (received > limitBytes) throw new BodyError(413, 'Request body is too large.')
    chunks.push(buffer)
  }
  let raw = Buffer.concat(chunks)
  const encoding = (request.headers['content-encoding'] ?? 'identity').toLowerCase()
  if (encoding === 'gzip') {
    try {
      raw = gunzipSync(raw, { maxOutputLength: limitBytes })
    } catch (error) {
      const tooLarge = error instanceof RangeError || String(error).includes('maxOutputLength')
      throw tooLarge
        ? new BodyError(413, 'Request body is too large.')
        : new BodyError(400, 'The request body could not be decompressed.')
    }
  } else if (encoding !== 'identity') {
    throw new BodyError(415, 'Unsupported content encoding.')
  }
  if (raw.length > limitBytes) throw new BodyError(413, 'Request body is too large.')
  if (raw.length === 0) return undefined
  try {
    return JSON.parse(raw.toString('utf8')) as unknown
  } catch {
    throw new BodyError(400, 'The request body is not valid JSON.')
  }
}

export function bearerToken(request: IncomingMessage): string | null {
  const header = request.headers['authorization']
  if (typeof header !== 'string') return null
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match?.[1] ?? null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Field names that are not allowed (the backend rejects unknown fields). */
export function unknownFields(body: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((key) => `property ${key} should not exist`)
}
