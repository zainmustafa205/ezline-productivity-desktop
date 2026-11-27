import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackerState, TrackingContext } from '../../src/shared/contracts/activity'
import { FakeTracker } from '../../src/shared/fakes/fake-tracker'
import { InMemoryStore } from '../../src/shared/fakes/in-memory-store'

const context: TrackingContext = {
  userId: 'user-a',
  workspaceId: 'ws-1',
  idleThresholdMinutes: 5,
  timezone: 'Asia/Karachi',
}

describe('FakeTracker', () => {
  let store: InMemoryStore
  let tracker: FakeTracker
  let ids = 0

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-24T09:00:00.000Z'))
    ids = 0
    store = new InMemoryStore()
    tracker = new FakeTracker({ store, intervalMs: 1_000, createId: () => `id-${++ids}` })
  })

  afterEach(() => {
    tracker.stop()
    vi.useRealTimers()
  })

  it('writes a new entry every interval with exactly one running entry', () => {
    tracker.start(context)
    vi.advanceTimersByTime(3_000)
    const entries = store.getAllEntries()
    expect(entries).toHaveLength(4)
    expect(entries.filter((entry) => entry.endTime === null)).toHaveLength(1)
    // Close and start use the same timestamp.
    expect(entries[0]?.endTime).toBe(entries[1]?.startTime)
    expect(new Set(entries.map((entry) => entry.clientEventId)).size).toBe(4)
  })

  it('reports state changes and pauses without an application', () => {
    const states: TrackerState[] = []
    tracker.onStateChange((state) => states.push(state))
    tracker.start(context)
    tracker.pause('MEETING')
    expect(store.getRunningEntry('user-a')).toMatchObject({
      status: 'MEETING',
      applicationName: null,
      windowTitle: null,
      domain: null,
    })
    tracker.resume()
    tracker.stop()
    expect(states).toEqual(['ACTIVE', 'PAUSED', 'ACTIVE', 'STOPPED'])
    expect(store.getRunningEntry('user-a')).toBeNull()
  })

  it('does not write entries while paused', () => {
    tracker.start(context)
    tracker.pause('BREAK')
    const count = store.getAllEntries().length
    vi.advanceTimersByTime(5_000)
    expect(store.getAllEntries()).toHaveLength(count)
  })

  it('splits the running entry into a new entry of the same kind', () => {
    tracker.start(context)
    const before = store.getRunningEntry('user-a')
    tracker.split('SCHEDULE_END')
    const after = store.getRunningEntry('user-a')
    expect(after?.clientEventId).not.toBe(before?.clientEventId)
    expect(after?.applicationName).toBe(before?.applicationName)
  })

  it('closes an entry left open by a crash before starting', () => {
    store.upsertEntry({
      clientEventId: 'old',
      userId: 'user-a',
      workspaceId: 'ws-1',
      status: 'ACTIVE',
      applicationName: 'Code',
      windowTitle: null,
      domain: null,
      startTime: '2026-11-24T08:00:00.000Z',
      endTime: null,
    })
    tracker.start(context)
    const old = store.getAllEntries().find((entry) => entry.clientEventId === 'old')
    expect(old?.endTime).toBe('2026-11-24T08:00:00.000Z')
  })

  it('keeps the idle threshold between 2 and 15 minutes', () => {
    tracker.setIdleThreshold(30)
    expect(tracker.getIdleThreshold()).toBe(15)
    tracker.setIdleThreshold(1)
    expect(tracker.getIdleThreshold()).toBe(2)
  })
})
