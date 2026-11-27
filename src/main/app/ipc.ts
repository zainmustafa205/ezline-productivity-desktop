import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { AppInfo } from '../../shared/contracts/bridge'
import { IPC_CHANNELS } from '../../shared/contracts/bridge'
import type { Logger } from '../../shared/contracts/logger'
import type { AppUrls } from './app-url'

/** Every IPC handler first checks that the call comes from one of the app's own windows. */
export function assertTrustedSender(event: IpcMainInvokeEvent, urls: AppUrls): void {
  const url = event.senderFrame?.url ?? ''
  if (!urls.isAppUrl(url)) throw new Error('The request did not come from an application window.')
}

export function registerAppIpc(appInfo: AppInfo, urls: AppUrls, logger: Logger): void {
  const log = logger.child('ipc')
  ipcMain.handle(IPC_CHANNELS.getAppInfo, (event): AppInfo => {
    try {
      assertTrustedSender(event, urls)
    } catch (error) {
      log.warn('ipc.untrusted_sender', { channel: IPC_CHANNELS.getAppInfo })
      throw error
    }
    return { ...appInfo }
  })
}
