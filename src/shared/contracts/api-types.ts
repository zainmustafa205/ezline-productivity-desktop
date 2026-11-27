/**
 * Request and response shapes of the 9 backend routes the desktop app uses,
 * exactly as in API-Reference-Desktop.md. Responses show the `data` part of
 * the success envelope. The mock API and the real API client both use them.
 */

/** Success envelope of every JSON success response (API reference 1.3). */
export interface SuccessEnvelope<T> {
  success: true
  statusCode: number
  message: string
  data?: T
}

/** Error body (API reference 1.4). Errors are not wrapped. */
export interface ErrorBody {
  statusCode: number
  error: string
  /** A string, or a list of validation messages. */
  message: string | string[]
  code?: string
  [extra: string]: unknown
}

/* GET /health */
export interface HealthData {
  status: 'ok'
  info: Record<string, { status: 'up' }>
  error: Record<string, never>
  details: Record<string, { status: 'up' }>
}

/* POST /auth/login */
export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface AuthUser {
  id: string
  name: string
  email: string
  platformRole: string
}

export interface LoginSuccessData {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export interface LoginMfaRequiredData {
  mfaRequired: true
  mfaToken: string
  expiresInSeconds: number
}

export type LoginData = LoginSuccessData | LoginMfaRequiredData

export function isMfaRequired(data: LoginData): data is LoginMfaRequiredData {
  return 'mfaRequired' in data
}

/* POST /auth/refresh */
export interface RefreshRequest {
  refreshToken: string
}

export interface RefreshData {
  accessToken: string
  refreshToken: string
}

/* POST /auth/logout (201, no data) */
export interface LogoutRequest {
  refreshToken: string
}

/* GET /workspaces/me */
export type WorkspaceRole = 'ORGANIZATION_OWNER' | 'TEAM_MEMBER'

export interface WorkspaceMembership {
  workspaceId: string
  workspaceName: string
  role: WorkspaceRole
  suspended: boolean
}

/* POST /desktop-app/installations */
export interface InstallationRequest {
  installationId: string
  appVersion: string
  platform: 'WINDOWS'
}

export type InstallationStatus = 'NOT_DOWNLOADED' | 'DOWNLOADED' | 'INSTALLED'

export interface InstallationData {
  latestVersion: string | null
  firstSeenAt: string
  lastSeenAt: string
  appVersion: string
  installationId: string
  status: InstallationStatus
}

/** appVersion rule of the backend. */
export const APP_VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}([-+][0-9A-Za-z.-]{1,18})?$/

/* POST /workspaces/:workspaceId/activity/sync */
export type SyncEntryStatus = 'ACTIVE' | 'IDLE' | 'BREAK' | 'PERSONAL_TIME' | 'MEETING'

export interface SyncEntry {
  clientEventId: string
  status: SyncEntryStatus
  applicationName?: string | null
  windowTitle?: string | null
  domain?: string | null
  startTime: string
  endTime?: string | null
}

export interface SyncRequest {
  entries: SyncEntry[]
}

export const SYNC_REJECT_CODES = [
  'DUPLICATE_IN_BATCH',
  'INVALID_TIME_RANGE',
  'FUTURE_TIMESTAMP',
  'TOO_OLD',
  'ENTRY_TOO_LONG',
  'INVALID_DOMAIN',
  'MULTIPLE_OPEN_ENTRIES',
  'OUTSIDE_MEMBERSHIP_PERIOD',
  'OUTSIDE_SUBSCRIPTION_PERIOD',
  'CONFLICTING_ENTRY',
  'DAILY_ENTRY_LIMIT',
] as const

export type SyncRejectCode = (typeof SYNC_REJECT_CODES)[number]

export interface SyncRejectedEntry {
  clientEventId: string
  code: SyncRejectCode
}

export interface SyncData {
  accepted: number
  updated: number
  duplicates: number
  rejected: SyncRejectedEntry[]
  serverTime: string
}

/** Maximum entries per upload. */
export const SYNC_MAX_ENTRIES = 1000

/* GET /workspaces/:workspaceId/me/schedule */
export type WeekDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export interface ScheduleData {
  serverTime: string
  version: string
  workspaceId: string
  team: { id: string; name: string } | null
  source: 'TEAM' | 'NONE' | 'MEMBER'
  /** False: no schedule, track whenever the app runs. */
  scheduled: boolean
  /** False: do not track at all. */
  trackingEnabled: boolean
  /** IANA zone; all times below are in this zone. */
  timezone: string
  workingDays: WeekDay[]
  /** "HH:mm" */
  workStart: string | null
  /** "HH:mm", may be "24:00" */
  workEnd: string | null
  trackingMode: 'NORMAL' | 'STRICT'
  /** False in Strict Mode. */
  pauseAllowed: boolean
  breakType: 'FLEXIBLE' | 'FIXED'
  flexibleBreakMinutes: number | null
  fixedBreak: { start: string; end: string } | null
  /** 2 to 15 */
  idleThresholdMinutes: number
}

/* GET /platform/status */
export interface PlatformStatusData {
  maintenance: {
    enabled: boolean
    message: string | null
    endsAt: string | null
    retryAfterSeconds: number | null
  }
  features: {
    AI_CLASSIFICATION: boolean
    ACTIVITY_SYNC: boolean
    OFFLINE_MODE: boolean
    REPORT_GENERATION: boolean
  }
}

/** Backend error codes of these routes (API reference Section 3 and 1.5). */
export const BACKEND_ERROR_CODES = {
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  PASSWORD_RESET_REQUIRED: 'PASSWORD_RESET_REQUIRED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  WORKSPACE_SUSPENDED: 'WORKSPACE_SUSPENDED',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  /** Planned backend change: sync answers 503 FEATURE_DISABLED while ACTIVITY_SYNC is off. */
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const

export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[keyof typeof BACKEND_ERROR_CODES]

/**
 * Backend messages without a code that the app must recognise. Compared in
 * one place only; they will be replaced by codes later (Backend Change Request 4).
 */
export const BACKEND_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before logging in.',
  TOO_MANY_FAILED_ATTEMPTS: 'Too many failed attempts. Please try again in a few minutes.',
  INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token.',
  NOT_A_MEMBER: 'You are not a member of this workspace.',
  MEMBER_NOT_FOUND: 'Member not found in this workspace',
} as const
