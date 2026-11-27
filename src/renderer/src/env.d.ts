import type { DesktopBridge } from '../../shared/contracts/bridge'

declare global {
  interface Window {
    /** Exposed by src/preload/index.ts. */
    readonly desktop: DesktopBridge
  }
}
