import type {
  PlatformStatusData,
  SyncEntry,
  SyncRejectCode,
} from '../../src/shared/contracts/api-types.ts'
import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import type { LoginBehaviour, MockUser, MockWorkspace, SchedulePreset } from './fixtures.ts'
import { MEMBER_USER_ID, MOCK_USERS, MOCK_WORKSPACES } from './fixtures.ts'

/** Names of the routes, used by the failure switches. */
export const ROUTE_NAMES = [
  'health',
  'login',
  'refresh',
  'logout',
  'workspaces',
  'installations',
  'schedule',
  'platform',
  'sync',
] as const

export type RouteName = (typeof ROUTE_NAMES)[number]

export interface InjectedFailure {
  route: RouteName | '*'
  status: number
  code?: string
  message?: string
  retryAfterSeconds?: number
  /** How many requests still get this failure. */
  remaining: number
}

interface AccessToken {
  userId: string
}

interface RefreshToken {
  userId: string
  used: boolean
}

export interface StoredSyncEntry extends SyncEntry {
  userId: string
  workspaceId: string
}

export interface StoredInstallation {
  userId: string
  installationId: string
  appVersion: string
  firstSeenAt: string
  lastSeenAt: string
}

function defaultPlatform(): PlatformStatusData {
  return {
    maintenance: { enabled: false, message: null, endsAt: null, retryAfterSeconds: null },
    features: {
      AI_CLASSIFICATION: true,
      ACTIVITY_SYNC: true,
      OFFLINE_MODE: true,
      REPORT_GENERATION: true,
    },
  }
}

/** All data of the mock API, kept in memory. `reset()` returns to the fixtures. */
export class MockState {
  users: MockUser[] = []
  workspaces: MockWorkspace[] = []
  platform: PlatformStatusData = defaultPlatform()
  latestVersion: string | null = null
  failures: InjectedFailure[] = []
  forcedRejects: { code: SyncRejectCode; remaining: number }[] = []
  readonly accessTokens = new Map<string, AccessToken>()
  readonly refreshTokens = new Map<string, RefreshToken>()
  readonly schedules = new Map<string, { preset: SchedulePreset; revision: number }>()
  readonly syncEntries = new Map<string, StoredSyncEntry>()
  readonly installations = new Map<string, StoredInstallation>()
  /** Every request received, newest last (method and path only). */
  readonly requestLog: string[] = []
  private tokenCounter = 0

  constructor() {
    this.reset()
  }

  reset(): void {
    this.users = structuredClone([...MOCK_USERS])
    this.workspaces = structuredClone([...MOCK_WORKSPACES])
    this.platform = defaultPlatform()
    this.latestVersion = null
    this.failures = []
    this.forcedRejects = []
    this.accessTokens.clear()
    this.refreshTokens.clear()
    this.schedules.clear()
    this.syncEntries.clear()
    this.installations.clear()
    this.requestLog.length = 0
    this.accessTokens.set(MOCK_API_CONFIG.testAccessToken, { userId: MEMBER_USER_ID })
  }

  findUserByEmail(email: string): MockUser | undefined {
    const normalized = email.trim().toLowerCase()
    return this.users.find((user) => user.email === normalized)
  }

  findUser(userId: string): MockUser | undefined {
    return this.users.find((user) => user.id === userId)
  }

  findWorkspace(workspaceId: string): MockWorkspace | undefined {
    return this.workspaces.find((workspace) => workspace.id === workspaceId)
  }

  setBehaviour(email: string, behaviour: LoginBehaviour): boolean {
    const user = this.findUserByEmail(email)
    if (!user) return false
    user.behaviour = behaviour
    return true
  }

  issueTokens(userId: string): { accessToken: string; refreshToken: string } {
    this.tokenCounter += 1
    const accessToken = `mock-access-${this.tokenCounter}`
    const refreshToken = `mock-refresh-${this.tokenCounter}`
    this.accessTokens.set(accessToken, { userId })
    this.refreshTokens.set(refreshToken, { userId, used: false })
    return { accessToken, refreshToken }
  }

  userOfAccessToken(token: string | null): MockUser | undefined {
    if (token === null) return undefined
    const access = this.accessTokens.get(token)
    return access ? this.findUser(access.userId) : undefined
  }

  /** Ends every session of the user ("log out of all devices", reused refresh token). */
  revokeUserSessions(userId: string): void {
    for (const [token, access] of this.accessTokens) {
      if (access.userId === userId) this.accessTokens.delete(token)
    }
    for (const [token, refresh] of this.refreshTokens) {
      if (refresh.userId === userId) this.refreshTokens.delete(token)
    }
  }

  /** Makes every access token invalid, as after 15 minutes; refresh tokens stay valid. */
  expireAccessTokens(): void {
    this.accessTokens.clear()
  }

  schedulePreset(workspaceId: string): { preset: SchedulePreset; revision: number } {
    const existing = this.schedules.get(workspaceId)
    if (existing) return existing
    const created = { preset: 'normal' as SchedulePreset, revision: 1 }
    this.schedules.set(workspaceId, created)
    return created
  }

  setSchedulePreset(workspaceId: string, preset: SchedulePreset): void {
    const current = this.schedulePreset(workspaceId)
    this.schedules.set(workspaceId, { preset, revision: current.revision + 1 })
  }

  /** Takes the next injected failure of the route, if any. */
  takeFailure(route: RouteName): InjectedFailure | undefined {
    const failure = this.failures.find(
      (item) => (item.route === route || item.route === '*') && item.remaining > 0,
    )
    if (!failure) return undefined
    failure.remaining -= 1
    this.failures = this.failures.filter((item) => item.remaining > 0)
    return failure
  }

  takeForcedReject(): SyncRejectCode | undefined {
    const reject = this.forcedRejects.find((item) => item.remaining > 0)
    if (!reject) return undefined
    reject.remaining -= 1
    this.forcedRejects = this.forcedRejects.filter((item) => item.remaining > 0)
    return reject.code
  }
}
