import { Menu, Tray, nativeImage } from 'electron'
import type { MenuItemConstructorOptions, NativeImage } from 'electron'
import { APP_CONFIG, DEV_TRACKER_CONFIG, TRACKING_CONFIG } from '../../shared/config/app-config'
import { TRAY_STATE_COLORS } from '../../shared/config/theme'
import type { TrackerState } from '../../shared/contracts/activity'
import type { ActivityTracker } from '../../shared/contracts/tracker'
import type { SyncStatus } from '../../shared/contracts/sync-status'
import type { FakeNetworkMonitor } from '../../shared/fakes/fake-network-monitor'
import { drawStatusIconPng } from './tray-icon'

/**
 * Development tray, used until Bilal's tray (src/main/core/tray/) is merged in
 * Chat 17b. It drives the fake modules so the wiring can be seen working.
 */
export interface DevTrayDependencies {
  tracker: ActivityTracker
  syncStatus: SyncStatus
  network: FakeNetworkMonitor
  openStatusWindow: () => void
  quit: () => void
}

const STATE_LABELS: Record<TrackerState, string> = {
  STOPPED: 'Stopped',
  ACTIVE: 'Active',
  IDLE: 'Idle',
  PAUSED: 'Paused',
}

export function createDevTray(deps: DevTrayDependencies): Tray {
  const icons = createStateIcons()
  const tray = new Tray(icons.STOPPED)

  const refresh = (): void => {
    const state = deps.tracker.getState()
    tray.setImage(icons[state])
    tray.setToolTip(`${APP_CONFIG.productName}: ${STATE_LABELS[state]} (development data)`)
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(deps, state)))
  }

  deps.tracker.onStateChange(refresh)
  deps.syncStatus.onChange(refresh)
  deps.network.onChange(refresh)
  refresh()
  return tray
}

function menuTemplate(
  deps: DevTrayDependencies,
  state: TrackerState,
): MenuItemConstructorOptions[] {
  const sync = deps.syncStatus.getSnapshot()
  const lastSync = sync.lastSuccessAt ? new Date(sync.lastSuccessAt).toLocaleTimeString() : 'Never'

  return [
    { label: `Status: ${STATE_LABELS[state]}`, enabled: false },
    { label: 'Development mode: fake modules', enabled: false },
    { type: 'separator' },
    {
      label: 'Start tracking',
      visible: state === 'STOPPED',
      click: () =>
        deps.tracker.start({
          userId: DEV_TRACKER_CONFIG.userId,
          workspaceId: DEV_TRACKER_CONFIG.workspaceId,
          idleThresholdMinutes: TRACKING_CONFIG.defaultIdleThresholdMinutes,
          timezone: DEV_TRACKER_CONFIG.timezone,
        }),
    },
    {
      label: 'Pause (Break)',
      visible: state === 'ACTIVE' || state === 'IDLE',
      click: () => deps.tracker.pause('BREAK'),
    },
    { label: 'Resume', visible: state === 'PAUSED', click: () => deps.tracker.resume() },
    {
      label: 'Stop tracking',
      visible: state !== 'STOPPED',
      click: () => {
        deps.tracker.stop()
        deps.syncStatus.syncNow()
      },
    },
    { type: 'separator' },
    { label: sync.online ? 'Online' : 'Offline Mode', enabled: false },
    { label: `Last sync: ${lastSync}`, enabled: false },
    { label: `Pending entries: ${sync.pendingCount}`, enabled: false },
    {
      label: deps.network.isOnline() ? 'Simulate offline' : 'Simulate online',
      click: () => deps.network.setOnline(!deps.network.isOnline()),
    },
    { label: 'Sync now', click: () => deps.syncStatus.syncNow() },
    { type: 'separator' },
    { label: 'Open status window', click: deps.openStatusWindow },
    { label: 'Quit', click: deps.quit },
  ]
}

function stateIcon(state: TrackerState): NativeImage {
  const color = TRAY_STATE_COLORS[state]
  const image = nativeImage.createFromBuffer(drawStatusIconPng(16, color))
  image.addRepresentation({
    scaleFactor: 2,
    dataURL: `data:image/png;base64,${drawStatusIconPng(32, color).toString('base64')}`,
  })
  return image
}

function createStateIcons(): Record<TrackerState, NativeImage> {
  return {
    STOPPED: stateIcon('STOPPED'),
    ACTIVE: stateIcon('ACTIVE'),
    IDLE: stateIcon('IDLE'),
    PAUSED: stateIcon('PAUSED'),
  }
}
