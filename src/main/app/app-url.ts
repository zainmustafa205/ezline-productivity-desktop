import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Where the windows of the application are loaded from: the Vite dev server in
 * development, the built index.html in production. Anything else is foreign
 * content and is never loaded or trusted.
 */
export interface AppUrls {
  /** URL of a window route, for BrowserWindow.loadURL in development. */
  devServerUrl: string | null
  /** Path of the built renderer index.html. */
  rendererFile: string
  /** True when a URL belongs to the application's own windows. */
  isAppUrl(url: string): boolean
}

export function createAppUrls(mainDirectory: string, devServerUrl: string | undefined): AppUrls {
  const rendererFile = join(mainDirectory, '../renderer/index.html')
  const rendererFileUrl = pathToFileURL(rendererFile).href
  const devOrigin = devServerUrl ? new URL(devServerUrl).origin : null

  return {
    devServerUrl: devServerUrl ?? null,
    rendererFile,
    isAppUrl(url) {
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        return false
      }
      if (devOrigin !== null) return parsed.origin === devOrigin
      parsed.hash = ''
      parsed.search = ''
      return parsed.href === rendererFileUrl
    },
  }
}
