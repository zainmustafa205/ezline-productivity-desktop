import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import { API_ROUTES } from '../../src/shared/contracts/api-routes.ts'
import { login, logout, refresh } from './auth-routes.ts'
import type { RouteHandler } from './context.ts'
import * as control from './control-routes.ts'
import { BodyError, errorText, sendError } from './http.ts'
import type { RouteName } from './state.ts'
import { MockState } from './state.ts'
import { activitySync } from './sync-route.ts'
import {
  health,
  installations,
  mySchedule,
  myWorkspaces,
  platformStatus,
} from './workspace-routes.ts'

/** Path segment placeholder: `__workspaceId__` survives encodeURIComponent in API_ROUTES. */
const WORKSPACE_ID = '__workspaceId__'

interface Route {
  method: 'GET' | 'POST' | 'PUT'
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
  /** Backend routes can get injected failures; control routes cannot. */
  name: RouteName | null
}

function route(
  method: Route['method'],
  path: string,
  handler: RouteHandler,
  name: RouteName | null,
): Route {
  const paramNames: string[] = []
  const source = path
    .split('/')
    .map((part) => {
      const param = /^__(\w+)__$/.exec(part)?.[1]
      if (param === undefined) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      paramNames.push(param)
      return '([^/]+)'
    })
    .join('/')
  return { method, pattern: new RegExp(`^${source}$`), paramNames, handler, name }
}

const ROUTES: Route[] = [
  route('GET', API_ROUTES.health, health, 'health'),
  route('POST', API_ROUTES.login, login, 'login'),
  route('POST', API_ROUTES.refresh, refresh, 'refresh'),
  route('POST', API_ROUTES.logout, logout, 'logout'),
  route('GET', API_ROUTES.myWorkspaces, myWorkspaces, 'workspaces'),
  route('POST', API_ROUTES.installations, installations, 'installations'),
  route('GET', API_ROUTES.platformStatus, platformStatus, 'platform'),
  route('GET', API_ROUTES.mySchedule(WORKSPACE_ID), mySchedule, 'schedule'),
  route('POST', API_ROUTES.activitySync(WORKSPACE_ID), activitySync, 'sync'),
  route('GET', '/__mock/state', control.getState, null),
  route('POST', '/__mock/reset', control.reset, null),
  route('POST', '/__mock/failures', control.addFailure, null),
  route('PUT', '/__mock/schedule', control.setSchedule, null),
  route('PUT', '/__mock/platform', control.setPlatform, null),
  route('PUT', '/__mock/latest-version', control.setLatestVersion, null),
  route('PUT', '/__mock/user', control.setUserBehaviour, null),
  route('POST', '/__mock/sessions/revoke', control.revokeSessions, null),
  route('POST', '/__mock/sessions/expire-access', control.expireAccessTokens, null),
  route('POST', '/__mock/sync/reject', control.forceSyncReject, null),
]

export interface MockApiOptions {
  host?: string
  /** 0 picks a free port (tests). */
  port?: number
  /** Delay of every answer, to see loading states. */
  latencyMs?: number
  now?: () => Date
}

export interface MockApi {
  readonly state: MockState
  /** Base URL once started, for example http://127.0.0.1:4010 */
  readonly url: string
  start(): Promise<string>
  stop(): Promise<void>
}

/** Local mock of the 9 backend routes the desktop app uses, with the same JSON shapes. */
export function createMockApi(options: MockApiOptions = {}): MockApi {
  const host = options.host ?? MOCK_API_CONFIG.host
  const now = options.now ?? (() => new Date())
  const state = new MockState()
  let server: Server | null = null
  let url = ''

  const handle: Parameters<typeof createServer>[1] = (request, response) => {
    const path = new URL(request.url ?? '/', 'http://mock.local').pathname
    state.requestLog.push(`${request.method ?? ''} ${path}`)

    const run = async (): Promise<void> => {
      if (options.latencyMs) await new Promise((resolve) => setTimeout(resolve, options.latencyMs))
      const match = ROUTES.map((candidate) => ({ candidate, result: candidate.pattern.exec(path) }))
        .filter(({ result }) => result !== null)
        .find(({ candidate }) => candidate.method === request.method)
      if (!match?.result) {
        sendError(response, 404, `Cannot ${request.method ?? ''} ${path}`)
        return
      }
      const { candidate, result } = match
      if (candidate.name !== null) {
        const failure = state.takeFailure(candidate.name)
        if (failure) {
          sendError(response, failure.status, failure.message ?? errorText(failure.status), {
            ...(failure.code !== undefined ? { code: failure.code } : {}),
            ...(failure.retryAfterSeconds !== undefined
              ? { retryAfterSeconds: failure.retryAfterSeconds }
              : {}),
          })
          return
        }
      }
      const params: Record<string, string> = {}
      candidate.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(result[index + 1] ?? '')
      })
      await candidate.handler({ request, response, state, params, now })
    }

    run().catch((error: unknown) => {
      if (response.headersSent) {
        response.end()
        return
      }
      if (error instanceof BodyError) sendError(response, error.status, error.message)
      else sendError(response, 500, 'Internal server error')
    })
  }

  return {
    state,
    get url() {
      return url
    },
    start() {
      return new Promise((resolve, reject) => {
        const created = createServer(handle)
        created.once('error', reject)
        created.listen(options.port ?? MOCK_API_CONFIG.port, host, () => {
          const address = created.address()
          server = created
          url = `http://${host}:${typeof address === 'object' && address !== null ? address.port : ''}`
          resolve(url)
        })
      })
    },
    stop() {
      return new Promise((resolve, reject) => {
        if (!server) {
          resolve()
          return
        }
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
        server = null
      })
    },
  }
}
