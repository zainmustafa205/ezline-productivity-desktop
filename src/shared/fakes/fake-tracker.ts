import { TRACKING_CONFIG } from '../config/app-config'
import type {
  ActivityEntry,
  ActivityStatus,
  PauseStatus,
  SplitReason,
  TrackerState,
  TrackingContext,
} from '../contracts/activity'
import type { LocalStore } from '../contracts/store'
import type { ActivityTracker } from '../contracts/tracker'

interface FakeWindow {
  status: ActivityStatus
  applicationName: string | null
  windowTitle: string | null
  domain: string | null
}

/** Sample data only. The cycle includes an IDLE step so every tray color can be seen. */
const FAKE_WINDOWS: readonly FakeWindow[] = [
  {
    status: 'ACTIVE',
    applicationName: 'Visual Studio Code',
    windowTitle: 'index.ts - desktop',
    domain: null,
  },
  {
    status: 'ACTIVE',
    applicationName: 'Google Chrome',
    windowTitle: 'Pull requests',
    domain: 'github.com',
  },
  {
    status: 'ACTIVE',
    applicationName: 'Microsoft Teams',
    windowTitle: 'Daily stand-up',
    domain: null,
  },
  { status: 'IDLE', applicationName: null, windowTitle: null, domain: null },
]

export interface FakeTrackerOptions {
  store: LocalStore
  /** A new fake entry is written every interval. */
  intervalMs?: number
  now?: () => Date
  createId?: () => string
}

/**
 * ActivityTracker that writes a new fake entry every few seconds, with the
 * same entry rules as the real tracker (one running entry, close and start at
 * the same timestamp, a new UUID per entry). For development and tests only.
 */
export class FakeTracker implements ActivityTracker {
  private readonly store: LocalStore
  private readonly intervalMs: number
  private readonly now: () => Date
  private readonly createId: () => string
  private readonly listeners = new Set<(state: TrackerState) => void>()
  private state: TrackerState = 'STOPPED'
  private context: TrackingContext | null = null
  private running: ActivityEntry | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private step = 0
  private idleThresholdMinutes: number = TRACKING_CONFIG.defaultIdleThresholdMinutes

  constructor(options: FakeTrackerOptions) {
    this.store = options.store
    this.intervalMs = options.intervalMs ?? 5_000
    this.now = options.now ?? (() => new Date())
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID())
  }

  start(context: TrackingContext): void {
    if (this.state !== 'STOPPED') this.stop()
    this.context = { ...context }
    this.setIdleThreshold(context.idleThresholdMinutes)
    this.store.closeStaleRunningEntry(context.userId)
    this.step = 0
    this.openEntry(this.timestamp(), FAKE_WINDOWS[0] ?? idleWindow())
    this.startTicking()
  }

  stop(): void {
    if (this.state === 'STOPPED') return
    this.stopTicking()
    this.closeRunning(this.timestamp())
    this.setState('STOPPED')
  }

  pause(status: PauseStatus): void {
    if (this.state === 'STOPPED') return
    this.stopTicking()
    const at = this.timestamp()
    this.closeRunning(at)
    this.openEntry(at, { status, applicationName: null, windowTitle: null, domain: null })
  }

  resume(): void {
    if (this.state !== 'PAUSED') return
    const at = this.timestamp()
    this.closeRunning(at)
    this.step = 0
    this.openEntry(at, FAKE_WINDOWS[0] ?? idleWindow())
    this.startTicking()
  }

  split(_reason: SplitReason): void {
    const current = this.running
    if (!current) return
    const at = this.timestamp()
    this.closeRunning(at)
    this.openEntry(at, {
      status: current.status,
      applicationName: current.applicationName,
      windowTitle: current.windowTitle,
      domain: current.domain,
    })
  }

  setIdleThreshold(minutes: number): void {
    this.idleThresholdMinutes = Math.min(
      TRACKING_CONFIG.maxIdleThresholdMinutes,
      Math.max(TRACKING_CONFIG.minIdleThresholdMinutes, minutes),
    )
  }

  getState(): TrackerState {
    return this.state
  }

  onStateChange(listener: (state: TrackerState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Helper of the fake: the threshold after clamping to 2 to 15 minutes. */
  getIdleThreshold(): number {
    return this.idleThresholdMinutes
  }

  private tick(): void {
    if (!this.context) return
    const at = this.timestamp()
    this.store.touchRunning(this.context.userId, at)
    this.step = (this.step + 1) % FAKE_WINDOWS.length
    this.closeRunning(at)
    this.openEntry(at, FAKE_WINDOWS[this.step] ?? idleWindow())
  }

  private openEntry(at: string, window: FakeWindow): void {
    if (!this.context) return
    const entry: ActivityEntry = {
      clientEventId: this.createId(),
      userId: this.context.userId,
      workspaceId: this.context.workspaceId,
      status: window.status,
      applicationName: window.applicationName,
      windowTitle: window.windowTitle,
      domain: window.domain,
      startTime: at,
      endTime: null,
    }
    this.store.upsertEntry(entry)
    this.running = entry
    this.setState(stateOf(window.status))
  }

  private closeRunning(at: string): void {
    if (!this.running) return
    this.store.upsertEntry({ ...this.running, endTime: at })
    this.running = null
  }

  private startTicking(): void {
    this.stopTicking()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  private stopTicking(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private setState(state: TrackerState): void {
    if (state === this.state) return
    this.state = state
    for (const listener of this.listeners) listener(state)
  }

  private timestamp(): string {
    return this.now().toISOString()
  }
}

function stateOf(status: ActivityStatus): TrackerState {
  if (status === 'ACTIVE') return 'ACTIVE'
  if (status === 'IDLE') return 'IDLE'
  return 'PAUSED'
}

function idleWindow(): FakeWindow {
  return { status: 'IDLE', applicationName: null, windowTitle: null, domain: null }
}
