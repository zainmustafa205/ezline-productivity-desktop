import type { LogFields, LogValue } from '../../shared/contracts/logger'

/** Field names whose values are never written to a log. */
const SENSITIVE_FIELD =
  /token|password|passwd|secret|authorization|cookie|credential|title|body|mfa|apikey|api_key/i

const JWT_PATTERN = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g
const BEARER_PATTERN = /Bearer\s+[^\s"',;]+/gi
const MAX_VALUE_LENGTH = 500

export const REDACTED = '[REDACTED]'

/** Masks token-like text inside a value and shortens long values. */
export function redactText(value: string): string {
  const masked = value.replace(BEARER_PATTERN, `Bearer ${REDACTED}`).replace(JWT_PATTERN, REDACTED)
  return masked.length > MAX_VALUE_LENGTH ? `${masked.slice(0, MAX_VALUE_LENGTH)}...` : masked
}

function redactValue(key: string, value: LogValue): LogValue {
  if (value === undefined || value === null) return value
  if (SENSITIVE_FIELD.test(key)) return REDACTED
  return typeof value === 'string' ? redactText(value) : value
}

/** Returns a copy of the fields that is safe to write to a log. */
export function redactFields(fields: LogFields): Record<string, LogValue> {
  const safe: Record<string, LogValue> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    safe[key] = redactValue(key, value)
  }
  return safe
}

/** Event names are fixed identifiers; anything else is replaced. */
export function sanitizeEventName(event: string): string {
  const cleaned = event.replace(/[^\w.-]/g, '_').slice(0, 100)
  return cleaned === '' ? 'unnamed_event' : cleaned
}

/** Log fields of a caught error: its name and its redacted message, never a stack with data. */
export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: redactText(error.message) }
  }
  return { errorName: 'UnknownError', errorMessage: redactText(String(error)) }
}
