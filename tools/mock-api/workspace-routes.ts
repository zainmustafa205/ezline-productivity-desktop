import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import type { WorkspaceMembership } from '../../src/shared/contracts/api-types.ts'
import { APP_VERSION_PATTERN } from '../../src/shared/contracts/api-types.ts'
import type { RouteHandler } from './context.ts'
import { blockedByMaintenance, requireUser, requireWorkspace } from './context.ts'
import { buildSchedule } from './fixtures.ts'
import {
  isRecord,
  readJsonBody,
  sendError,
  sendNotModified,
  sendSuccess,
  unknownFields,
} from './http.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** GET /health */
export const health: RouteHandler = ({ response }) => {
  sendSuccess(response, 200, 'Success.', {
    status: 'ok',
    info: { database: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' } },
  })
}

/** GET /platform/status (public, works during maintenance). */
export const platformStatus: RouteHandler = ({ response, state }) => {
  sendSuccess(
    response,
    200,
    'Platform status retrieved successfully.',
    structuredClone(state.platform),
  )
}

/** GET /workspaces/me */
export const myWorkspaces: RouteHandler = (context) => {
  if (blockedByMaintenance(context)) return
  const user = requireUser(context)
  if (!user) return
  const list: WorkspaceMembership[] = user.memberships.flatMap((membership) => {
    const workspace = context.state.findWorkspace(membership.workspaceId)
    return workspace
      ? [
          {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            role: membership.role,
            suspended: workspace.suspended,
          },
        ]
      : []
  })
  sendSuccess(context.response, 200, 'Your workspaces retrieved successfully', list)
}

/** POST /desktop-app/installations */
export const installations: RouteHandler = async (context) => {
  if (blockedByMaintenance(context)) return
  const user = requireUser(context)
  if (!user) return
  const body = await readJsonBody(context.request, MOCK_API_CONFIG.bodyLimitBytes)
  if (!isRecord(body)) {
    sendError(context.response, 400, ['installationId must be a UUID'])
    return
  }
  const errors = unknownFields(body, ['installationId', 'appVersion', 'platform'])
  const { installationId, appVersion, platform } = body
  if (typeof installationId !== 'string' || !UUID_PATTERN.test(installationId)) {
    errors.push('installationId must be a UUID')
  }
  if (typeof appVersion !== 'string' || !APP_VERSION_PATTERN.test(appVersion)) {
    errors.push('appVersion must match the version format')
  }
  if (platform !== 'WINDOWS') errors.push('platform must be one of the following values: WINDOWS')
  if (errors.length > 0 || typeof installationId !== 'string' || typeof appVersion !== 'string') {
    sendError(context.response, 400, errors)
    return
  }

  const now = context.now().toISOString()
  const key = `${user.id}|${installationId}`
  const existing = context.state.installations.get(key)
  const stored = {
    userId: user.id,
    installationId,
    appVersion,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
  }
  context.state.installations.set(key, stored)
  sendSuccess(context.response, 200, 'Installation registered', {
    latestVersion: context.state.latestVersion,
    firstSeenAt: stored.firstSeenAt,
    lastSeenAt: stored.lastSeenAt,
    appVersion: stored.appVersion,
    installationId: stored.installationId,
    status: 'INSTALLED',
  })
}

/** GET /workspaces/:workspaceId/me/schedule with ETag and 304. */
export const mySchedule: RouteHandler = (context) => {
  if (blockedByMaintenance(context)) return
  const user = requireUser(context)
  if (!user) return
  const workspace = requireWorkspace(context, user)
  if (!workspace) return

  const { preset, revision } = context.state.schedulePreset(workspace.id)
  const version = `${preset}-${revision}`
  const etag = `"${version}"`
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' }
  if (context.request.headers['if-none-match'] === etag) {
    sendNotModified(context.response, etag)
    return
  }
  sendSuccess(
    context.response,
    200,
    'Schedule retrieved successfully',
    buildSchedule(workspace.id, preset, version, context.now()),
    headers,
  )
}
