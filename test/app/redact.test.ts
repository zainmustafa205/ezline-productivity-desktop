import { describe, expect, it } from 'vitest'
import {
  REDACTED,
  errorFields,
  redactFields,
  redactText,
  sanitizeEventName,
} from '../../src/main/app/redact'

describe('log redaction', () => {
  it('never writes sensitive fields', () => {
    const safe = redactFields({
      accessToken: 'abc',
      refreshToken: 'def',
      password: 'secret',
      windowTitle: 'Bank statement - Chrome',
      authorization: 'Bearer abc',
      requestBody: '{"password":"x"}',
      status: 401,
      workspaceId: 'ws-1',
    })
    expect(safe).toEqual({
      accessToken: REDACTED,
      refreshToken: REDACTED,
      password: REDACTED,
      windowTitle: REDACTED,
      authorization: REDACTED,
      requestBody: REDACTED,
      status: 401,
      workspaceId: 'ws-1',
    })
  })

  it('masks tokens inside other text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIz'
    expect(redactText(`failed with Bearer abc.def and ${jwt}`)).toBe(
      `failed with Bearer ${REDACTED} and ${REDACTED}`,
    )
  })

  it('keeps event names to safe identifiers', () => {
    expect(sanitizeEventName('sync.batch_failed')).toBe('sync.batch_failed')
    expect(sanitizeEventName('user typed: hello')).toBe('user_typed__hello')
  })

  it('logs only the name and a redacted message of an error', () => {
    expect(errorFields(new TypeError('Bearer abc failed'))).toEqual({
      errorName: 'TypeError',
      errorMessage: `Bearer ${REDACTED} failed`,
    })
  })
})
