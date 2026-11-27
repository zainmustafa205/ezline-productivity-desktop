import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { APP_CONFIG } from '../../shared/config/app-config'
import type { Logger } from '../../shared/contracts/logger'
import type { AppUrls } from './app-url'
import { isQuitting } from './lifecycle'
import { secureWebPreferences } from './security'

export interface AppWindowOptions {
  /** Route of the window inside the renderer, for example `login`. */
  route: string
  width: number
  height: number
  resizable?: boolean
}

export interface WindowFactory {
  /** Creates a window with the secure defaults; closing it hides it (close to tray). */
  create(options: AppWindowOptions): BrowserWindow
}

export function createWindowFactory(
  mainDirectory: string,
  urls: AppUrls,
  isPackaged: boolean,
  logger: Logger,
): WindowFactory {
  const preloadPath = join(mainDirectory, '../preload/index.cjs')
  const log = logger.child('window')

  return {
    create(options) {
      const window = new BrowserWindow({
        title: APP_CONFIG.productName,
        width: options.width,
        height: options.height,
        resizable: options.resizable ?? false,
        show: false,
        autoHideMenuBar: true,
        webPreferences: secureWebPreferences(preloadPath, isPackaged),
      })
      window.removeMenu()
      window.once('ready-to-show', () => window.show())
      window.on('close', (event) => {
        if (isQuitting()) return
        event.preventDefault()
        window.hide()
      })

      const loading =
        urls.devServerUrl !== null
          ? window.loadURL(`${urls.devServerUrl}#/${options.route}`)
          : window.loadFile(urls.rendererFile, { hash: `/${options.route}` })
      loading.catch(() => log.error('window.load_failed', { route: options.route }))
      return window
    },
  }
}
