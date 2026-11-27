import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '../../src/main/app/logger'

describe('file logger', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'productivityai-log-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('writes JSON lines with scope and without sensitive values', () => {
    const logger = createLogger({
      directory,
      minLevel: 'info',
      console: false,
      now: () => new Date('2026-11-24T09:00:00.000Z'),
    })
    logger.debug('ignored')
    logger.child('sync').warn('sync.retry', { attempt: 2, refreshToken: 'abc', windowTitle: 'x' })

    const lines = readFileSync(join(directory, 'main.log'), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      at: '2026-11-24T09:00:00.000Z',
      level: 'warn',
      scope: 'sync',
      event: 'sync.retry',
      attempt: 2,
      refreshToken: '[REDACTED]',
      windowTitle: '[REDACTED]',
    })
  })

  it('rotates the file when it grows too large', () => {
    const logger = createLogger({ directory, minLevel: 'info', console: false })
    const text = 'x'.repeat(400)
    for (let index = 0; index < 3_000; index += 1) logger.info('filler', { text })
    const files = readdirSync(directory).toSorted()
    expect(files).toContain('main.log')
    expect(files).toContain('main.log.1')
    expect(files.length).toBeLessThanOrEqual(4)
  })
})
