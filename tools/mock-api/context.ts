import type { IncomingMessage, ServerResponse } from 'node:http'
import { BACKEND_ERROR_CODES } from '../../src/shared/contracts/api-types.ts'
import type { MockUser, MockWorkspace } from './fixtures.ts'
import { bearerToken, sendError } from './http.ts'
import type { MockState } from './state.ts'

export interface RouteContext {
  request: IncomingMessage
  response: ServerResponse
  state: MockState
  /** Path parameters, for example `workspaceId`. */
  params: Record<string, string>
  now: () => Date
}

export type RouteHandler = (context: RouteContext) => Promise<void> | void

/** Answers 401 and returns undefined when the access token is missing or invalid. */
export function requireUser(context: RouteContext): MockUser | undefined {
  const user = context.state.userOfAccessToken(bearerToken(context.request))
  if (!user || user.behaviour === 'SUSPENDED' || user.behaviour === 'PASSWORD_RESET_REQUIRED') {
    sendError(context.response, 401, 'Unauthorized')
    return undefined
  }
  return user
}

/** Answers 503 MAINTENANCE_MODE for the routes that maintenance mode blocks. */
export function blockedByMaintenance(context: RouteContext): boolean {
  const { maintenance } = context.state.platform
  if (!maintenance.enabled) return false
  sendError(context.response, 503, maintenance.message ?? 'The platform is under maintenance.', {
    code: BACKEND_ERROR_CODES.MAINTENANCE_MODE,
    retryAfterSeconds: maintenance.retryAfterSeconds ?? 60,
  })
  return true
}

/** Membership checks of workspace routes: member, then not suspended. */
export function requireWorkspace(context: RouteContext, user: MockUser): MockWorkspace | undefined {
  const workspaceId = context.params['workspaceId'] ?? ''
  const workspace = context.state.findWorkspace(workspaceId)
  const member = user.memberships.some((membership) => membership.workspaceId === workspaceId)
  if (!workspace || !member) {
    sendError(context.response, 403, 'You are not a member of this workspace.')
    return undefined
  }
  if (workspace.suspended) {
    sendError(context.response, 403, 'This workspace is suspended.', {
      code: BACKEND_ERROR_CODES.WORKSPACE_SUSPENDED,
    })
    return undefined
  }
  return workspace
}
