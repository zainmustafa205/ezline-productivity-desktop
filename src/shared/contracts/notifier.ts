/** Windows notification. Implemented in src/main/app/ (Zain), used by everyone. */
export interface Notifier {
  notify(title: string, body: string): void
}
