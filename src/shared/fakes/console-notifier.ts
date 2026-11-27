import type { Notifier } from '../contracts/notifier'

/** Notifier that prints to the console and keeps the notifications, for tests. */
export class ConsoleNotifier implements Notifier {
  readonly sent: { title: string; body: string }[] = []
  private readonly silent: boolean

  constructor(options: { silent?: boolean } = {}) {
    this.silent = options.silent ?? false
  }

  notify(title: string, body: string): void {
    this.sent.push({ title, body })
    if (!this.silent) console.info(`[notification] ${title}: ${body}`)
  }
}
