# Google Drive mirror: blueprint

Derived from [drive.md](../drive.md). The spec decides; this file only adds engineering precision, read from the
code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `DRVn`. Paths
are relative to the repository root.

Scope, by file:

| File                                                    | Role                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/drive/src/index.ts`                 | The Worker: `fetch` to `handle`; exports `DriveMirror`                                                                       |
| `liveworkspace/apps/drive/src/dispatch.ts`              | `/api/drive/<route>` (one segment) and `/app/…`; `routeDeps` (object by `idFromName(personId)`)                              |
| `liveworkspace/apps/drive/src/env.ts`                   | `Env`, `appKey`, `appOrigin`, `environmentOf`, `publicOrigin`, `accountsUrl`, `audiences`, `driveConfigured`, `googleConfig` |
| `liveworkspace/apps/drive/src/auth.ts`                  | `accountOf` (account access tokens only), `carriesKey`                                                                       |
| `liveworkspace/apps/drive/src/http.ts`                  | `json` (`private, no-store`), `STATUS_OF`, `fail`, `readObject` (16 KiB)                                                     |
| `liveworkspace/apps/drive/src/routes.ts`                | The browser routes and `MirrorApi`                                                                                           |
| `liveworkspace/apps/drive/src/app-routes.ts`            | `handlePush` (Google), `handleApp` (index, accounts)                                                                         |
| `liveworkspace/apps/drive/src/consent.ts`               | `redirectUriOf`, `safeReturnTo`, `consentUrl`                                                                                |
| `liveworkspace/apps/drive/src/channel-token.ts`         | `channelToken`, `channelPerson`                                                                                              |
| `liveworkspace/apps/drive/src/index-api.ts`             | `createIndexApi`: the index acting as the person; `everyPage`; the `drive_mirrored` flag                                     |
| `liveworkspace/apps/drive/src/app-doors.ts`             | Each app's export and import doors, `itemUrl`                                                                                |
| `liveworkspace/apps/drive/src/open.ts`                  | `resolveOpen`, `importCopy`                                                                                                  |
| `liveworkspace/apps/drive/src/thumbnail.ts`             | `workerRasterise`                                                                                                            |
| `liveworkspace/apps/drive/src/log.ts`                   | `driveLog`, `driveWarn`, `errorKind`                                                                                         |
| `liveworkspace/apps/drive/src/mirror/durable-object.ts` | `DriveMirror`: RPC shell, `alarm`                                                                                            |
| `liveworkspace/apps/drive/src/mirror/mirror.ts`         | `Mirror`: every call; the `epoch` guard                                                                                      |
| `liveworkspace/apps/drive/src/mirror/connect.ts`        | `connect`, `confirmSwitch`, `cancelSwitch`, `disconnect`                                                                     |
| `liveworkspace/apps/drive/src/mirror/tokens.ts`         | `TokenSource`, `NeedsReconnect`, `NotConnected`                                                                              |
| `liveworkspace/apps/drive/src/mirror/channel.ts`        | `channelLive`, `pageTokenOf`, `maintainChannel`, `stopChannel`                                                               |
| `liveworkspace/apps/drive/src/mirror/pass.ts`           | `runPass`, `nextPassAt`                                                                                                      |
| `liveworkspace/apps/drive/src/mirror/pass-state.ts`     | `PassState`, `folderSubtree`                                                                                                 |
| `liveworkspace/apps/drive/src/mirror/inbound.ts`        | `readChanges`, `applyInbound`, `adoptExisting`                                                                               |
| `liveworkspace/apps/drive/src/mirror/outbound.ts`       | `runOutbound`, `isRunFatal`                                                                                                  |
| `liveworkspace/apps/drive/src/mirror/meter.ts`          | `SubrequestMeter`, `BudgetSpent`, `meteredFetch`, `meteredDoors`                                                             |
| `liveworkspace/apps/drive/src/mirror/answers.ts`        | `connectionAnswer`, `marksAnswer`                                                                                            |
| `liveworkspace/apps/drive/src/mirror/store.ts`          | `MirrorStore`: the object's SQLite                                                                                           |
| `packages/drive/src/constants.ts`                       | Every timing and size; `appProperties` keys; `isDriveId`; `driveRootName`                                                    |
| `packages/drive/src/formats.ts`                         | `APP_FILE_FORMATS`, `driveFileName`, `stripDriveName`, `formatOfMime`, `formatOfKind`                                        |
| `packages/drive/src/backoff.ts`                         | `backoffHit`, `writeIntervalMs`, `fallbackCheckMs`                                                                           |
| `packages/drive/src/wire.ts`                            | `DRIVE_API_PATH`, every answer type, `DriveErrorCode`                                                                        |
| `packages/drive/src/client.ts`                          | `createDriveClient` for the browser, the connect URL, `parseDriveOpenState`                                                  |
| `packages/drive/src/plan/*`                             | `buildSnapshot`, `planInbound`, `planAdoption`, `orderChanges`, `planOutbound`: pure planners                                |
| `packages/drive/src/server/*`                           | Google OAuth, the Drive REST client, sealing, the consent `state`                                                            |

## Domain and naming

| Term       | Identifier                                                 | Meaning                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Person     | account id (never `guest_…`)                               | One `DriveMirror` by `idFromName(accountId)`                                                                                                                                                               |
| Connection | `drive_connection` row `id = 1`                            | The sealed grant, the root, the page token, status, the push channel, back-off, progress                                                                                                                   |
| Row        | `drive_items (kind, id)`; `rowKey(kind, id)` = `kind:id`   | The last Drive state known for one item or folder                                                                                                                                                          |
| Root       | `lwRoot = <origin>` folder in My Drive                     | `liveworkspace`, or `liveworkspace (staging)` / `(development)`                                                                                                                                            |
| Status     | `DriveStatus`: `ok`, `needs_reconnect`, `error`            | Cloud Sync's state                                                                                                                                                                                         |
| Pass       | `runPass`                                                  | One alarm: inbound, then outbound in a batch                                                                                                                                                               |
| Echo       | `planInbound` → `echo`                                     | A change that carries nothing the row doesn't                                                                                                                                                              |
| Notice     | `notice = 'unseen_folder'`                                 | An item moved in Drive into a folder liveworkspace can't see                                                                                                                                               |
| Mark       | `DriveMarkState`: `synced`, `syncing`, `waiting`, `failed` | The Explorer's per-item sync mark                                                                                                                                                                          |
| File       | `APP_FILE_FORMATS[app]`                                    | `.livediagram` (`application/vnd.livediagram+json`, kind `livediagram.document`), `.liveplanner` (`liveplanner.project`), `.livedocuments` (`livedocuments.document`), `.livedesign` (`livedesign.design`) |

`appProperties` keys: `lwItemId`, `lwApp`, `lwFolderId`, `lwOrigin`, `lwRoot` (key plus value at most 124 bytes).
Scopes: `drive.file` and `drive.install`.

## Behaviour and state

### The connection's status

| From                           | Event                                                                  | To                | Effect                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| none                           | `connect` with a refresh token                                         | `ok`              | row created; token primed; index flag set; channel; alarm now                                            |
| none                           | `connect` without a refresh token                                      | none              | `no_refresh_token`                                                                                       |
| `ok`/`error`/`needs_reconnect` | `connect`, same Google account                                         | `ok`              | the new sealed token if any; a pending switch revoked; started                                           |
| any                            | `connect`, another Google account                                      | unchanged         | `pending*` set for 30 min; an older pending grant revoked                                                |
| pending                        | `confirmSwitch` in time                                                | `ok`              | old channel stopped, old grant revoked, rows cleared, root, page token, channel, back-off reset; started |
| pending                        | `confirmSwitch` late, `cancelSwitch`, or the alarm past `pendingUntil` | unchanged         | the pending grant revoked                                                                                |
| any                            | refresh `invalid_grant`, or a sealed token the key can't open          | `needs_reconnect` | syncing off, progress cleared; alarm deleted after the pass                                              |
| `ok`                           | a pass fails (not a budget stop)                                       | `error`           | retry after the write interval                                                                           |
| `error`                        | a pass completes                                                       | `ok`              |                                                                                                          |
| any                            | `disconnect` or account deletion                                       | none              | channel stopped, grants revoked, rows and alarm cleared, flag cleared, `storage.deleteAll()`             |

`disconnect` and `confirmSwitch` bump `epoch`; a pass begun earlier throws `PassAborted` at its next row write.

### A pass (`runPass`), in order

1. No connection or `needs_reconnect`: stopped. Mark `syncing`; read `flushNext`.
2. `tokens.get()` (cached until 1 min before expiry).
3. `ensureRoot`: the stored root, else take the page token first, then the folder tagged `lwRoot = origin` that the
   person owns, else create one in My Drive; store `rootId`, `rootName`.
4. `maintainChannel`: skip while one lives more than a day, or one failed within 30 min; else stop the old one and
   `changes.watch` for 7 days with a fresh id and the signed channel token. A failure is logged and stamped
   `channelFailedAt`.
5. `index.picture()`: every page of personal items, folders and trash (`LIST_LIMIT_MAX` each, at most
   `DRIVE_LIST_PAGES_MAX` = 100 pages, else a throw), filtered to the person's own, live, unshared items of the four
   apps.
6. A fresh root: `adoptExisting` (files tagged `lwOrigin = origin`, `planAdoption`).
7. Inbound behind the gate: `getStartPageToken`; equal to the stored token (or none stored) is nothing new. Else
   `readChanges` page by page (`DRIVE_CHANGES_PAGE_SIZE` 1000); a `400`/`404` token restarts from now and adopts. The
   root removed: rows cleared, root forgotten, a new root next batch. Else `applyInbound`.
8. Inbound stopped short (`DRIVE_PASS_MAX_INBOUND` 200 effectful changes, or the meter can't afford 4 more): log and
   continue in 1 s, no outbound.
9. Re-read the picture if anything was adopted or applied; `noteSeen` each item's `updatedAt`.
10. `planOutbound(snapshot, { now, flush, writeIntervalMs })`; `runOutbound` up to `DRIVE_PASS_MAX_WRITES` (40), each
    op needing 6 subrequests of headroom.
11. Store progress, `status: 'ok'`, `lastPassAt`; when finished, `lastSyncedAt` and `flushNext: false`.

Failures (`failed`): `PassAborted` stops; `BudgetSpent` continues in 1 s; `NeedsReconnect` stops; a Drive rate limit
(`403 userRateLimitExceeded`, `429`) raises back-off; anything else is `error`, retried after the write interval.

### The next alarm (`nextPassAt`)

The soonest of: `lastPassAt` + the fallback check (6 h with a live channel, 30 min without, doubled per back-off level
up to 6 h); a failure's `retryAt`; `now + 1 s` for more; the plan's `nextDueAt`; the channel's renewal (expiry minus
24 h) when still ahead. An earlier alarm already set stands. `signal` sets `now + 30 s` unless sooner is set; `check`
sets `now` with `flushNext` unless syncing or a pass ended within 30 s.

### Inbound effects (`applyEffect`, through the index as the person)

`rename-item`, `move-item`, `trash-item`, `restore-item` (folder `null`), `purge-item` (row dropped), `rename-folder`,
`move-folder` (a `409` cycle is logged and outbound puts Drive back), `bin-folder` (its items to the Trash with rows
marked trashed, then folders deepest first), `recreate-folder` (create, then list its children into the queue). An
index `404` skips the effect (`inbound-missing`). Decisions: `echo`, `ignore` (`binned-folder`, `deleted-here`,
`duplicate`, `foreign-copy`, `not-ours`, `removed`, `root`, `unknown-removed`, `unrecorded`, `unrecorded-item`),
`forget`, `adopt`, `apply` (the row re-recorded with Drive's state unless purged or binned).

### Outbound ops (`runOp`)

`create-folder`, `update-folder` (rename, move, untrash), `create-file` (envelope from the app's export door, a
thumbnail, `appProperties { lwItemId, lwApp, lwOrigin }`; deferred while its parent isn't mirrored), `update-file`
(rename, move, untrash, content; a `404` re-creates the file), `trash-file` (to Drive's bin; the row stays), and
`bin-folder` (row dropped). Content is written at most once per item per write interval (5 min, up to 30 min under
back-off), unless `flush`. A run-fatal error (abort, reconnect, budget, rate limit, auth, network, timeout) ends the
run; any other marks the item in `drive_failures` and carries on.

### Open with and import

`resolveOpen`: no file reachable is `allow_access`; no app by `lwApp`, MIME or extension is `not_ours`; no `lwItemId`
is `import/shared`; another `lwOrigin` is `import/other_environment`; a row naming another file is `import/copy`; the
person's own live item with a URL is `open`, else `import/shared`. `importCopy` downloads at most 32 MiB, checks the
envelope's `kind`, and calls the app's import door with `{ owner, folderId: null, name, file }`.

## Interfaces and contracts

Every answer is JSON with `Cache-Control: private, no-store`; errors are `{ error: DriveErrorCode }` with
`STATUS_OF`: `drive_not_configured` 503, `unauthorised` 401, `not_connected` 404, `needs_reconnect` 409,
`invalid_request` 400, `invalid_state` 400, `rate_limited` 429, `not_found` 404, `file_too_large` 413,
`google_failed` 502. Bodies over 16 KiB or not a JSON object are `invalid_request`.

### Browser routes (`/api/drive/<route>`, an account access token)

| Route                   | Request                    | Answers                                                                                                                                                                      |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET config`            | token optional             | `{ enabled, connected, clientId, pickerKey, appId }`; all off when not configured                                                                                            |
| `GET connection`        |                            | `DriveConnectionAnswer`: `{ connected: false }` or `{ connected, status, rootFolderName, connectedAt, lastSyncedAt, syncing, progress, items, notices, pendingSwitchUntil }` |
| `DELETE connection`     |                            | `204`                                                                                                                                                                        |
| `POST state`            | `{ returnTo? }`            | `{ state, redirectUri, authUrl }`                                                                                                                                            |
| `POST connect`          | `{ code, state }`          | `{ outcome: 'connected' \| 'no_refresh_token', returnTo }` or `{ outcome: 'switch_pending', returnTo, until }`; `400 invalid_state`; `502`                                   |
| `POST account-switch`   |                            | the connection; `404` none or expired                                                                                                                                        |
| `DELETE account-switch` |                            | `204`                                                                                                                                                                        |
| `POST check`            |                            | the connection; `404 not_connected`                                                                                                                                          |
| `GET marks`             |                            | `{ marks: [{ id, kind, state, notice }] }`                                                                                                                                   |
| `POST picker-token`     |                            | `{ accessToken, expiresAt }`; `404`, `409`, `429` (10 a minute), `502`                                                                                                       |
| `POST adopt`            | `{ folderId, itemId? }`    | `204`; `400` not a folder; `404`; `409`; `502`                                                                                                                               |
| `POST open`             | `{ fileId, resourceKey? }` | `DriveOpenAnswer`: `open`, `import` (`copy`, `shared`, `other_environment`), `not_ours`, `allow_access`                                                                      |
| `POST import`           | `{ fileId, resourceKey? }` | `{ app, itemId, url }`; `400`, `404`, `413`, `502`                                                                                                                           |

A route but `config` answers `503` when not configured, then `401` without an account token.

### Service routes

| Route                              | Caller   | Auth                        | Answers                                                                                    |
| ---------------------------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `POST /api/drive/push`             | Google   | `X-Goog-Channel-Token`      | always `200` at once; `sync` ignored; a bad token logged; else `signal` after the response |
| `POST /app/changes` `{ personId }` | index    | `Bearer DRIVE_KEY_INDEX`    | `204` after `signal`; `400`; `401`                                                         |
| `DELETE /app/people/:personId`     | accounts | `Bearer DRIVE_KEY_ACCOUNTS` | `204` disconnected; `404` none                                                             |

### Calls out

- **Index** (`INDEX` binding, base `https://index/api/index`, else `INDEX_URL`): `Bearer INDEX_KEY_DRIVE`,
  `X-Index-App: drive`, `X-Index-Person: <id>`; items, folders, trash, get, update, delete, restore, folder routes;
  and `GET|PUT|DELETE /app/people/:id/drive` for the `drive_mirrored` flag.
- **Apps** (`APP_ORIGIN_<APP>`, `Bearer DRIVE_KEY_<APP>`, 20 s): `GET /api/internal/items/:id/export?format=file`
  (`200` with an `ETag` version, `404` skipped), `?format=svg` (thumbnail), `POST /api/internal/items/import` (`201
{ id }`, `400`, `413`).
- **Google** (10 s per call): OAuth code exchange, refresh, revoke, the account id; Drive files, changes, watch, stop.

## Data and persistence

The object's SQLite (`new_sqlite_classes = ["DriveMirror"]`, migration `v1`), made on first write; reads check
`sqlite_master` first, so a signal for someone not connected writes nothing.

| Table              | Key              | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drive_connection` | `id = 1` (CHECK) | `person_id`, `sealed_refresh`, `google_account`, `connected_at`, `status`, `root_id`, `root_name`, `page_token`, `pending_sealed`, `pending_account`, `pending_until`, `channel_id`, `channel_resource`, `channel_expires_at`, `channel_failed_at`, `backoff_level` (0), `backoff_error_at`, `last_pass_at`, `last_synced_at`, `syncing` (0), `progress_done`, `progress_total`, `flush_next` (0), `picker_window_start`, `picker_count` (0) |
| `drive_items`      | `(kind, id)`     | `app`, `drive_file_id` UNIQUE, `name`, `parent_id`, `trashed`, `md5`, `head_revision_id`, `local_name`, `mirrored_updated_at`, `content_written_at`, `notice`, `notice_parent_id`, `seen_updated_at`                                                                                                                                                                                                                                         |
| `drive_failures`   | `id`             | `at`                                                                                                                                                                                                                                                                                                                                                                                                                                         |

`putRow` first deletes any other row naming the same Drive file. The alarm is the object's one alarm. The access token
lives only in memory. Sealed tokens are `v1.<iv>.<ciphertext>`, AES-GCM under `DRIVE_TOKEN_KEY`, a 12-byte IV, the
person id as additional data. The consent `state` and the channel token are HMAC-SHA256 under HKDF-derived keys
(`liveworkspace drive state`, `liveworkspace drive channel`); the state expires in 10 minutes and carries
`{ sub, redirectUri, returnTo, exp, nonce }`.

## Errors and edge cases

| Case                                       | Behaviour                                                      |
| ------------------------------------------ | -------------------------------------------------------------- |
| `DRIVE_TOKEN_KEY` set but not 32 bytes     | not configured; `drive: key-invalid` once per isolate          |
| A row naming another person                | refused, `person-mismatch`                                     |
| The index list longer than 100 pages       | the pass throws; nothing binned                                |
| Page token rejected                        | restart from now and adopt                                     |
| Root deleted in Drive                      | rows cleared; a new root next batch                            |
| A file deleted in Drive the mirror updates | re-created where it belongs                                    |
| A folder move making a cycle               | refused by the index; Drive put back                           |
| Item moved into a team or purged           | its file to Drive's bin, row kept (the index can't tell which) |
| A push with a bad token                    | `200`, logged `push-refused`                                   |
| A pass past 800 subrequests                | stops cleanly, continues in 1 s                                |
| Index flag write fails                     | logged; the fallback check covers it                           |
| A switch never answered                    | revoked on the next alarm past 30 min                          |

## Security and trust

- Only account tokens reach a mirror (`claims.kind === 'account'`); push maps to a person by a signed token, never a
  lookup; service calls carry their own keys, compared in constant time.
- A root counts only when the person owns it (anyone can tag and share a folder). `returnTo` must be liveworkspace's
  or an app's origin in this environment, http(s), no userinfo, at most 2,048 characters.
- Refresh tokens are sealed at rest and bound to the person; consent always asks (`prompt=consent`), so a refresh
  token comes back; every grant left behind is revoked.
- Logs carry ids and error kinds (name, status, reason, kind), never names, addresses or messages.

## Performance and limits

Per invocation: 800 subrequests (`DRIVE_PASS_SUBREQUEST_BUDGET`), counted before each request; `cpu_ms = 120000`. Per
pass: 40 writes, 200 inbound changes with an effect. Thumbnails: 440 px long side, at most 2,000,000 bytes, resvg
loaded on first use. Uploads over 5 MiB go resumable. Picker tokens: 10 a minute per person.

## Observability

Every line is `drive: <step>` with ids. `driveLog`: `route <name>`, `connect`, `account-switch`, `disconnect`,
`revoke`, `check`, `root-found`, `root-created`, `channel-open`, `channel-stopped`, `pass`, `budget-spent`,
`inbound`, `inbound-batch`, `inbound-ignored`, `inbound-foreign-copy`, `inbound-forget`, `adopted`,
`adopt-existing`, `adopt-folder`, `outbound`, `recreated`, `deferred`, `export-missing`, `open-with`,
`open-with-imported`, `account-deleted`. `driveWarn`: `key-invalid`, `person-mismatch`, `connect exchange-failed`,
`flag-failed`, `token unreadable`, `token invalid_grant`, `revoke-skipped token_unreadable`, `channel-failed`,
`channel-stop-failed`, `root-missing`, `backoff`, `pass-failed`, `alarm-failed`, `page-token-rejected`,
`inbound-cycle`, `inbound-missing`, `adopt-ambiguous`, `adopt-failed`, `outbound-failed`, `thumbnail-failed`,
`import-refused`, `import-download-failed`, `push-refused`, `push-signal-failed`, `<route>-failed`.

## Testing

| Test                                                                        | Pins                                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/drive/src/routes.test.ts` (15)                                        | config off and on; who may call; connecting through the routes; Google's push; open and import; the index's and accounts' calls |
| `apps/drive/src/mirror/mirror.test.ts` (19)                                 | connecting; another Google account; disconnecting; Check now; the Picker's token; marks; adopting a folder; Open with           |
| `apps/drive/src/mirror/pass.test.ts` (21)                                   | the first mirror; the root; outbound; inbound; cadence                                                                          |
| `apps/drive/src/mirror/budget.test.ts` (3)                                  | a burst of Drive-side changes stays in budget; the meter                                                                        |
| `apps/drive/src/consent.test.ts` (3)                                        | `safeReturnTo`; the channel token                                                                                               |
| `packages/drive/src/plan/plan-inbound.test.ts` (53)                         | items, folders, unrecorded files, adoption, change order                                                                        |
| `packages/drive/src/plan/plan-outbound.test.ts` (30)                        | first mirror, folders, items, contents and the write interval, items leaving, order                                             |
| `packages/drive/src/plan/snapshot.test.ts` (6)                              | the snapshot                                                                                                                    |
| `packages/drive/src/server/*.test.ts` (59)                                  | sealing, state, the Drive client and channels, OAuth calls and their timeout                                                    |
| `packages/drive/src/{backoff,base64,client,constants,formats}.test.ts` (44) | back-off, base64, the browser client, the cadence, formats and names                                                            |

## Constants and configuration

| Constant                                       | Value           | Used by                         |
| ---------------------------------------------- | --------------- | ------------------------------- |
| `DRIVE_STATE_TTL_MS`                           | 10 min          | consent `state`                 |
| `DRIVE_ACCOUNT_SWITCH_TTL_MS`                  | 30 min          | a pending switch                |
| `DRIVE_PASS_DEBOUNCE_MS`                       | 30 s            | `signal`                        |
| `DRIVE_ITEM_MIN_WRITE_INTERVAL_MS` / `_MAX_MS` | 5 min / 30 min  | content writes                  |
| `DRIVE_FALLBACK_CHECK_MS`                      | 30 min          | no live channel; channel retry  |
| `DRIVE_FALLBACK_CHECK_WATCHED_MS`              | 6 h             | a live channel                  |
| `DRIVE_FALLBACK_CHECK_MAX_MS`                  | 6 h             | back-off ceiling                |
| `DRIVE_CHECK_MIN_GAP_MS`                       | 30 s            | `check`; a failed alarm's retry |
| `DRIVE_PASS_MAX_WRITES`                        | 40              | outbound batch                  |
| `DRIVE_PASS_CONTINUE_MS`                       | 1 s             | the next batch                  |
| `DRIVE_PASS_MAX_INBOUND`                       | 200             | inbound batch                   |
| `DRIVE_PASS_SUBREQUEST_BUDGET`                 | 800             | `SubrequestMeter`               |
| `DRIVE_CHANGES_PAGE_SIZE`                      | 1000            | `listChanges`                   |
| `DRIVE_BACKOFF_CALM_MS` / `_MAX_LEVEL`         | 1 h / 5         | back-off                        |
| `DRIVE_TOKEN_RENEW_BEFORE_MS`                  | 1 min           | `TokenSource`                   |
| `DRIVE_CHANNEL_TTL_MS` / `_RENEW_BEFORE_MS`    | 7 d / 24 h      | the push channel                |
| `DRIVE_MULTIPART_MAX_BYTES`                    | 5 MiB           | uploads                         |
| `DRIVE_IMPORT_MAX_BYTES`                       | 32 MiB          | import                          |
| `DRIVE_THUMBNAIL_PX` / `_MAX_BYTES`            | 440 / 2,000,000 | thumbnails                      |
| `DRIVE_PICKER_TOKENS_PER_MINUTE`               | 10              | `pickerToken`                   |
| `GOOGLE_CALL_TIMEOUT_MS`                       | 10 s            | Google calls                    |
| `DRIVE_LIST_PAGES_MAX`                         | 100             | `everyPage`                     |
| `DRIVE_NAME_MAX` / `LOCAL_NAME_MAX`            | 1024 / 200      | names                           |
| `DOOR_TIMEOUT_MS` (`app-doors.ts`)             | 20 s            | the apps' doors                 |
| `MAX_BODY_BYTES` (`http.ts`)                   | 16 KiB          | `readObject`                    |
| `OUTBOUND_OP_COST` / `INBOUND_CHANGE_COST`     | 6 / 4           | the meter's headroom            |
| `TOKEN_MAX` (`channel-token.ts`)               | 256             | channel tokens                  |
| `RETURN_MAX` (`consent.ts`)                    | 2048            | `returnTo`                      |

| Setting                            | Production                                                                                                                                                     | Staging                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Name                               | `liveworkspace-drive`                                                                                                                                          | `liveworkspace-drive-staging`          |
| Route                              | `liveworkspace.app/api/drive*`                                                                                                                                 | `staging.liveworkspace.app/api/drive*` |
| `ENVIRONMENT`                      | `production`                                                                                                                                                   | `staging`                              |
| `GOOGLE_CLIENT_ID`                 | one OAuth client for both                                                                                                                                      | the same                               |
| `DRIVE_PUBLIC_URL`, `ACCOUNTS_URL` | `https://liveworkspace.app`                                                                                                                                    | `https://staging.liveworkspace.app`    |
| `INDEX_AUDIENCES`                  | the four apps' `/api` origins                                                                                                                                  | their staging origins                  |
| `APP_ORIGIN_<APP>`                 | livediagram's router workers.dev, `liveplanner.app`, `livedocuments.app`, `livedesign.app`                                                                     | their staging origins                  |
| Service `INDEX`                    | `liveworkspace-index`                                                                                                                                          | `liveworkspace-index-staging`          |
| Durable Object                     | `DRIVE_MIRROR` → `DriveMirror`                                                                                                                                 | the same                               |
| `[limits] cpu_ms`                  | 120000                                                                                                                                                         | (top level)                            |
| Secrets                            | `GOOGLE_CLIENT_SECRET`, `GOOGLE_PICKER_KEY`, `GOOGLE_APP_ID`, `DRIVE_TOKEN_KEY`, `INDEX_KEY_DRIVE`, `DRIVE_KEY_INDEX`, `DRIVE_KEY_ACCOUNTS`, `DRIVE_KEY_<APP>` | the same                               |

Locally (`.dev.vars.example`): `ENVIRONMENT=development`, `localhost:3000` for liveworkspace, the index on
`localhost:8793`, the four routers on 3100 to 3400, `dev-…` keys; the Google values blank (Drive off).

## Assets and external resources

Google OAuth and the Drive v3 API; the Picker (browser, `GOOGLE_PICKER_KEY`, `GOOGLE_APP_ID`);
`@liveworkspace/render-png` for thumbnails; the `INDEX` binding and the apps' doors.

## Defaults ledger

- `DRV1`: the staging Worker inherits the top-level `[limits] cpu_ms`; wrangler does not repeat it per environment.
- `DRV2`: Google's `GOOGLE_APP_ID` and Picker key are optional; without them the config answer carries `null`.
