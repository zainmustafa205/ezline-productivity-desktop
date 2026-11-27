import type { ActivityEntry, ActivityStatus } from './activity'

export interface PendingEntry {
  entry: ActivityEntry
  /** Raised on every change of the entry; the sync sends it back to markSynced. */
  revision: number
}

export type SyncState = 'PENDING' | 'SYNCED' | 'REJECTED'

export type SyncLogLevel = 'INFO' | 'WARN' | 'ERROR'

/**
 * Local store on the computer. Implemented by Wasi (src/main/storage/), used by
 * the tracker, the sync and Bilal's core. Every method is synchronous.
 */
export interface LocalStore {
  /** Inserts or updates an entry; every change raises the revision. */
  upsertEntry(entry: ActivityEntry): void
  /** Last time the running entry was seen alive. */
  touchRunning(userId: string, at: string): void
  getRunningEntry(userId: string): ActivityEntry | null
  /** After a crash: ends the running entry at its last touch time. */
  closeStaleRunningEntry(userId: string): void
  /** Oldest pending entries first, at most `limit`, plus the running entry of that user and workspace. */
  getPendingBatch(userId: string, workspaceId: string, limit: number): PendingEntry[]
  /** Marks SYNCED only if the revision is unchanged and the entry has an endTime. */
  markSynced(items: { clientEventId: string; revision: number }[]): void
  markRejected(items: { clientEventId: string; code: string }[]): void
  countPending(userId: string, workspaceId?: string): number
  /** Workspaces that still have unsent entries of this user. */
  pendingWorkspaces(userId: string): string[]
  /** Seconds of entries with this status that overlap the UTC range. */
  sumStatusSeconds(
    userId: string,
    workspaceId: string,
    status: ActivityStatus,
    fromUtc: string,
    toUtc: string,
  ): number
  /** Deletes SYNCED and REJECTED entries older than the given days; never PENDING or running entries. */
  purgeSynced(olderThanDays: number): void
  saveSchedule(userId: string, workspaceId: string, etag: string, scheduleJson: string): void
  getSchedule(userId: string, workspaceId: string): { etag: string; scheduleJson: string } | null
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void
  addSyncLog(level: SyncLogLevel, code: string, message: string, workspaceId?: string): void
}
