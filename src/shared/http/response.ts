import { ApiRequestError } from '../contracts/api'
import type { ErrorBody } from '../contracts/api-types'

/**
 * Helpers that turn backend answers into the contract types. Shared by
 * MockApiClient and the real ApiClient, so both read answers the same way.
 */

/** Seconds from a Retry-After header (seconds or an HTTP date); undefined when absent or invalid. */
export function parseRetryAfterSeconds(
  header: string | null,
  now: Date = new Date(),
): number | undefined {
  if (header === null || header.trim() === '') return undefined
  const value = header.trim()
  if (/^\d+$/.test(value)) return Number(value)
  const date = Date.parse(value)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, Math.ceil((date - now.getTime()) / 1000))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reads an error body; tolerates bodies that are not the documented shape. */
export function parseErrorBody(status: number, body: unknown): ErrorBody {
  if (!isRecord(body)) return { statusCode: status, error: 'Error', message: '' }
  const message = body['message']
  const code = body['code']
  const parsed: ErrorBody = {
    ...body,
    statusCode: typeof body['statusCode'] === 'number' ? body['statusCode'] : status,
    error: typeof body['error'] === 'string' ? body['error'] : 'Error',
    message:
      typeof message === 'string' || Array.isArray(message) ? (message as string | string[]) : '',
  }
  if (typeof code === 'string') parsed.code = code
  else delete parsed.code
  return parsed
}

/** Builds the contract error of an HTTP error answer. */
export function httpError(
  status: number,
  body: unknown,
  retryAfterHeader: string | null,
): ApiRequestError {
  const parsed = parseErrorBody(status, body)
  const message = Array.isArray(parsed.message) ? parsed.message.join('; ') : parsed.message
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader)
  return new ApiRequestError({
    kind: 'HTTP',
    status,
    message: message || `Request failed with status ${status}`,
    ...(parsed.code !== undefined ? { code: parsed.code } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  })
}

/**
 * Returns `data` of a success envelope, or null when the answer has none.
 * The shape of `data` is defined by the route's contract in api-types.ts.
 */
export function unwrapEnvelope(body: unknown): unknown {
  if (!isRecord(body) || !('data' in body)) return null
  return body['data'] ?? null
}
