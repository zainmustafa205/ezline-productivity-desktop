/**
 * The only API the windows get from the preload script (`window.desktop`).
 * Windows never receive tokens, passwords or Node.js access. Bilal adds the
 * calls of his windows here through Zain.
 */

export const IPC_CHANNELS = {
  getAppInfo: 'app:get-info',
} as const

export interface AppInfo {
  productName: string
  version: string
}

export function isAppInfo(value: unknown): value is AppInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    'productName' in value &&
    typeof value.productName === 'string' &&
    'version' in value &&
    typeof value.version === 'string'
  )
}

export interface DesktopBridge {
  getAppInfo(): Promise<AppInfo>
}
