import { beforeEach, describe, expect, it } from 'vitest'
import type { ActivityEntry } from '../../src/shared/contracts/activity'
import { InMemoryStore } from '../../src/shared/fakes/in-memory-store'

let clock = new Date('2026-11-24T10:00:00.000Z')

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    clientEventId: 'e1',
    userId: 'user-a',
    workspaceId: 'ws-1',
    status: 'ACTIVE',
    applicationName: 'Code',
    windowTitle: 'file.ts',
    domain: null,
    startTime: '2026-11-24T09:00:00.000Z',
    endTime: '2026-11-24T09:10:00.000Z',
    ...overrides,
  }
}

describe('InMemoryStore', () => {
  let store: InMemoryStore

  beforeEach(() => {
    clock = new Date('2026-11-24T10:00:00.000Z')
    store = new InMemoryStore({ now: () => clock })
  })

  it('raises the revision on every change', () => {
    store.upsertEntry(entry({ endTime: null }))
    store.upsertEntry(entry())
    expect(store.getPendingBatch('user-a', 'ws-1', 10)).toEqual([{ entry: entry(), revision: 2 }])
  })

  it('marks an entry synced only when the revision is unchanged and it is closed', () => {
    store.upsertEntry(entry({ clientEventId: 'closed' }))
    store.upsertEntry(
      entry({ clientEventId: 'running', endTime: null, startTime: clock.toISOString() }),
    )
    store.markSynced([
      { clientEventId: 'closed', revision: 1 },
      { clientEventId: 'running', revision: 1 },
    ])
    expect(store.getSyncState('closed')).toBe('SYNCED')
    expect(store.getSyncState('running')).toBe('PENDING')

    store.upsertEntry(entry({ clientEventId: 'changed' }))
    store.upsertEntry(entry({ clientEventId: 'changed', endTime: '2026-11-24T09:20:00.000Z' }))
    store.markSynced([{ clientEventId: 'changed', revision: 1 }])
    expect(store.getSyncState('changed')).toBe('PENDING')
  })

  it('returns the oldest pending entries first plus the running entry, within the limit', () => {
    store.upsertEntry(entry({ clientEventId: 'b', startTime: '2026-11-24T09:05:00.000Z' }))
    store.upsertEntry(entry({ clientEventId: 'a', startTime: '2026-11-24T09:00:00.000Z' }))
    store.upsertEntry(entry({ clientEventId: 'c', startTime: '2026-11-24T09:06:00.000Z' }))
    store.upsertEntry(
      entry({ clientEventId: 'run', startTime: '2026-11-24T09:30:00.000Z', endTime: null }),
    )
    const ids = store.getPendingBatch('user-a', 'ws-1', 3).map((item) => item.entry.clientEventId)
    expect(ids).toEqual(['a', 'b', 'run'])
  })

  it('keeps users and workspaces apart', () => {
    store.upsertEntry(entry({ clientEventId: 'a1' }))
    store.upsertEntry(entry({ clientEventId: 'b1', userId: 'user-b' }))
    store.upsertEntry(entry({ clientEventId: 'a2', workspaceId: 'ws-2' }))
    expect(store.getPendingBatch('user-b', 'ws-1', 10).map((i) => i.entry.clientEventId)).toEqual([
      'b1',
    ])
    expect(store.countPending('user-a')).toBe(2)
    expect(store.countPending('user-a', 'ws-2')).toBe(1)
    expect(store.pendingWorkspaces('user-a').toSorted()).toEqual(['ws-1', 'ws-2'])
  })

  it('closes a stale running entry at its last touch time', () => {
    store.upsertEntry(entry({ endTime: null }))
    store.touchRunning('user-a', '2026-11-24T09:42:00.000Z')
    store.closeStaleRunningEntry('user-a')
    expect(store.getRunningEntry('user-a')).toBeNull()
    expect(store.getAllEntries()[0]?.endTime).toBe('2026-11-24T09:42:00.000Z')
  })

  it('purges only synced and rejected entries older than the given days', () => {
    store.upsertEntry(entry({ clientEventId: 'synced' }))
    store.upsertEntry(entry({ clientEventId: 'rejected' }))
    store.upsertEntry(entry({ clientEventId: 'pending' }))
    store.upsertEntry(entry({ clientEventId: 'running', endTime: null }))
    store.markSynced([{ clientEventId: 'synced', revision: 1 }])
    store.markRejected([{ clientEventId: 'rejected', code: 'TOO_OLD' }])

    clock = new Date('2026-12-02T10:00:00.000Z')
    store.purgeSynced(7)
    const ids = store.getAllEntries().map((item) => item.clientEventId)
    expect(ids.toSorted()).toEqual(['pending', 'running'])
  })

  it('sums the seconds of a status inside a UTC range', () => {
    store.upsertEntry(
      entry({
        status: 'BREAK',
        startTime: '2026-11-24T08:50:00.000Z',
        endTime: '2026-11-24T09:10:00.000Z',
      }),
    )
    expect(
      store.sumStatusSeconds(
        'user-a',
        'ws-1',
        'BREAK',
        '2026-11-24T09:00:00.000Z',
        '2026-11-24T10:00:00.000Z',
      ),
    ).toBe(600)
  })

  it('keeps schedules, settings and the sync log', () => {
    store.saveSchedule('user-a', 'ws-1', '"v1"', '{}')
    store.setSetting('installationId', 'abc')
    store.addSyncLog('ERROR', 'TOO_OLD', 'Entry rejected', 'ws-1')
    expect(store.getSchedule('user-a', 'ws-1')).toEqual({ etag: '"v1"', scheduleJson: '{}' })
    expect(store.getSchedule('user-b', 'ws-1')).toBeNull()
    expect(store.getSetting('installationId')).toBe('abc')
    expect(store.getSyncLog()).toHaveLength(1)
  })
})
