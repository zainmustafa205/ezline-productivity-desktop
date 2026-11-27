import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { API_ROUTES } from '../../src/shared/contracts/api-routes'
import { isMfaRequired } from '../../src/shared/contracts/api-types'
import type {
  InstallationData,
  LoginData,
  LoginSuccessData,
  RefreshData,
  ScheduleData,
  SyncData,
  WorkspaceMembership,
} from '../../src/shared/contracts/api-types'
import { ApiRequestError } from '../../src/shared/contracts/api'
import { MockApiClient } from '../../src/shared/fakes/mock-api-client'
import { MOCK_PASSWORD } from '../../tools/mock-api/fixtures'
import { createMockApi } from '../../tools/mock-api/mock-api'

const api = createMockApi({ port: 0 })
let client: MockApiClient
let baseUrl: string

async function control(method: 'POST' | 'PUT', path: string, body: unknown = {}): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(response.ok).toBe(true)
}

async function expectApiError(promise: Promise<unknown>): Promise<ApiRequestError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiRequestError) return error
    throw new Error('The request failed without an ApiRequestError.', { cause: error })
  }
  throw new Error('The request did not fail.')
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('The answer has no data.')
  return value
}

async function loginSuccess(email: string): Promise<LoginSuccessData> {
  const data = required((await login(email)).data)
  if (isMfaRequired(data)) throw new Error('The account needs an authenticator code.')
  return data
}

function refresh(token: string) {
  return client.request<RefreshData>('POST', API_ROUTES.refresh, {
    auth: false,
    body: { refreshToken: token },
  })
}

function syncTo(workspaceId: string) {
  return client.request('POST', API_ROUTES.activitySync(workspaceId), {
    body: { entries: [syncEntry(uuid(9))] },
  })
}

function login(email: string, password = MOCK_PASSWORD) {
  return client.request<LoginData>('POST', API_ROUTES.login, {
    auth: false,
    body: { email, password, rememberMe: true },
  })
}

