/**
 * Activity data shared by the tracker, the local store and the sync.
 * Only Zain changes the files in src/shared/contracts/.
 */

/** Status of an entry. OFFLINE is never recorded or sent by the desktop app. */
export type ActivityStatus = 'ACTIVE' | 'IDLE' | 'BREAK' | 'PERSONAL_TIME' | 'MEETING'

export const ACTIVITY_STATUSES: readonly ActivityStatus[] = [
  'ACTIVE',
  'IDLE',
  'BREAK',
  'PERSONAL_TIME',
  'MEETING',
]

/** Statuses of a manual or scheduled pause. */
export type PauseStatus = 'BREAK' | 'PERSONAL_TIME' | 'MEETING'

export interface ActivityEntry {
  /** UUID v4, created when the entry starts. */
  clientEventId: string
  /** Signed-in user; entries of one user are never sent with another user's token. */
  userId: string
  /** The one workspace being tracked. */
  workspaceId: string
  status: ActivityStatus
  /** Null for IDLE and pause entries. */
  applicationName: string | null
  windowTitle: string | null
  /** Website host name only, never a full URL. */
  domain: string | null
  /** ISO 8601 UTC with Z, for example 2026-11-24T09:00:00.000Z. */
  startTime: string
  /** Null while the entry is running. */
  endTime: string | null
}

/** Why a running entry is closed and started again with a new UUID. */
export type SplitReason =
  'HOURLY' | 'MIDNIGHT' | 'SCHEDULE_END' | 'FIXED_BREAK_START' | 'FIXED_BREAK_END'

export type TrackerState = 'STOPPED' | 'ACTIVE' | 'IDLE' | 'PAUSED'

export interface TrackingContext {
  userId: string
  workspaceId: string
  /** 2 to 15, from the schedule. */
  idleThresholdMinutes: number
  /** IANA zone of the schedule, used for the midnight split. */
  timezone: string
}
