/**
 * Structured logger. Implemented in src/main/app/ (Zain), used by everyone.
 *
 * Rules: the event is a fixed name such as `sync.batch_failed`, never built from
 * user data. Fields with sensitive names (tokens, passwords, window titles,
 * request bodies) are replaced by `[REDACTED]`, and token-like text in values is
 * masked, but callers still never pass a token, password or window title.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogValue = string | number | boolean | null | undefined

export type LogFields = Readonly<Record<string, LogValue>>

export interface Logger {
  debug(event: string, fields?: LogFields): void
  info(event: string, fields?: LogFields): void
  warn(event: string, fields?: LogFields): void
  error(event: string, fields?: LogFields): void
  /** A logger whose entries carry this scope, for example `sync`. */
  child(scope: string): Logger
}
