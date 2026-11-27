/**
 * Central configuration of the desktop application.
 * Every configurable value (intervals, limits, names) is defined here once and
 * referenced everywhere else. Only Zain changes this file.
 *
 * This file has no imports, so the mock API can load it directly with Node.js.
 */

export const APP_CONFIG = {
  /** Product name shown in the UI (design-theme.md, confirmed 19 Nov 2026). */
  productName: 'ProductivityAI',
  /** Windows application id, used for notifications and the installer. */
  appUserModelId: 'com.ezline.productivityai',
  /** Prefix of the User-Agent header: `ProductivityAI-Desktop/<appVersion>`. */
  userAgentPrefix: 'ProductivityAI-Desktop',
  /** Platform value of POST /desktop-app/installations. */
  platform: 'WINDOWS',
} as const

export const API_CONFIG = {
  /** Timeout of one backend request. */
  requestTimeoutMs: 20_000,
  /** Base URL used in development when MAIN_VITE_API_URL is not set (the mock API). */
  developmentApiUrl: 'http://127.0.0.1:4010',
  /** Web app URL used in development when MAIN_VITE_WEB_APP_URL is not set. */
  developmentWebAppUrl: 'http://localhost:5173',
} as const

export const TRACKING_CONFIG = {
  /** How often the active window and the idle time are read. */
  pollIntervalMs: 2_000,
  /** Window switches shorter than this stay in the previous entry (decision 8). */
  minimumEntrySeconds: 3,
  /** A running entry is split when it reaches this age. */
  hourlySplitMinutes: 60,
  /** How often the running entry is marked alive for crash recovery. */
  touchIntervalMs: 30_000,
  /** Idle threshold until the schedule gives one. */
  defaultIdleThresholdMinutes: 5,
  minIdleThresholdMinutes: 2,
  maxIdleThresholdMinutes: 15,
  maxApplicationNameLength: 255,
  maxWindowTitleLength: 512,
} as const

export const SYNC_CONFIG = {
  /** Regular sync interval (decision 13). */
  intervalMs: 5 * 60_000,
  /** Maximum entries per upload (backend limit). */
  batchSize: 1_000,
  /** First wait after a network error or 5xx; doubles on every try. */
  retryBaseDelayMs: 2 * 60_000,
  maxRetries: 5,
  /** Synced entries are deleted from the computer after this many days (decision 14). */
  purgeSyncedAfterDays: 7,
  /** Warn the user when the computer clock differs from the server by more than this. */
  clockSkewWarningMs: 2 * 60_000,
} as const

export const NETWORK_CONFIG = {
  /** How often the connection is checked. */
  checkIntervalMs: 30_000,
  /** Timeout of the GET /health connection check. */
  healthCheckTimeoutMs: 5_000,
} as const

export const SCHEDULE_CONFIG = {
  /** How often the tracking controller checks the schedule rules. */
  checkIntervalMs: 60_000,
} as const

export const PLATFORM_STATUS_CONFIG = {
  /** How often GET /platform/status is read while signed in. */
  refreshIntervalMs: 5 * 60_000,
} as const

export const AUTH_CONFIG = {
  /** Backend limits of the login form. */
  maxEmailLength: 320,
  maxPasswordLength: 128,
} as const

export const LOG_CONFIG = {
  /** Log file name inside `<userData>/logs`. */
  fileName: 'main.log',
  /** A log file is rotated when it reaches this size. */
  maxFileBytes: 1_000_000,
  /** Number of rotated files kept next to the current one. */
  maxRotatedFiles: 3,
} as const

export const MOCK_API_CONFIG = {
  host: '127.0.0.1',
  port: 4010,
  /**
   * Fixed access token the mock API accepts for the member test account.
   * It is a test value of the local mock only, never a real credential.
   */
  testAccessToken: 'mock-access-token-member',
  /** Allowed clock difference before an entry is FUTURE_TIMESTAMP. */
  futureToleranceMs: 5 * 60_000,
  /** Body limit of the sync route after decompression. */
  syncBodyLimitBytes: 5 * 1024 * 1024,
  /** Body limit of every other route. */
  bodyLimitBytes: 100 * 1024,
} as const

export const DEV_TRACKER_CONFIG = {
  /** Fake context used by `npm run dev:tracker` and the development tray. */
  userId: 'dev-user',
  workspaceId: 'dev-workspace',
  timezone: 'Asia/Karachi',
} as const
