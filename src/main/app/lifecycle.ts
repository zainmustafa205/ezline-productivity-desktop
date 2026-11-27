import { app } from 'electron'

let quitting = false

/**
 * Tracks whether the user chose "Quit". Until then closing a window only hides
 * it and the application keeps running in the tray (SRS 4.2.6 FR-04).
 */
export function watchQuitting(): void {
  app.on('before-quit', () => {
    quitting = true
  })
}

export function isQuitting(): boolean {
  return quitting
}

/**
 * Takes the single instance lock. A second start of the application only
 * calls `onSecondInstance` in the running one. Returns false in the second one,
 * which must quit at once.
 */
export function acquireSingleInstance(onSecondInstance: () => void): boolean {
  if (!app.requestSingleInstanceLock()) return false
  app.on('second-instance', onSecondInstance)
  return true
}
