import { describe, expect, it, vi } from 'vitest'
import { createExternalLinkOpener, isAllowedExternalUrl } from '../../src/main/app/external-links'
import { MemoryLogger } from '../../src/shared/fakes/memory-logger'

const policy = { allowedOrigins: ['https://app.example.com'], requireHttps: true }

describe('external links', () => {
  it('allows only the web app origin', () => {
    expect(isAllowedExternalUrl('https://app.example.com/forgot-password', policy)).toBe(true)
    expect(isAllowedExternalUrl('https://evil.example.com/forgot-password', policy)).toBe(false)
    expect(isAllowedExternalUrl('https://app.example.com.evil.com/', policy)).toBe(false)
    expect(isAllowedExternalUrl('http://app.example.com/', policy)).toBe(false)
    expect(isAllowedExternalUrl('file:///C:/Windows/System32/cmd.exe', policy)).toBe(false)
    expect(isAllowedExternalUrl('https://user@app.example.com/', policy)).toBe(false)
    expect(isAllowedExternalUrl('not a url', policy)).toBe(false)
  })

  it('allows http in development only', () => {
    const development = { allowedOrigins: ['http://localhost:5173'], requireHttps: false }
    expect(isAllowedExternalUrl('http://localhost:5173/dashboard', development)).toBe(true)
  })

  it('opens allowed links and logs blocked ones without the URL', () => {
    const openExternal = vi.fn(() => Promise.resolve())
    const logger = new MemoryLogger()
    const opener = createExternalLinkOpener(policy, openExternal, logger)
    expect(opener.open('https://app.example.com/dashboard')).toBe(true)
    expect(opener.open('https://other.example.com/?token=abc')).toBe(false)
    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(logger.records).toEqual([
      { level: 'warn', scope: null, event: 'external_link.blocked', fields: {} },
    ])
  })
})
