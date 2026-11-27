import type { PlatformStatusProvider, ScheduleRefresher } from '../contracts/schedule'

/** ScheduleRefresher that only records its calls, for Wasi's sync tests. */
export class FakeScheduleRefresher implements ScheduleRefresher {
  readonly refreshedWorkspaces: string[] = []

  refresh(workspaceId: string): Promise<void> {
    this.refreshedWorkspaces.push(workspaceId)
    return Promise.resolve()
  }
}

/** PlatformStatusProvider with settable values, for Wasi's sync tests. */
export class FakePlatformStatus implements PlatformStatusProvider {
  private maintenance: boolean
  private syncEnabled: boolean

  constructor(options: { maintenance?: boolean; syncEnabled?: boolean } = {}) {
    this.maintenance = options.maintenance ?? false
    this.syncEnabled = options.syncEnabled ?? true
  }

  isMaintenance(): boolean {
    return this.maintenance
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled
  }

  setMaintenance(enabled: boolean): void {
    this.maintenance = enabled
  }

  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled
  }
}
