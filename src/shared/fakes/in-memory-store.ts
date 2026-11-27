import type { ActivityEntry, ActivityStatus } from '../contracts/activity'
import type { LocalStore, PendingEntry, SyncLogLevel, SyncState } from '../contracts/store'

interface StoredEntry {
  entry: ActivityEntry
  revision: number
  syncState: SyncState
  lastSeenAt: string
  rejectCode: string | null
  /** When the entry became SYNCED or REJECTED; used by purgeSynced. */
  settledAt: string | null
}

export interface SyncLogRecord {
  at: string
  level: SyncLogLevel
  code: string
  message: string
  workspaceId: string | null
}

export interface InMemoryStoreOptions {
  now?: () => Date
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * LocalStore kept in memory, with the same rules as the real SQLite store:
 * revisions, the markSynced rule, user separation and a purge that never
 * deletes pending or running entries. For development and tests only.
 */
export class InMemoryStore implements LocalStore {
  private readonly entries = new Map<string, StoredEntry>()
  private readonly schedules = new Map<string, { etag: string; scheduleJson: string }>()
  private readonly settings = new Map<string, string>()
  private readonly syncLog: SyncLogRecord[] = []
  private readonly upsertListeners = new Set<(entry: ActivityEntry, revision: number) => void>()
  private readonly now: () => Date

  constructor(options: InMemoryStoreOptions = {}) {
    this.now = options.now ?? (() => new Date())
  }

  upsertEntry(entry: ActivityEntry): void {
    const copy = { ...entry }
    const existing = this.entries.get(entry.clientEventId)
    const stored: StoredEntry = existing
      ? {
          ...existing,
          entry: copy,
          revision: existing.revision + 1,
          syncState: 'PENDING',
          rejectCode: null,
          settledAt: null,
        }
      : {
          entry: copy,
          revision: 1,
          syncState: 'PENDING',
          lastSeenAt: entry.startTime,
          rejectCode: null,
          settledAt: null,
        }
    this.entries.set(entry.clientEventId, stored)
    for (const listener of this.upsertListeners) listener({ ...copy }, stored.revision)
  }

  touchRunning(userId: string, at: string): void {
    const running = this.findRunning(userId)
    if (running) running.lastSeenAt = at
  }

  getRunningEntry(userId: string): ActivityEntry | null {
    const running = this.findRunning(userId)
    return running ? { ...running.entry } : null
  }

  closeStaleRunningEntry(userId: string): void {
    const running = this.findRunning(userId)
    if (!running) return
    this.upsertEntry({ ...running.entry, endTime: running.lastSeenAt })
  }

  getPendingBatch(userId: string, workspaceId: string, limit: number): PendingEntry[] {
    if (limit <= 0) return []
    const pending = [...this.entries.values()].filter(
      (stored) =>
        stored.syncState === 'PENDING' &&
        stored.entry.userId === userId &&
        stored.entry.workspaceId === workspaceId,
    )
    const running = pending.find((stored) => stored.entry.endTime === null)
    const closed = pending
      .filter((stored) => stored.entry.endTime !== null)
      .toSorted((a, b) => a.entry.startTime.localeCompare(b.entry.startTime))
      .slice(0, running ? limit - 1 : limit)
    const batch = running ? [...closed, running] : closed
    return batch.map((stored) => ({ entry: { ...stored.entry }, revision: stored.revision }))
  }

  markSynced(items: { clientEventId: string; revision: number }[]): void {
    const at = this.now().toISOString()
    for (const item of items) {
      const stored = this.entries.get(item.clientEventId)
      if (!stored || stored.revision !== item.revision || stored.entry.endTime === null) continue
      stored.syncState = 'SYNCED'
      stored.settledAt = at
    }
  }

