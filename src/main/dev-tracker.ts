import { app } from 'electron'
import { DEV_TRACKER_CONFIG, TRACKING_CONFIG } from '../shared/config/app-config'
import type { ActivityEntry } from '../shared/contracts/activity'
import { InMemoryStore } from '../shared/fakes/in-memory-store'
import { createLogger } from './app/logger'
import { createActivityTracker } from './tracking'

/*
 * Test harness `npm run dev:tracker` (owner: Zain).
 * Runs the tracker alone with InMemoryStore, without windows and without the
 * backend, and prints every entry to this console. Entries are never written
 * to a log file. Stop it with Ctrl+C.
 */

function clockTime(iso: string | null): string {
  return iso === null ? 'running ' : iso.slice(11, 19)
}

function formatEntry(entry: ActivityEntry, revision: number): string {
  const seconds =
    entry.endTime === null
      ? ''
      : ` ${Math.round((Date.parse(entry.endTime) - Date.parse(entry.startTime)) / 1000)}s`
  const what = [entry.applicationName, entry.domain, entry.windowTitle]
    .filter((part) => part !== null)
    .join(' | ')
  return `${clockTime(entry.startTime)} -> ${clockTime(entry.endTime)}${seconds}  ${entry.status.padEnd(13)} rev ${revision}  ${what}`
}

function main(): void {
  const logger = createLogger({ directory: null, minLevel: 'info', console: true })
  const store = new InMemoryStore()
  const tracker = createActivityTracker({ store, logger: logger.child('tracking') })

  store.onEntryUpserted((entry, revision) => console.info(formatEntry(entry, revision)))
  tracker.onStateChange((state) => console.info(`state: ${state}`))

  let stopped = false
  const stop = (): void => {
    if (stopped) return
    stopped = true
    tracker.stop()
    const entries = store.getAllEntries()
    console.info(`Stopped. ${entries.length} entries recorded.`)
    app.quit()
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  console.info('Tracker harness started (times in UTC). Press Ctrl+C to stop.')
  tracker.start({
    userId: DEV_TRACKER_CONFIG.userId,
    workspaceId: DEV_TRACKER_CONFIG.workspaceId,
    idleThresholdMinutes: TRACKING_CONFIG.defaultIdleThresholdMinutes,
    timezone: DEV_TRACKER_CONFIG.timezone,
  })
}

app.on('window-all-closed', () => undefined)
app
  .whenReady()
  .then(main)
  .catch((error: unknown) => {
    console.error('The tracker harness could not start.', String(error))
    app.exit(1)
  })
