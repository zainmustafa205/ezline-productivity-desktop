import { app, session } from 'electron'
import type { WebContents, WebPreferences } from 'electron'
import type { Logger } from '../../shared/contracts/logger'
import type { AppUrls } from './app-url'
import type { ExternalLinkOpener } from './external-links'

/** Web preferences of every window. Never weaken these for one window. */
export function secureWebPreferences(preloadPath: string, isPackaged: boolean): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    spellcheck: false,
    devTools: !isPackaged,
  }
}

/** Must run before the app is ready. */
export function enableProcessSandbox(): void {
  app.enableSandbox()
}

/**
 * Application-wide rules: no permissions, no navigation away from the app, no
 * new windows, no webviews. Links to allowed origins open in the default browser.
 */
export function hardenApplication(urls: AppUrls, links: ExternalLinkOpener, logger: Logger): void {
  const log = logger.child('security')

  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)

  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents, urls, links, log)
  })
}

function hardenWebContents(
  contents: WebContents,
  urls: AppUrls,
  links: ExternalLinkOpener,
  log: Logger,
): void {
  contents.setWindowOpenHandler(({ url }) => {
    links.open(url)
    return { action: 'deny' }
  })

  const blockForeignNavigation = (event: { preventDefault(): void }, url: string): void => {
    if (urls.isAppUrl(url)) return
    event.preventDefault()
    log.warn('navigation.blocked')
    links.open(url)
  }
  contents.on('will-navigate', blockForeignNavigation)
  contents.on('will-redirect', blockForeignNavigation)

  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
    log.warn('webview.blocked')
  })
}