  markRejected(items: { clientEventId: string; code: string }[]): void {
    const at = this.now().toISOString()
    for (const item of items) {
      const stored = this.entries.get(item.clientEventId)
      if (!stored) continue
      stored.syncState = 'REJECTED'
      stored.rejectCode = item.code
      stored.settledAt = at
    }
  }

  countPending(userId: string, workspaceId?: string): number {
    let count = 0
    for (const stored of this.entries.values()) {
      if (
        stored.syncState === 'PENDING' &&
        stored.entry.userId === userId &&
        (workspaceId === undefined || stored.entry.workspaceId === workspaceId)
      ) {
        count += 1
      }
    }
    return count
  }

  pendingWorkspaces(userId: string): string[] {
    const workspaces = new Set<string>()
    for (const stored of this.entries.values()) {
      if (stored.syncState === 'PENDING' && stored.entry.userId === userId) {
        workspaces.add(stored.entry.workspaceId)
      }
    }
    return [...workspaces]
  }

  sumStatusSeconds(
    userId: string,
    workspaceId: string,
    status: ActivityStatus,
    fromUtc: string,
    toUtc: string,
  ): number {
    const from = Date.parse(fromUtc)
    const to = Date.parse(toUtc)
    const nowMs = this.now().getTime()
    let totalMs = 0
    for (const { entry } of this.entries.values()) {
      if (entry.userId !== userId || entry.workspaceId !== workspaceId || entry.status !== status) {
        continue
      }
      const start = Math.max(Date.parse(entry.startTime), from)
      const end = Math.min(entry.endTime === null ? nowMs : Date.parse(entry.endTime), to)
      if (end > start) totalMs += end - start
    }
    return Math.floor(totalMs / 1000)
  }

  purgeSynced(olderThanDays: number): void {
    const cutoff = this.now().getTime() - olderThanDays * DAY_MS
    for (const [id, stored] of this.entries) {
      const settled = stored.syncState === 'SYNCED' || stored.syncState === 'REJECTED'
      if (
        settled &&
        stored.entry.endTime !== null &&
        stored.settledAt !== null &&
        Date.parse(stored.settledAt) < cutoff
      ) {
        this.entries.delete(id)
      }
    }
  }

  saveSchedule(userId: string, workspaceId: string, etag: string, scheduleJson: string): void {
    this.schedules.set(scheduleKey(userId, workspaceId), { etag, scheduleJson })
  }

  getSchedule(userId: string, workspaceId: string): { etag: string; scheduleJson: string } | null {
    const schedule = this.schedules.get(scheduleKey(userId, workspaceId))
    return schedule ? { ...schedule } : null
  }

  getSetting(key: string): string | null {
    return this.settings.get(key) ?? null
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, value)
  }

  addSyncLog(level: SyncLogLevel, code: string, message: string, workspaceId?: string): void {
    this.syncLog.push({
      at: this.now().toISOString(),
      level,
      code,
      message,
      workspaceId: workspaceId ?? null,
    })
  }

  /* Helpers of the fake (not part of LocalStore) */

  /** Called after every upsert; used by `npm run dev:tracker` to print entries. */
  onEntryUpserted(listener: (entry: ActivityEntry, revision: number) => void): () => void {
    this.upsertListeners.add(listener)
    return () => this.upsertListeners.delete(listener)
  }

  getAllEntries(): ActivityEntry[] {
    return [...this.entries.values()].map((stored) => structuredClone(stored.entry))
  }

  getSyncState(clientEventId: string): SyncState | null {
    return this.entries.get(clientEventId)?.syncState ?? null
  }

  getSyncLog(): SyncLogRecord[] {
    return structuredClone(this.syncLog)
  }

  private findRunning(userId: string): StoredEntry | undefined {
    for (const stored of this.entries.values()) {
      if (stored.entry.userId === userId && stored.entry.endTime === null) return stored
    }
    return undefined
  }
}

function scheduleKey(userId: string, workspaceId: string): string {
  return `${userId}\u0000${workspaceId}`
}
