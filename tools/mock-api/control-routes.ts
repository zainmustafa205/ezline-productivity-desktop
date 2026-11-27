import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import { APP_VERSION_PATTERN } from '../../src/shared/contracts/api-types.ts'
import type { RouteHandler } from './context.ts'
import { LOGIN_BEHAVIOURS, SCHEDULE_PRESETS, isSchedulePreset } from './fixtures.ts'
import type { LoginBehaviour } from './fixtures.ts'
import { isRecord, readJsonBody, sendError, sendSuccess } from './http.ts'
import { ROUTE_NAMES } from './state.ts'
import type { InjectedFailure, RouteName } from './state.ts'
import { isSyncRejectCode } from './sync-route.ts'

/*
 * Control routes under /__mock/ switch the mock's behaviour for manual tests
 * and unit tests. They exist only in the mock, never in the real backend.
 */

async function readObject(
  context: Parameters<RouteHandler>[0],
): Promise<Record<string, unknown> | null> {
  const body = await readJsonBody(context.request, MOCK_API_CONFIG.bodyLimitBytes)
  if (isRecord(body)) return body
  sendError(context.response, 400, 'A JSON object body is required.')
  return null
}

const FEATURE_KEYS = [
  'AI_CLASSIFICATION',
  'ACTIVITY_SYNC',
  'OFFLINE_MODE',
  'REPORT_GENERATION',
] as const

function isRouteTarget(value: unknown): value is RouteName | '*' {
  return value === '*' || ROUTE_NAMES.some((name) => name === value)
}

function isLoginBehaviour(value: unknown): value is LoginBehaviour {
  return LOGIN_BEHAVIOURS.some((behaviour) => behaviour === value)
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** GET /__mock/state */
export const getState: RouteHandler = ({ response, state }) => {
  sendSuccess(response, 200, 'Mock state.', {
    platform: state.platform,
    latestVersion: state.latestVersion,
    failures: state.failures,
    forcedRejects: state.forcedRejects,
    schedules: Object.fromEntries(state.schedules),
    users: state.users.map((user) => ({ email: user.email, behaviour: user.behaviour })),
    installations: [...state.installations.values()],
    syncEntries: [...state.syncEntries.values()],
    requestLog: state.requestLog.slice(-100),
  })
}

/** POST /__mock/reset */
export const reset: RouteHandler = ({ response, state }) => {
  state.reset()
  sendSuccess(response, 200, 'Mock state reset.')
}

/** POST /__mock/failures { route, status, code?, message?, retryAfterSeconds?, times? } */
export const addFailure: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const route = body['route']
  const status = body['status']
  if (!isRouteTarget(route)) {
    sendError(context.response, 400, `route must be "*" or one of: ${ROUTE_NAMES.join(', ')}`)
    return
  }
  if (typeof status !== 'number' || status < 400 || status > 599) {
    sendError(context.response, 400, 'status must be an HTTP error status (400 to 599).')
    return
  }
  const retryAfterSeconds = optionalNumber(body['retryAfterSeconds'])
  const failure: InjectedFailure = {
    route,
    status,
    remaining: Math.max(1, Math.floor(optionalNumber(body['times']) ?? 1)),
    ...(typeof body['code'] === 'string' ? { code: body['code'] } : {}),
    ...(typeof body['message'] === 'string' ? { message: body['message'] } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  }
  context.state.failures.push(failure)
  sendSuccess(context.response, 201, 'Failure added.', failure)
}

/** PUT /__mock/schedule { workspaceId, preset } */
export const setSchedule: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const workspaceId = body['workspaceId']
  const preset = body['preset']
  if (typeof workspaceId !== 'string' || !context.state.findWorkspace(workspaceId)) {
    sendError(context.response, 400, 'workspaceId must be a mock workspace id.')
    return
  }
  if (!isSchedulePreset(preset)) {
    sendError(context.response, 400, `preset must be one of: ${SCHEDULE_PRESETS.join(', ')}`)
    return
  }
  context.state.setSchedulePreset(workspaceId, preset)
  sendSuccess(context.response, 200, 'Schedule changed.', context.state.schedulePreset(workspaceId))
}

/** PUT /__mock/platform { maintenance?: {...}, features?: {...} } */
export const setPlatform: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const { maintenance, features } = body
  const platform = context.state.platform
  if (isRecord(maintenance)) {
    if (typeof maintenance['enabled'] === 'boolean') {
      platform.maintenance.enabled = maintenance['enabled']
    }
    if (typeof maintenance['message'] === 'string' || maintenance['message'] === null) {
      platform.maintenance.message = maintenance['message']
    }
    if (typeof maintenance['endsAt'] === 'string' || maintenance['endsAt'] === null) {
      platform.maintenance.endsAt = maintenance['endsAt']
    }
    const retry = optionalNumber(maintenance['retryAfterSeconds'])
    if (retry !== undefined || maintenance['retryAfterSeconds'] === null) {
      platform.maintenance.retryAfterSeconds = retry ?? null
    }
  }
  if (isRecord(features)) {
    for (const key of FEATURE_KEYS) {
      const value = features[key]
      if (typeof value === 'boolean') platform.features[key] = value
    }
  }
  sendSuccess(context.response, 200, 'Platform status changed.', platform)
}

/** PUT /__mock/latest-version { latestVersion: string | null } */
export const setLatestVersion: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const value = body['latestVersion']
  if (value !== null && (typeof value !== 'string' || !APP_VERSION_PATTERN.test(value))) {
    sendError(context.response, 400, 'latestVersion must be a version such as 1.2.3, or null.')
    return
  }
  context.state.latestVersion = value
  sendSuccess(context.response, 200, 'Latest version changed.', { latestVersion: value })
}

/** PUT /__mock/user { email, behaviour } */
export const setUserBehaviour: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const behaviour = body['behaviour']
  if (!isLoginBehaviour(behaviour)) {
    sendError(context.response, 400, `behaviour must be one of: ${LOGIN_BEHAVIOURS.join(', ')}`)
    return
  }
  const email = typeof body['email'] === 'string' ? body['email'] : ''
  if (!context.state.setBehaviour(email, behaviour)) {
    sendError(context.response, 404, 'Unknown mock account.')
    return
  }
  sendSuccess(context.response, 200, 'Account behaviour changed.')
}

/** POST /__mock/sessions/revoke { email } ("log out of all devices") */
export const revokeSessions: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const user = context.state.findUserByEmail(typeof body['email'] === 'string' ? body['email'] : '')
  if (!user) {
    sendError(context.response, 404, 'Unknown mock account.')
    return
  }
  context.state.revokeUserSessions(user.id)
  sendSuccess(context.response, 200, 'Sessions revoked.')
}

/** POST /__mock/sessions/expire-access (every access token becomes invalid) */
export const expireAccessTokens: RouteHandler = ({ response, state }) => {
  state.expireAccessTokens()
  sendSuccess(response, 200, 'Access tokens expired.')
}

/** POST /__mock/sync/reject { code, count? } rejects the next entries with this code. */
export const forceSyncReject: RouteHandler = async (context) => {
  const body = await readObject(context)
  if (!body) return
  const code = body['code']
  if (!isSyncRejectCode(code)) {
    sendError(context.response, 400, 'code must be a sync reject code.')
    return
  }
  const remaining = Math.max(1, Math.floor(optionalNumber(body['count']) ?? 1))
  context.state.forcedRejects.push({ code, remaining })
  sendSuccess(context.response, 201, 'Forced reject added.', { code, remaining })
}
