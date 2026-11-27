import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LOG_CONFIG } from '../../shared/config/app-config'
import type { LogFields, Logger, LogLevel } from '../../shared/contracts/logger'
import { redactFields, sanitizeEventName } from './redact'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface FileLoggerOptions {
  /** Folder of the log files (`<userData>/logs`); null writes to the console only. */
  directory: string | null
  minLevel: LogLevel
  /** Also print to the console (development). */
  console: boolean
  now?: () => Date
}

interface LogSink {
  write(level: LogLevel, line: string): void
}

/**
 * JSON-lines logger with redaction and size-based rotation.
 * Writing never throws: a failing log must not stop the application.
 */
export function createLogger(options: FileLoggerOptions): Logger {
  const now = options.now ?? (() => new Date())
  const sink = createSink(options)
  return new RedactingLogger(null, options.minLevel, sink, now)
}

class RedactingLogger implements Logger {
  private readonly scope: string | null
  private readonly minLevel: LogLevel
  private readonly sink: LogSink
  private readonly now: () => Date

  constructor(scope: string | null, minLevel: LogLevel, sink: LogSink, now: () => Date) {
    this.scope = scope
    this.minLevel = minLevel
    this.sink = sink
    this.now = now
  }

  debug(event: string, fields?: LogFields): void {
    this.log('debug', event, fields)
  }

  info(event: string, fields?: LogFields): void {
    this.log('info', event, fields)
  }

  warn(event: string, fields?: LogFields): void {
    this.log('warn', event, fields)
  }

  error(event: string, fields?: LogFields): void {
    this.log('error', event, fields)
  }

  child(scope: string): Logger {
    const name = sanitizeEventName(scope)
    return new RedactingLogger(
      this.scope ? `${this.scope}.${name}` : name,
      this.minLevel,
      this.sink,
      this.now,
    )
  }

  private log(level: LogLevel, event: string, fields: LogFields = {}): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return
    const record = {
      at: this.now().toISOString(),
      level,
      ...(this.scope ? { scope: this.scope } : {}),
      event: sanitizeEventName(event),
      ...redactFields(fields),
    }
    this.sink.write(level, JSON.stringify(record))
  }
}

function createSink(options: FileLoggerOptions): LogSink {
  const filePath = options.directory ? join(options.directory, LOG_CONFIG.fileName) : null
  let fileFailed = false

  return {
    write(level, line) {
      if (options.console) {
        if (level === 'error') console.error(line)
        else if (level === 'warn') console.warn(line)
        else console.info(line)
      }
      if (filePath === null || options.directory === null || fileFailed) return
      try {
        mkdirSync(options.directory, { recursive: true })
        rotateIfNeeded(filePath)
        appendFileSync(filePath, `${line}\n`, { encoding: 'utf8' })
      } catch (error) {
        fileFailed = true
        console.error('The log file could not be written; file logging is off.', String(error))
      }
    },
  }
}

function rotateIfNeeded(filePath: string): void {
  if (!existsSync(filePath) || statSync(filePath).size < LOG_CONFIG.maxFileBytes) return
  const oldest = `${filePath}.${LOG_CONFIG.maxRotatedFiles}`
  if (existsSync(oldest)) rmSync(oldest)
  for (let index = LOG_CONFIG.maxRotatedFiles - 1; index >= 1; index -= 1) {
    const from = `${filePath}.${index}`
    if (existsSync(from)) renameSync(from, `${filePath}.${index + 1}`)
  }
  renameSync(filePath, `${filePath}.1`)
}
