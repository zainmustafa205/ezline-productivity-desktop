import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo, DesktopBridge } from '../shared/contracts/bridge'
import { IPC_CHANNELS, isAppInfo } from '../shared/contracts/bridge'

/*
 * Safe bridge between the main process and the windows (owner: Zain, then Bilal).
 * Exposes only named functions; never ipcRenderer itself, never Node.js APIs,
 * never tokens.
 */

const bridge: DesktopBridge = {
  async getAppInfo(): Promise<AppInfo> {
    const info: unknown = await ipcRenderer.invoke(IPC_CHANNELS.getAppInfo)
    if (!isAppInfo(info)) throw new Error('Unexpected application information.')
    return info
  },
}

contextBridge.exposeInMainWorld('desktop', bridge)
