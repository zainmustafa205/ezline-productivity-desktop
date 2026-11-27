import { Notification } from 'electron'
import type { Logger } from '../../shared/contracts/logger'
import type { Notifier } from '../../shared/contracts/notifier'

/** Windows notifications through Electron. */
export class ElectronNotifier implements Notifier {
  private readonly logger: Logger

  constructor(logger: Logger) {
    this.logger = logger.child('notifier')
  }

  notify(title: string, body: string): void {
    if (!Notification.isSupported()) {
      this.logger.warn('notification.unsupported')
      return
    }
    new Notification({ title, body }).show()
  }
}
