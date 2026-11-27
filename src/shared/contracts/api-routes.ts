/**
 * Paths of the backend routes the desktop app uses (no global prefix).
 * This file has no imports, so the mock API can load it directly with Node.js.
 */
export const API_ROUTES = {
  health: '/health',
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  myWorkspaces: '/workspaces/me',
  installations: '/desktop-app/installations',
  platformStatus: '/platform/status',
  mySchedule: (workspaceId: string): string =>
    `/workspaces/${encodeURIComponent(workspaceId)}/me/schedule`,
  activitySync: (workspaceId: string): string =>
    `/workspaces/${encodeURIComponent(workspaceId)}/activity/sync`,
} as const
