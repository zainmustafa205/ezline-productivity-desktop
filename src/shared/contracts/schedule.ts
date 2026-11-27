/** Implemented by Bilal (src/main/core/), used by Wasi's sync. */
export interface ScheduleRefresher {
  /** GET /workspaces/:workspaceId/me/schedule with ETag; never throws. */
  refresh(workspaceId: string): Promise<void>
}

/** Implemented by Bilal (src/main/core/platform/), used by Wasi's sync. */
export interface PlatformStatusProvider {
  isMaintenance(): boolean
  /** features.ACTIVITY_SYNC */
  isSyncEnabled(): boolean
}
