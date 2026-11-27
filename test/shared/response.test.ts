import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '../../src/shared/contracts/api'
import { httpError, parseRetryAfterSeconds, unwrapEnvelope } from '../../src/shared/http/response'

describe('response helpers', () => {
  it('reads Retry-After in seconds and as an HTTP date', () => {
    const now = new Date('2026-11-24T09:00:00.000Z')
    expect(parseRetryAfterSeconds('30', now)).toBe(30)
    expect(parseRetryAfterSeconds('Tue, 24 Nov 2026 09:01:00 GMT', now)).toBe(60)
    expect(parseRetryAfterSeconds(null, now)).toBeUndefined()
    expect(parseRetryAfterSeconds('soon', now)).toBeUndefined()
  })

  it('turns an error body into an ApiRequestError with code and retry time', () => {
    const error = httpError(
      503,
      {
        statusCode: 503,
        message: 'Maintenance',
        error: 'Service Unavailable',
        code: 'MAINTENANCE_MODE',
      },
      '120',
    )
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({
      kind: 'HTTP',
      status: 503,
      code: 'MAINTENANCE_MODE',
      message: 'Maintenance',
      retryAfterSeconds: 120,
    })
  })

  it('joins validation messages and tolerates bodies of another shape', () => {
    expect(httpError(400, { message: ['a', 'b'] }, null).message).toBe('a; b')
    expect(httpError(502, 'not json', null).message).toBe('Request failed with status 502')
    expect(httpError(502, 'not json', null).code).toBeUndefined()
  })

  it('unwraps the data of the success envelope', () => {
    expect(unwrapEnvelope({ success: true, statusCode: 200, message: 'ok', data: [1] })).toEqual([
      1,
    ])
    expect(unwrapEnvelope({ success: true, statusCode: 201, message: 'ok' })).toBeNull()
  })
})
