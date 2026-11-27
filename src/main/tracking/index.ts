import type { Logger } from '../../shared/contracts/logger'
import type { LocalStore } from '../../shared/contracts/store'
import type { ActivityTracker } from '../../shared/contracts/tracker'
import { FakeTracker } from '../../shared/fakes/fake-tracker'

/**
 * Entry point of the tracking module (owner: Wasi).
 *
 * `src/main/index.ts` and `npm run dev:tracker` create the tracker only through
 * this function, so its signature stays as it is. Until the real tracker is
 * built (Chat 14), it returns the FakeTracker.
 */
export interface TrackerDependencies {
  store: LocalStore
  logger: Logger
}

export function createActivityTracker(deps: TrackerDependencies): ActivityTracker {
  return new FakeTracker({ store: deps.store })
}
