import { join } from 'node:path'
import { app, dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { APP_CONFIG } from '../shared/config/app-config'
import { FakeNetworkMonitor } from '../shared/fakes/fake-network-monitor'
import { FakeSyncStatus } from '../shared/fakes/fake-sync-status'
import { InMemoryStore } from '../shared/fakes/in-memory-store'
import { createAppUrls } from './app/app-url'
import { createDevTray } from './app/dev-tray'
import { ElectronNotifier } from './app/electron-notifier'
import { createExternalLinkOpener } from './app/external-links'
import { registerAppIpc } from './app/ipc'
import { acquireSingleInstance, watchQuitting } from './app/lifecycle'
import { createLogger } from './app/logger'
import { errorFields } from './app/redact'
import { RuntimeConfigError, resolveRuntimeConfig } from './app/runtime-config'
import { enableProcessSandbox, hardenApplication } from './app/security'
import { createWindowFactory } from './app/windows'
import { createActivityTracker } from './tracking'

/*
 * Application start and the wiring of all modules (owner: Zain).
 * Until Chat 17b the core, storage and sync modules are the fakes from
 * src/shared/fakes/; Chat 17b replaces them here with the real modules.
 */

const mainDirectory = import.meta.dirname

let statusWindow: BrowserWindow | null = null

function showExistingWindow(): void {
  if (statusWindow === null || statusWindow.isDestroyed()) return
  if (statusWindow.isMinimized()) statusWindow.restore()
  statusWindow.show()
  statusWindow.focus()
}

function start(): void {
  if (!acquireSingleInstance(showExistingWindow)) {
    app.quit()
    return
  }

  enableProcessSandbox()
  watchQuitting()
  app.setAppUserModelId(APP_CONFIG.appUserModelId)
  // The app lives in the tray: closing every window never quits it (FR-04).
  app.on('window-all-closed', () => undefined)

  app
    .whenReady()
    .then(onReady)
    .catch((error: unknown) => {
      dialog.showErrorBox(APP_CONFIG.productName, 'The application could not start.')
      console.error(String(error))
      app.exit(1)
    })
}

function onReady(): void {
  const logger = createLogger({
    directory: join(app.getPath('userData'), 'logs'),
    minLevel: app.isPackaged ? 'info' : 'debug',
    console: !app.isPackaged,
  })

  let config
  try {
    config = resolveRuntimeConfig({
      apiUrl: import.meta.env.MAIN_VITE_API_URL,
      webAppUrl: import.meta.env.MAIN_VITE_WEB_APP_URL,
      isPackaged: app.isPackaged,
      appVersion: app.getVersion(),
    })
  } catch (error) {
    logger.error('config.invalid', errorFields(error))
    const reason = error instanceof RuntimeConfigError ? error.message : 'Invalid configuration.'
    dialog.showErrorBox(APP_CONFIG.productName, `The application is not configured. ${reason}`)
    app.exit(1)
    return
  }

  logger.info('app.started', { version: config.appVersion, packaged: config.isPackaged })

  const urls = createAppUrls(
    mainDirectory,
    app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL'],
  )
  const links = createExternalLinkOpener(
    { allowedOrigins: [config.webAppUrl], requireHttps: config.isPackaged },
    (url) => shell.openExternal(url),
    logger,
  )
  hardenApplication(urls, links, logger)
  registerAppIpc({ productName: APP_CONFIG.productName, version: config.appVersion }, urls, logger)

  const windows = createWindowFactory(mainDirectory, urls, config.isPackaged, logger)
  const notifier = new ElectronNotifier(logger)

  // Fakes until Chat 17b.
  const store = new InMemoryStore()
  const network = new FakeNetworkMonitor(true)
  const syncStatus = new FakeSyncStatus()
  const tracker = createActivityTracker({ store, logger: logger.child('tracking') })

  network.onChange((online) => {
    syncStatus.update({ online })
    notifier.notify(
      APP_CONFIG.productName,
      online ? 'Connection restored' : 'You are working offline',
    )
  })

  createDevTray({
    tracker,
    syncStatus,
    network,
    openStatusWindow: () => {
      if (statusWindow === null || statusWindow.isDestroyed()) {
        statusWindow = windows.create({ route: 'status', width: 420, height: 320 })
      } else {
        showExistingWindow()
      }
    },
    quit: () => {
      tracker.stop()
      app.quit()
    },
  })

  app.on('before-quit', () => {
    tracker.stop()
    logger.info('app.quit')
  })
}

start()
