# ProductivityAI Desktop

Desktop tracking application of ProductivityAI, the AI-powered productivity dashboard for remote teams (Ezline). It runs in the Windows system tray, records application usage, website domains, idle time and breaks, keeps the data on the computer while offline and uploads it to the backend API.

Supported platforms: Windows 10 and Windows 11.

This file is the reference for the libraries, the folder ownership and the decisions of Phase 3. Where a plan file differs from this file, this file wins.

## Requirements

- Node.js 24 (`.nvmrc`) and npm 11.
- No compiler is needed: the native libraries ship prebuilt Windows binaries, and their install scripts are switched off in `package.json` (`allowScripts`).

```powershell
npm ci
```

The `postinstall` script downloads the Electron binary (about 100 MB, once; later installs use the cache). If `npm run dev` ever reports "Electron uninstall", run `npm run postinstall`.

## Scripts

| Command               | What it does                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`         | Starts the app with hot reload. The tray uses the fake modules until Chat 17b                    |
| `npm run dev:tracker` | Runs the tracker alone with `InMemoryStore` and prints every entry. Ctrl+C stops it              |
| `npm run mock-api`    | Starts the local mock of the backend on `http://127.0.0.1:4010` (see `tools/mock-api/README.md`) |
| `npm run check`       | Type check, lint, format check, unit tests and build. Must pass before every commit              |
| `npm run test:watch`  | Unit tests in watch mode                                                                         |
| `npm run format`      | Formats all files with Prettier                                                                  |

## Configuration

Every configurable value (intervals, limits, names) is in `src/shared/config/app-config.ts`. The two URLs are build-time values (`.env.example`):

| Variable                | Development default                | Production build |
| ----------------------- | ---------------------------------- | ---------------- |
| `MAIN_VITE_API_URL`     | `http://127.0.0.1:4010` (mock API) | Required, https  |
| `MAIN_VITE_WEB_APP_URL` | `http://localhost:5173`            | Required, https  |

They are compiled into the application and are public. No secret is ever stored in this repository or in the application. The packaged application refuses to start without both URLs or with an http URL.

## Libraries (decision 2)

| Purpose                 | Library                                                                                                                         | Version |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Desktop runtime         | Electron                                                                                                                        | 45      |
| Build                   | electron-vite with Vite                                                                                                         | 6 / 8   |
| Language                | TypeScript, strict                                                                                                              | 7       |
| Windows (renderer)      | React with Tailwind CSS, tokens of `design-theme.md`, font Inter                                                                | 19 / 4  |
| Active window           | `get-windows` (prebuilt N-API binary, verified on Windows 10 in Electron 45)                                                    | 10      |
| Local database          | `better-sqlite3-multiple-ciphers` (synchronous like the `LocalStore` contract; supports SQLCipher and ChaCha20 for decision 10) | 13      |
| Idle time, sleep, lock  | Electron `powerMonitor`                                                                                                         |         |
| Secrets on the computer | Electron `safeStorage` (Windows DPAPI)                                                                                          |         |
| UUID v4                 | `crypto.randomUUID()` (built in)                                                                                                |         |
| Unit tests              | Vitest                                                                                                                          | 5       |
| Lint and format         | Oxlint (type aware) and Prettier, same rules as `web`                                                                           |         |
| Installer               | electron-builder (NSIS), added in Chat 17b                                                                                      |         |

Fallback for the active window: if `get-windows` fails on a target computer, `koffi` (prebuilt) calls the Win32 functions directly. It is added only after discussion.

UI components (shadcn/ui) and animation (Motion) are added by Bilal in Chat 13b with the first windows, after the Figma review.

## Folders and owners

```text
src/
  main/
    index.ts        App start, single instance, wiring of all modules             Zain
    dev-tracker.ts  Test harness of npm run dev:tracker                            Zain
    app/            Configuration, logger, security, windows, notifier, IPC,       Zain
                    development tray (shared infrastructure; everyone may import)
    core/           API client, session, installation, workspace, schedule,        Bilal
                    tracking control, platform status, tray
    tracking/       Window watcher, idle watcher, domain, entry builder            Wasi
    storage/        SQLite local store, encryption, network monitor                Wasi
    sync/           Upload of activity entries, retries, sync status               Wasi
  preload/          Safe bridge between main and windows                           Zain, then Bilal
  renderer/         React windows: login, workspace picker, pause dialog           Bilal
  shared/
    contracts/      TypeScript interfaces shared by everyone                       Zain only
    fakes/          Fake implementations for working alone                         Zain only
    config/         Central configuration and theme values                         Zain only
    http/           Helpers that read backend answers (used by every API client)   Zain only
tools/mock-api/     Local mock of the backend routes the app uses                  Zain
build/              Installer configuration and icons                              Zain, Chat 17b
test/               Unit tests: test/app, test/shared, test/tools (Zain),
                    test/core (Bilal), test/tracking, test/storage, test/sync (Wasi)
```

Rules:

1. Each person changes only the folders marked with their name and the matching `test/` folders.
2. `src/shared/` is changed only by Zain. A needed contract change is sent to Zain with the reason; Zain changes it on `dev`, and both then run `git merge origin/dev` on their branch.
3. Modules talk to each other only through `src/shared/contracts/`, never by importing another person's files. `src/main/app/` is shared infrastructure that everyone may import.
4. `src/main/tracking/index.ts` exports `createActivityTracker(deps)`. Its signature stays the same; Wasi replaces the body (today it returns `FakeTracker`).

