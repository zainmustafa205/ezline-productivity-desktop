import type { LogFields, Logger, LogLevel } from '../contracts/logger'

export interface MemoryLogRecord {
  level: LogLevel
  scope: string | null
  event: string
  fields: LogFields
}

/** Logger that keeps every entry in memory, for tests. */
export class MemoryLogger implements Logger {
  readonly records: MemoryLogRecord[]
  private readonly scope: string | null

  constructor(scope: string | null = null, records: MemoryLogRecord[] = []) {
    this.scope = scope
    this.records = records
  }

  debug(event: string, fields: LogFields = {}): void {
    this.write('debug', event, fields)
  }

  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields)
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields)
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields)
  }

  child(scope: string): Logger {
    return new MemoryLogger(this.scope ? `${this.scope}.${scope}` : scope, this.records)
  }

  private write(level: LogLevel, event: string, fields: LogFields): void {
    this.records.push({ level, scope: this.scope, event, fields: { ...fields } })
  }
}
