import { describe, expect, it } from 'vitest'
import { RuntimeConfigError, resolveRuntimeConfig } from '../../src/main/app/runtime-config'

describe('runtime configuration', () => {
  it('uses the mock API and the local web app in development', () => {
    expect(
      resolveRuntimeConfig({
        apiUrl: undefined,
        webAppUrl: '',
        isPackaged: false,
        appVersion: '0.1.0',
      }),
    ).toEqual({
      apiBaseUrl: 'http://127.0.0.1:4010',
      webAppUrl: 'http://localhost:5173',
      isPackaged: false,
      appVersion: '0.1.0',
    })
  })

  it('removes a trailing slash', () => {
    const config = resolveRuntimeConfig({
      apiUrl: 'https://api.example.com/',
      webAppUrl: 'https://app.example.com/',
      isPackaged: true,
      appVersion: '1.0.0',
    })
    expect(config.apiBaseUrl).toBe('https://api.example.com')
    expect(config.webAppUrl).toBe('https://app.example.com')
  })

  it('requires both URLs with https in the packaged application', () => {
    const packaged = { isPackaged: true, appVersion: '1.0.0' }
    expect(() =>
      resolveRuntimeConfig({ ...packaged, apiUrl: undefined, webAppUrl: 'https://a.example.com' }),
    ).toThrow(RuntimeConfigError)
    expect(() =>
      resolveRuntimeConfig({
        ...packaged,
        apiUrl: 'http://api.example.com',
        webAppUrl: 'https://a.example.com',
      }),
    ).toThrow('https')
  })

  it('refuses URLs with credentials or a query', () => {
    expect(() =>
      resolveRuntimeConfig({
        apiUrl: 'https://user:pass@api.example.com',
        webAppUrl: undefined,
        isPackaged: false,
        appVersion: '0.1.0',
      }),
    ).toThrow(RuntimeConfigError)
  })
})
