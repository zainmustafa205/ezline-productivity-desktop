export interface SyncStatusSnapshot {
  online: boolean
  /** ISO 8601 UTC of the last successful sync. */
  lastSuccessAt: string | null
  pendingCount: number
  /** Plain words for the user. */
  lastError: string | null
}

/** Implemented by Wasi (src/main/sync/), used by Bilal's tray and controller. */
export interface SyncStatus {
  getSnapshot(): SyncStatusSnapshot
  /** Returns a function that removes the listener. */
  onChange(listener: (snapshot: SyncStatusSnapshot) => void): () => void
  /** After Stop, and when the connection comes back. */
  syncNow(): void
}