function syncEntry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: id,
    status: 'ACTIVE',
    applicationName: 'Code',
    windowTitle: 'file.ts',
    domain: null,
    startTime: '2026-11-24T09:00:00.000Z',
    endTime: '2026-11-24T09:05:00.000Z',
    ...overrides,
  }
}

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('mock API with MockApiClient', () => {
  beforeAll(async () => {
    baseUrl = await api.start()
    client = new MockApiClient({ baseUrl, appVersion: '0.1.0' })
  })

  afterAll(async () => {
    await api.stop()
  })

  beforeEach(() => {
    api.state.reset()
  })

  it('answers health and platform status without a token', async () => {
    const health = await client.request<{ status: string }>('GET', API_ROUTES.health, {
      auth: false,
    })
    expect(health.data?.status).toBe('ok')
    const platform = await client.request<{ features: { ACTIVITY_SYNC: boolean } }>(
      'GET',
      API_ROUTES.platformStatus,
      { auth: false },
    )
    expect(platform.data?.features.ACTIVITY_SYNC).toBe(true)
  })

  it('answers every row of the login table', async () => {
    const success = await loginSuccess('member@mock.test')
    expect(success.user.email).toBe('member@mock.test')
    expect(success.accessToken).toBeTruthy()

    expect((await login('admin@mock.test')).data).toMatchObject({ mfaRequired: true })

    const cases: [string, number, string | undefined, string | undefined][] = [
      ['nobody@mock.test', 401, undefined, 'Invalid email or password.'],
      ['unverified@mock.test', 401, undefined, 'Please verify your email before logging in.'],
      [
        'locked@mock.test',
        403,
        undefined,
        'Too many failed attempts. Please try again in a few minutes.',
      ],
      ['suspended@mock.test', 403, 'ACCOUNT_SUSPENDED', undefined],
      ['reset@mock.test', 403, 'PASSWORD_RESET_REQUIRED', undefined],
    ]
    const errors = await Promise.all(cases.map(([email]) => expectApiError(login(email))))
    cases.forEach(([, status, code, message], index) => {
      expect(errors[index]?.status).toBe(status)
      expect(errors[index]?.code).toBe(code)
      if (message !== undefined) expect(errors[index]?.message).toBe(message)
    })
  })

  it('rejects unknown fields like the backend', async () => {
    const error = await expectApiError(
      client.request('POST', API_ROUTES.login, {
        auth: false,
        body: { email: 'member@mock.test', password: MOCK_PASSWORD, extra: 1 },
      }),
    )
    expect(error.status).toBe(400)
  })

  it('uses single-use refresh tokens and ends every session on reuse', async () => {
    const first = await loginSuccess('member@mock.test')
    const second = required((await refresh(first.refreshToken)).data)
    expect(second.refreshToken).not.toBe(first.refreshToken)

    expect((await expectApiError(refresh(first.refreshToken))).status).toBe(401)
    // The reuse ended the session: the newest token is gone too.
    expect((await expectApiError(refresh(second.refreshToken))).status).toBe(401)
  })

  it('lists workspaces and registers the installation', async () => {
    const workspaces = await client.request<WorkspaceMembership[]>('GET', API_ROUTES.myWorkspaces)
    expect(workspaces.data).toEqual([
      {
        workspaceId: 'ws-ezline',
        workspaceName: 'Ezline Mock Workspace',
        role: 'TEAM_MEMBER',
        suspended: false,
      },
    ])
    await control('PUT', '/__mock/latest-version', { latestVersion: '0.2.0' })
    const installation = await client.request<InstallationData>('POST', API_ROUTES.installations, {
      body: { installationId: uuid(1), appVersion: '0.1.0', platform: 'WINDOWS' },
    })
    expect(installation.data).toMatchObject({ latestVersion: '0.2.0', status: 'INSTALLED' })
  })

  it('answers 304 for an unchanged schedule and a new version after a change', async () => {
    const first = await client.request<ScheduleData>('GET', API_ROUTES.mySchedule('ws-ezline'))
    expect(first.data?.trackingMode).toBe('NORMAL')
    expect(first.etag).toBeTruthy()

    const unchanged = await client.request('GET', API_ROUTES.mySchedule('ws-ezline'), {
      ifNoneMatch: first.etag ?? '',
    })
    expect(unchanged).toEqual({ status: 304, data: null, etag: first.etag })

    await control('PUT', '/__mock/schedule', { workspaceId: 'ws-ezline', preset: 'strict' })
    const changed = await client.request<ScheduleData>('GET', API_ROUTES.mySchedule('ws-ezline'), {
      ifNoneMatch: first.etag ?? '',
    })
    expect(changed.data).toMatchObject({ trackingMode: 'STRICT', pauseAllowed: false })
  })

  it('syncs a gzip batch and lists rejected entries with their codes', async () => {
    const response = await client.request<SyncData>('POST', API_ROUTES.activitySync('ws-ezline'), {
      gzip: true,
      body: {
        entries: [
          syncEntry(uuid(1)),
          syncEntry(uuid(2), { endTime: '2026-11-24T08:00:00.000Z' }),
          syncEntry(uuid(3), { domain: 'not a host' }),
          syncEntry(uuid(4), { endTime: null }),
        ],
      },
    })
    expect(response.data).toMatchObject({ accepted: 2, updated: 0, duplicates: 0 })
    expect(response.data?.rejected).toEqual([
      { clientEventId: uuid(2), code: 'INVALID_TIME_RANGE' },
      { clientEventId: uuid(3), code: 'INVALID_DOMAIN' },
    ])

    const again = await client.request<SyncData>('POST', API_ROUTES.activitySync('ws-ezline'), {
      body: { entries: [syncEntry(uuid(1)), syncEntry(uuid(4))] },
    })
    expect(again.data).toMatchObject({ accepted: 0, updated: 1, duplicates: 1, rejected: [] })
  })

  it('answers the sync errors of the error table', async () => {
    expect((await expectApiError(syncTo('ws-second'))).message).toBe(
      'You are not a member of this workspace.',
    )

    await control('POST', '/__mock/failures', { route: 'sync', status: 429, retryAfterSeconds: 7 })
    expect(await expectApiError(syncTo('ws-ezline'))).toMatchObject({
      status: 429,
      retryAfterSeconds: 7,
    })

    await control('PUT', '/__mock/platform', { features: { ACTIVITY_SYNC: false } })
    expect(await expectApiError(syncTo('ws-ezline'))).toMatchObject({
      status: 503,
      code: 'FEATURE_DISABLED',
    })

    await control('PUT', '/__mock/platform', {
      maintenance: { enabled: true, retryAfterSeconds: 90 },
    })
    expect(await expectApiError(syncTo('ws-ezline'))).toMatchObject({
      status: 503,
      code: 'MAINTENANCE_MODE',
      retryAfterSeconds: 90,
    })
    // Sign-in still works during maintenance.
    expect((await login('member@mock.test')).status).toBe(200)
  })

  it('answers 401 after the access tokens expire', async () => {
    await control('POST', '/__mock/sessions/expire-access')
    expect((await expectApiError(client.request('GET', API_ROUTES.myWorkspaces))).status).toBe(401)
  })

  it('reports a network error when the server cannot be reached', async () => {
    const offline = new MockApiClient({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 2_000 })
    const error = await expectApiError(offline.request('GET', API_ROUTES.health, { auth: false }))
    expect(['NETWORK', 'TIMEOUT']).toContain(error.kind)
  })
})
