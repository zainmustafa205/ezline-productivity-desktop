import type { ScheduleData, WeekDay, WorkspaceRole } from '../../src/shared/contracts/api-types.ts'

/**
 * Test data of the mock API. Every account and password here is a test value
 * of the local mock only; none of them exists on any real backend.
 */

export const MOCK_PASSWORD = 'MockPassword-123'

export type LoginBehaviour =
  'OK' | 'MFA' | 'UNVERIFIED' | 'LOCKED' | 'SUSPENDED' | 'PASSWORD_RESET_REQUIRED'

export const LOGIN_BEHAVIOURS: readonly LoginBehaviour[] = [
  'OK',
  'MFA',
  'UNVERIFIED',
  'LOCKED',
  'SUSPENDED',
  'PASSWORD_RESET_REQUIRED',
]

export interface MockWorkspace {
  id: string
  name: string
  suspended: boolean
  /** False: sync answers 403 SUBSCRIPTION_REQUIRED. */
  subscriptionActive: boolean
}

export interface MockUser {
  id: string
  name: string
  email: string
  platformRole: 'USER' | 'SUPER_ADMIN'
  behaviour: LoginBehaviour
  memberships: { workspaceId: string; role: WorkspaceRole }[]
}

export const MOCK_WORKSPACES: readonly MockWorkspace[] = [
  { id: 'ws-ezline', name: 'Ezline Mock Workspace', suspended: false, subscriptionActive: true },
  { id: 'ws-second', name: 'Second Mock Workspace', suspended: false, subscriptionActive: true },
  {
    id: 'ws-suspended',
    name: 'Suspended Mock Workspace',
    suspended: true,
    subscriptionActive: true,
  },
  { id: 'ws-no-plan', name: 'No Plan Mock Workspace', suspended: false, subscriptionActive: false },
]

/** The member account is also the owner of MOCK_API_CONFIG.testAccessToken. */
export const MEMBER_USER_ID = 'u-member'

export const MOCK_USERS: readonly MockUser[] = [
  {
    id: MEMBER_USER_ID,
    name: 'Mock Member',
    email: 'member@mock.test',
    platformRole: 'USER',
    behaviour: 'OK',
    memberships: [{ workspaceId: 'ws-ezline', role: 'TEAM_MEMBER' }],
  },
  {
    id: 'u-multi',
    name: 'Mock Multi Workspace',
    email: 'multi@mock.test',
    platformRole: 'USER',
    behaviour: 'OK',
    memberships: [
      { workspaceId: 'ws-ezline', role: 'ORGANIZATION_OWNER' },
      { workspaceId: 'ws-second', role: 'TEAM_MEMBER' },
      { workspaceId: 'ws-suspended', role: 'TEAM_MEMBER' },
      { workspaceId: 'ws-no-plan', role: 'TEAM_MEMBER' },
    ],
  },
  {
    id: 'u-none',
    name: 'Mock No Workspace',
    email: 'noworkspace@mock.test',
    platformRole: 'USER',
    behaviour: 'OK',
    memberships: [],
  },
  {
    id: 'u-admin',
    name: 'Mock Super Admin',
    email: 'admin@mock.test',
    platformRole: 'SUPER_ADMIN',
    behaviour: 'MFA',
    memberships: [],
  },
  {
    id: 'u-unverified',
    name: 'Mock Unverified',
    email: 'unverified@mock.test',
    platformRole: 'USER',
    behaviour: 'UNVERIFIED',
    memberships: [],
  },
  {
    id: 'u-locked',
    name: 'Mock Locked',
    email: 'locked@mock.test',
    platformRole: 'USER',
    behaviour: 'LOCKED',
    memberships: [],
  },
  {
    id: 'u-suspended',
    name: 'Mock Suspended',
    email: 'suspended@mock.test',
    platformRole: 'USER',
    behaviour: 'SUSPENDED',
    memberships: [],
  },
  {
    id: 'u-reset',
    name: 'Mock Reset Required',
    email: 'reset@mock.test',
    platformRole: 'USER',
    behaviour: 'PASSWORD_RESET_REQUIRED',
    memberships: [],
  },
]

export const SCHEDULE_PRESETS = [
  'normal',
  'strict',
  'fixed-break',
  'full-day',
  'none',
  'tracking-off',
  'other-timezone',
] as const

export type SchedulePreset = (typeof SCHEDULE_PRESETS)[number]

const WEEKDAYS: WeekDay[] = ['MON', 'TUE', 'WED', 'THU', 'FRI']
const ALL_DAYS: WeekDay[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

type ScheduleBody = Omit<ScheduleData, 'serverTime' | 'version' | 'workspaceId'>

const TEAM_NORMAL: ScheduleBody = {
  team: { id: 'team-development', name: 'Development' },
  source: 'TEAM',
  scheduled: true,
  trackingEnabled: true,
  timezone: 'Asia/Karachi',
  workingDays: WEEKDAYS,
  workStart: '09:00',
  workEnd: '17:00',
  trackingMode: 'NORMAL',
  pauseAllowed: true,
  breakType: 'FLEXIBLE',
  flexibleBreakMinutes: 60,
  fixedBreak: null,
  idleThresholdMinutes: 5,
}

const PRESET_BODIES: Record<SchedulePreset, ScheduleBody> = {
  normal: TEAM_NORMAL,
  strict: {
    ...TEAM_NORMAL,
    trackingMode: 'STRICT',
    pauseAllowed: false,
    breakType: 'FIXED',
    flexibleBreakMinutes: null,
    fixedBreak: { start: '13:00', end: '14:00' },
  },
  'fixed-break': {
    ...TEAM_NORMAL,
    breakType: 'FIXED',
    flexibleBreakMinutes: null,
    fixedBreak: { start: '13:00', end: '14:00' },
  },
  'full-day': { ...TEAM_NORMAL, workingDays: ALL_DAYS, workStart: '00:00', workEnd: '24:00' },
  none: {
    ...TEAM_NORMAL,
    team: null,
    source: 'NONE',
    scheduled: false,
    workingDays: [],
    workStart: null,
    workEnd: null,
  },
  'tracking-off': { ...TEAM_NORMAL, trackingEnabled: false },
  'other-timezone': { ...TEAM_NORMAL, timezone: 'America/New_York' },
}

export function buildSchedule(
  workspaceId: string,
  preset: SchedulePreset,
  version: string,
  now: Date,
): ScheduleData {
  return {
    serverTime: now.toISOString(),
    version,
    workspaceId,
    ...structuredClone(PRESET_BODIES[preset]),
  }
}

export function isSchedulePreset(value: unknown): value is SchedulePreset {
  return typeof value === 'string' && (SCHEDULE_PRESETS as readonly string[]).includes(value)
}
