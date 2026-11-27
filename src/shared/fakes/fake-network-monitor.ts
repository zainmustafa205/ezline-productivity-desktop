import type { NetworkMonitor } from '../contracts/network'

/** NetworkMonitor with an online switch, for development and tests. */
export class FakeNetworkMonitor implements NetworkMonitor {
  private online: boolean
  private readonly listeners = new Set<(online: boolean) => void>()

  constructor(online = true) {
    this.online = online
  }

  isOnline(): boolean {
    return this.online
  }

  onChange(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Switches the state and tells the listeners when it changed. */
  setOnline(online: boolean): void {
    if (online === this.online) return
    this.online = online
    for (const listener of this.listeners) listener(online)
  }
}
