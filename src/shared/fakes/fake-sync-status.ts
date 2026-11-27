import type { SyncStatus, SyncStatusSnapshot } from '../contracts/sync-status'

export interface FakeSyncStatusOptions {
  initial?: Partial<SyncStatusSnapshot>
  now?: () => Date
}

/** SyncStatus with settable values, for Bilal's tray until the real sync is merged. */
export class FakeSyncStatus implements SyncStatus {
  private snapshot: SyncStatusSnapshot
  private readonly listeners = new Set<(snapshot: SyncStatusSnapshot) => void>()
  private readonly now: () => Date
  /** How often syncNow was called (for tests). */
  syncNowCalls = 0

  constructor(options: FakeSyncStatusOptions = {}) {
    this.now = options.now ?? (() => new Date())
    this.snapshot = {
      online: true,
      lastSuccessAt: null,
      pendingCount: 0,
      lastError: null,
      ...options.initial,
    }
  }

  getSnapshot(): SyncStatusSnapshot {
    return { ...this.snapshot }
  }

  onChange(listener: (snapshot: SyncStatusSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Pretends an upload succeeded: no pending entries, no error. */
  syncNow(): void {
    this.syncNowCalls += 1
    this.update({ lastSuccessAt: this.now().toISOString(), pendingCount: 0, lastError: null })
  }

  /** Changes values and tells the listeners. */
  update(changes: Partial<SyncStatusSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes }
    const copy = this.getSnapshot()
    for (const listener of this.listeners) listener(copy)
  }
}
