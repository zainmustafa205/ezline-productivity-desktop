import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import type {
  SyncEntry,
  SyncRejectCode,
  SyncRejectedEntry,
} from '../../src/shared/contracts/api-types.ts'
import {
  BACKEND_ERROR_CODES,
  SYNC_MAX_ENTRIES,
  SYNC_REJECT_CODES,
} from '../../src/shared/contracts/api-types.ts'
import type { RouteHandler } from './context.ts'
import { blockedByMaintenance, requireUser, requireWorkspace } from './context.ts'
import { BodyError, isRecord, readJsonBody, sendError, sendSuccess } from './http.ts'
import type { MockState, StoredSyncEntry } from './state.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/
const HOST_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
const STATUSES = new Set(['ACTIVE', 'IDLE', 'BREAK', 'PERSONAL_TIME', 'MEETING'])
const ENTRY_FIELDS = new Set([
  'clientEventId',
  'status',
  'applicationName',
  'windowTitle',
  'domain',
  'startTime',
  'endTime',
])
const INVALID_UPLOAD = 'The request body is not a valid upload'

function optionalText(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'string' && value.length <= 2048)
  )
}

function optionalTime(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && isIsoTime(value))
}

function isIsoTime(value: string): boolean {
  return ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
}

/** Shape check of one entry, as the backend's ValidationPipe does it. */
function isSyncEntry(item: unknown): item is SyncEntry {
  if (!isRecord(item) || Object.keys(item).some((key) => !ENTRY_FIELDS.has(key))) return false
  const { clientEventId, status, startTime } = item
  return (
    typeof clientEventId === 'string' &&
    UUID_PATTERN.test(clientEventId) &&
    typeof status === 'string' &&
    STATUSES.has(status) &&
    typeof startTime === 'string' &&
    isIsoTime(startTime) &&
    optionalTime(item['endTime']) &&
    optionalText(item['applicationName']) &&
    optionalText(item['windowTitle']) &&
    optionalText(item['domain'])
  )
}

/** Any broken entry fails the whole request with 400. */
function parseEntries(body: unknown): SyncEntry[] | null {
  if (!isRecord(body) || Object.keys(body).some((key) => key !== 'entries')) return null
  const entries: unknown = body['entries']
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > SYNC_MAX_ENTRIES) {
    return null
  }
  const list: unknown[] = entries
  return list.every(isSyncEntry) ? list : null
}

function sameEntry(a: SyncEntry, b: SyncEntry): boolean {
  return (
    a.status === b.status &&
    Date.parse(a.startTime) === Date.parse(b.startTime) &&
    (a.applicationName ?? null) === (b.applicationName ?? null) &&
    (a.windowTitle ?? null) === (b.windowTitle ?? null) &&
    (a.domain ?? null) === (b.domain ?? null)
  )
}

/** The per-entry rules the mock checks; the others can be forced with /__mock/sync/reject. */
function ruleRejects(entries: SyncEntry[], nowMs: number): Map<string, SyncRejectCode> {
  const rejects = new Map<string, SyncRejectCode>()
  const counts = new Map<string, number>()
  for (const entry of entries) {
    counts.set(entry.clientEventId, (counts.get(entry.clientEventId) ?? 0) + 1)
  }
  for (const [id, count] of counts) if (count > 1) rejects.set(id, 'DUPLICATE_IN_BATCH')

  const limit = nowMs + MOCK_API_CONFIG.futureToleranceMs
  for (const entry of entries) {
    if (rejects.has(entry.clientEventId)) continue
    const start = Date.parse(entry.startTime)
    const end = entry.endTime ? Date.parse(entry.endTime) : null
    if (end !== null && end < start) rejects.set(entry.clientEventId, 'INVALID_TIME_RANGE')
    else if (start > limit || (end !== null && end > limit)) {
      rejects.set(entry.clientEventId, 'FUTURE_TIMESTAMP')
    } else if (entry.domain && !HOST_PATTERN.test(entry.domain)) {
      rejects.set(entry.clientEventId, 'INVALID_DOMAIN')
    }
  }

  const open = entries
    .filter((entry) => !entry.endTime && !rejects.has(entry.clientEventId))
    .toSorted((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))
  for (const older of open.slice(1)) rejects.set(older.clientEventId, 'MULTIPLE_OPEN_ENTRIES')
  return rejects
}

function store(
  state: MockState,
  entry: SyncEntry,
  userId: string,
  workspaceId: string,
): 'accepted' | 'updated' | 'duplicate' | 'conflict' {
  const existing = state.syncEntries.get(entry.clientEventId)
  const record: StoredSyncEntry = { ...entry, userId, workspaceId }
  if (!existing) {
    state.syncEntries.set(entry.clientEventId, record)
    return 'accepted'
  }
  if (existing.userId !== userId || existing.workspaceId !== workspaceId) return 'conflict'
  if (!sameEntry(existing, entry)) return 'conflict'
  if (existing.endTime) {
    return entry.endTime && Date.parse(entry.endTime) === Date.parse(existing.endTime)
      ? 'duplicate'
      : 'conflict'
  }
  if (!entry.endTime) return 'duplicate'
  state.syncEntries.set(entry.clientEventId, record)
  return 'updated'
}

/** POST /workspaces/:workspaceId/activity/sync */
export const activitySync: RouteHandler = async (context) => {
  if (blockedByMaintenance(context)) return
  const user = requireUser(context)
  if (!user) return
  const workspace = requireWorkspace(context, user)
  if (!workspace) return
  if (!workspace.subscriptionActive) {
    sendError(context.response, 403, 'This workspace has no active subscription.', {
      code: BACKEND_ERROR_CODES.SUBSCRIPTION_REQUIRED,
    })
    return
  }
  if (!context.state.platform.features.ACTIVITY_SYNC) {
    sendError(context.response, 503, 'Activity sync is turned off.', {
      code: BACKEND_ERROR_CODES.FEATURE_DISABLED,
      retryAfterSeconds: 300,
    })
    return
  }

  let body: unknown
  try {
    body = await readJsonBody(context.request, MOCK_API_CONFIG.syncBodyLimitBytes)
  } catch (error) {
    if (error instanceof BodyError && error.status === 413) {
      sendError(context.response, 413, 'Upload too large after decompression; send smaller batches')
      return
    }
    throw error
  }
  const entries = parseEntries(body)
  if (!entries) {
    sendError(context.response, 400, INVALID_UPLOAD)
    return
  }

  const now = context.now()
  const rejects = ruleRejects(entries, now.getTime())
  const rejected: SyncRejectedEntry[] = []
  const reported = new Set<string>()
  let accepted = 0
  let updated = 0
  let duplicates = 0

  for (const entry of entries) {
    let code = rejects.get(entry.clientEventId)
    if (code === undefined) {
      code = context.state.takeForcedReject()
    }
    if (code === undefined) {
      const result = store(context.state, entry, user.id, workspace.id)
      if (result === 'accepted') accepted += 1
      else if (result === 'updated') updated += 1
      else if (result === 'duplicate') duplicates += 1
      else code = 'CONFLICTING_ENTRY'
    }
    if (code !== undefined && !reported.has(entry.clientEventId)) {
      reported.add(entry.clientEventId)
      rejected.push({ clientEventId: entry.clientEventId, code })
    }
  }

  sendSuccess(context.response, 200, 'Activity synced successfully', {
    accepted,
    updated,
    duplicates,
    rejected,
    serverTime: now.toISOString(),
  })
}

export function isSyncRejectCode(value: unknown): value is SyncRejectCode {
  return typeof value === 'string' && (SYNC_REJECT_CODES as readonly string[]).includes(value)
}
