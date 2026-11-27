# Mock API

A local mock of the 9 backend routes the desktop app uses. It returns the same JSON shapes as `API-Reference-Desktop.md`: the success envelope `{ success, statusCode, message, data }` and the error body `{ statusCode, message, error, code? }`. It needs no database, no secrets and no internet connection. The production backend is never used for tests.

```powershell
npm run mock-api
```

Options: `npm run mock-api -- --port 4010 --host 127.0.0.1 --latency 300` (latency in milliseconds, to see loading states). The default address `http://127.0.0.1:4010` is the development API URL of the app.

## Test accounts

Every account uses the test password `MockPassword-123`. These accounts exist only in this mock.

| Email                   | Login answer                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| `member@mock.test`      | `200` with tokens; one workspace (`ws-ezline`)                        |
| `multi@mock.test`       | `200` with tokens; four workspaces, one suspended, one without a plan |
| `noworkspace@mock.test` | `200` with tokens; no workspace                                       |
| `admin@mock.test`       | `200` with `mfaRequired` (Super Admin)                                |
| `unverified@mock.test`  | `401` "Please verify your email before logging in."                   |
| `locked@mock.test`      | `403` "Too many failed attempts. Please try again in a few minutes."  |
| `suspended@mock.test`   | `403` `ACCOUNT_SUSPENDED`                                             |
| `reset@mock.test`       | `403` `PASSWORD_RESET_REQUIRED`                                       |

Any other email or password answers `401` "Invalid email or password.".

The fixed access token `mock-access-token-member` (`MOCK_API_CONFIG.testAccessToken`) belongs to `member@mock.test` and is used by `MockApiClient`.

## Workspaces

| Id             | Behaviour                                           |
| -------------- | --------------------------------------------------- |
| `ws-ezline`    | Normal workspace                                    |
| `ws-second`    | Normal workspace (member: `multi@mock.test` only)   |
| `ws-suspended` | Workspace routes answer `403` `WORKSPACE_SUSPENDED` |
| `ws-no-plan`   | Sync answers `403` `SUBSCRIPTION_REQUIRED`          |

A workspace the user is not a member of answers `403` "You are not a member of this workspace.".

## Behaviour of the routes

- Refresh tokens are single use. Using an old one again ends every session of that user (`401` for the newest token too).
- `GET /workspaces/:id/me/schedule` sends an `ETag`; the same value in `If-None-Match` answers `304` without a body. Changing the preset changes the version.
- While maintenance is on, `/workspaces/me`, the installation report, the schedule and the sync answer `503` `MAINTENANCE_MODE` with `Retry-After`. Health, platform status, login, refresh and logout keep working.
- While `ACTIVITY_SYNC` is off, the sync answers `503` `FEATURE_DISABLED` with `Retry-After: 300` (the planned backend behaviour).
- The sync accepts gzip bodies (`Content-Encoding: gzip`), at most 1000 entries and 5 MB after decompression (`413` above). It checks `DUPLICATE_IN_BATCH`, `INVALID_TIME_RANGE`, `FUTURE_TIMESTAMP` (more than 5 minutes ahead), `INVALID_DOMAIN`, `MULTIPLE_OPEN_ENTRIES` and `CONFLICTING_ENTRY`. Any other reject code can be forced (see below). A running entry sent again is a duplicate; sent again with `endTime` it is updated.
- Rate limits are not simulated; use an injected `429` instead.

## Control routes

Only in the mock. Send JSON bodies with `Content-Type: application/json`.

| Route                                 | Body                                                                                                                                                                   | Effect                                                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /__mock/state`                   |                                                                                                                                                                        | Current state: platform status, schedules, stored entries, installations, last requests                                                                                                            |
| `POST /__mock/reset`                  |                                                                                                                                                                        | Back to the start data                                                                                                                                                                             |
| `POST /__mock/failures`               | `{ "route": "sync", "status": 429, "retryAfterSeconds": 30, "times": 2 }`                                                                                              | The next requests of the route fail. `route` is `*` or one of `health`, `login`, `refresh`, `logout`, `workspaces`, `installations`, `schedule`, `platform`, `sync`. Optional `code` and `message` |
| `PUT /__mock/schedule`                | `{ "workspaceId": "ws-ezline", "preset": "strict" }`                                                                                                                   | Presets: `normal`, `strict`, `fixed-break`, `full-day` (`24:00`), `none`, `tracking-off`, `other-timezone`                                                                                         |
| `PUT /__mock/platform`                | `{ "maintenance": { "enabled": true, "message": "Upgrade", "endsAt": "2026-11-30T12:00:00.000Z", "retryAfterSeconds": 600 }, "features": { "ACTIVITY_SYNC": false } }` | Maintenance mode and feature switches                                                                                                                                                              |
| `PUT /__mock/latest-version`          | `{ "latestVersion": "0.2.0" }`                                                                                                                                         | `latestVersion` of the installation report ("Update available")                                                                                                                                    |
| `PUT /__mock/user`                    | `{ "email": "member@mock.test", "behaviour": "SUSPENDED" }`                                                                                                            | Changes an account; `SUSPENDED` and `PASSWORD_RESET_REQUIRED` also make refresh answer `401` with that code                                                                                        |
| `POST /__mock/sessions/revoke`        | `{ "email": "member@mock.test" }`                                                                                                                                      | "Log out of all devices": every token of the account stops working                                                                                                                                 |
| `POST /__mock/sessions/expire-access` |                                                                                                                                                                        | Every access token answers `401` (as after 15 minutes); refresh tokens keep working                                                                                                                |
| `POST /__mock/sync/reject`            | `{ "code": "DAILY_ENTRY_LIMIT", "count": 3 }`                                                                                                                          | The next entries are rejected with this code                                                                                                                                                       |

PowerShell example:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4010/__mock/failures -ContentType 'application/json' -Body '{"route":"sync","status":503,"code":"MAINTENANCE_MODE","retryAfterSeconds":60}'
```