## Contracts and fakes

| Contract                                      | File                            | Implemented by            | Fake for working alone                        |
| --------------------------------------------- | ------------------------------- | ------------------------- | --------------------------------------------- |
| `ActivityTracker`                             | `tracker.ts`                    | Wasi                      | `FakeTracker`                                 |
| `LocalStore`                                  | `store.ts`                      | Wasi                      | `InMemoryStore`                               |
| `NetworkMonitor`                              | `network.ts`                    | Wasi                      | `FakeNetworkMonitor`                          |
| `SyncStatus`                                  | `sync-status.ts`                | Wasi                      | `FakeSyncStatus`                              |
| `ApiClient`, `SessionProvider`                | `api.ts`                        | Bilal                     | `MockApiClient`, `FakeSession`                |
| `ScheduleRefresher`, `PlatformStatusProvider` | `schedule.ts`                   | Bilal                     | `FakeScheduleRefresher`, `FakePlatformStatus` |
| `Notifier`                                    | `notifier.ts`                   | Zain (`ElectronNotifier`) | `ConsoleNotifier`                             |
| `Logger`                                      | `logger.ts`                     | Zain (`createLogger`)     | `MemoryLogger`                                |
| Backend shapes and routes                     | `api-types.ts`, `api-routes.ts` |                           |                                               |
| Window bridge                                 | `bridge.ts`                     | Zain, then Bilal          |                                               |

Every `ApiClient` throws `ApiRequestError` and reads answers with `src/shared/http/response.ts`.

## Security rules built into the foundation

- Every window: `contextIsolation` on, `nodeIntegration` off, `sandbox` on, `webviewTag` off, DevTools off in the packaged app, a strict Content Security Policy written into `index.html` at build time.
- No navigation away from the app, no new windows, no webviews, every permission request refused. Links open in the default browser only for the web app origin.
- IPC handlers accept calls only from the app's own windows. The preload script exposes named functions only.
- The logger writes JSON lines to `<userData>/logs/main.log` (rotated at 1 MB, 3 old files). Fields named like tokens, passwords, titles or bodies are replaced by `[REDACTED]`, and token-like text is masked. Callers still never pass a token, password or window title.
- The production backend is never used for tests (decision 11).

## Decisions of Phase 3

Status: **confirmed by Zain on 27 Nov 2026 (Chat 13a).** Decisions 9 and 10 are settled later from the research options Wasi sends. A change to any decision is made only by Zain and written here.

| No. | Question                                | Decision                                                                                                                                                                                                                                                       |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Who does which part                     | Bilal: Part A (login, session, API client, workspace, tray and all windows, schedule rules, pause, platform status; Chats 13b, 15). Wasi: Part B (tracking engine, local storage, offline, sync; Chats 14, 16, 17a). Installer and packaging: Zain in Chat 17b |
| 2   | Libraries                               | See "Libraries" above                                                                                                                                                                                                                                          |
| 3   | "Remember me"                           | Keep the refresh token encrypted with `safeStorage`; never store the password. The User Story is updated at the end                                                                                                                                            |
| 4   | Super Admin signs in on the desktop app | Show "Super Admin accounts sign in on the web app."; no authenticator step                                                                                                                                                                                     |
| 5   | Pause reason "Other"                    | Recorded as PERSONAL_TIME                                                                                                                                                                                                                                      |
| 6   | "Stop" in Strict Mode                   | Stop shown only when pause is allowed; in Strict Mode tracking follows the schedule                                                                                                                                                                            |
| 7   | Screen locked                           | Switch to IDLE at once; on unlock start ACTIVE. Sleep and shutdown close the entry                                                                                                                                                                             |
| 8   | Very short window switches              | Shorter than 3 seconds stay in the previous entry                                                                                                                                                                                                              |
| 9   | Browser domain on Windows               | Wasi researches in Chat 14 and sends options                                                                                                                                                                                                                   |
| 10  | Encryption of the local database        | Wasi researches in Chat 16 and sends options; the chosen library supports both whole-database and column encryption                                                                                                                                            |
| 11  | Backend for testing                     | Daily work against the mock API; real tests in Chat 17b against Zain's local backend on Neon `dev`. No backend secrets for Bilal and Wasi                                                                                                                      |
| 12  | Installer                               | Path `C:\Program Files\ProductivityAI`; EULA text from Ezline; firewall and permission items removed from the User Story; uninstall asks with "Delete local activity data" unchecked by default                                                                |
| 13  | Sync interval                           | Every 5 minutes; backend Offline limit stays 10 minutes                                                                                                                                                                                                        |
| 14  | Synced entries on the computer          | Deleted 7 days after they are synced                                                                                                                                                                                                                           |
| 15  | New chats in the plan                   | Chat 13a and Chat 17b are added to Phase 3; row 13 becomes 13b and row 17 becomes 17a                                                                                                                                                                          |

## Git workflow

- `main` is production, `dev` is the integration branch. Bilal works on `feature/desktop-core`, Wasi on `feature/desktop-tracking`.
- Nobody except Zain pushes to `dev` or `main`, merges or force-pushes.
- Commit messages: one short line, lower case, present tense, `<type>: <short description>` with the types `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`.
- Never commit `.env` files, tokens, passwords, `node_modules/`, build output (`out/`, `release/`) or `.docx` files.
