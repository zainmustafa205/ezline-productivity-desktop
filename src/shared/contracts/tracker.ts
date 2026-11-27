import type { PauseStatus, SplitReason, TrackerState, TrackingContext } from './activity'

/**
 * Activity tracker. Implemented by Wasi (src/main/tracking/), used by Bilal's
 * tracking controller. The tracker never decides by itself when work hours
 * start or end, or whether a break is allowed.
 */
export interface ActivityTracker {
  /** Begins window and idle watching. Closes an entry left open by a crash first. */
  start(context: TrackingContext): void
  /** Closes the running entry; state STOPPED. */
  stop(): void
  /** Closes the running entry and starts a pause entry. */
  pause(status: PauseStatus): void
  /** Closes the pause entry and starts ACTIVE. */
  resume(): void
  /** Closes the running entry and starts the same kind again. */
  split(reason: SplitReason): void
  setIdleThreshold(minutes: number): void
  getState(): TrackerState
  /** Returns a function that removes the listener. */
  onStateChange(listener: (state: TrackerState) => void): () => void
}
