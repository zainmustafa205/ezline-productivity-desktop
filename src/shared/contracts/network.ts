/** Connection state. Implemented by Wasi (src/main/storage/), used by Bilal's tray and controller. */
export interface NetworkMonitor {
  isOnline(): boolean
  /** Returns a function that removes the listener. */
  onChange(listener: (online: boolean) => void): () => void
}
