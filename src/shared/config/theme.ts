/**
 * Theme values the main process needs (tray icons are drawn in the main
 * process, which cannot read the CSS variables of the windows).
 * Source of truth: docs/design-theme.md Section 4 (activity colors). The
 * windows use the same values as CSS variables in src/renderer/src/styles/globals.css.
 * Only Zain changes this file.
 */

export interface RgbColor {
  readonly red: number
  readonly green: number
  readonly blue: number
}

/** Tray icon colors (User Stories): gray stopped, green active, yellow idle, red paused. */
export const TRAY_STATE_COLORS = {
  STOPPED: { red: 0x94, green: 0xa3, blue: 0xb8 }, // --activity-idle #94A3B8
  ACTIVE: { red: 0x16, green: 0xa3, blue: 0x4a }, // --activity-productive #16A34A
  IDLE: { red: 0xca, green: 0x8a, blue: 0x04 }, // --activity-neutral #CA8A04
  PAUSED: { red: 0xdc, green: 0x26, blue: 0x26 }, // --activity-unproductive #DC2626
} as const satisfies Record<string, RgbColor>
