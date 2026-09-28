# Google Drive mirror: blueprint

Derived from [Google Drive mirror](../drive-mirror.md). The spec decides; this file adds engineering precision.
Google facts (fields, units, errors) come from
[Migration readiness, section A](../../../research/migration-readiness.md#a-google-drive-two-way-mirror).
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                  | Role                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/api-schema/src/drive.ts`                    | Wire types, `DriveMode`, `DRIVE_*` shared constants, `driveFileName`        |
| `apps/api/migrations/0054_drive_mirror.sql`           | `drive_connections`, `drive_items`                                          |
| `apps/api/src/drive/config.ts`                        | `driveMode(env)`, the Google OAuth origin                                   |
| `apps/api/src/drive/crypto.ts`                        | AES-GCM seal / open of the refresh token                                    |
| `apps/api/src/drive/state.ts`                         | Signed consent `state`                                                      |
| `apps/api/src/drive/google-oauth.ts`                  | Code exchange, refresh, revoke                                              |
| `apps/api/src/db/drive.ts`                            | Every statement on the two tables                                           |
| `apps/api/src/routes/drive.ts`                        | `/api/drive/*`                                                              |
| `apps/api/src/db/diagram-removal.ts`                  | Drops the doomed diagrams' `drive_items`                                    |
| `apps/api/src/db/folders.ts`                          | `deleteFolder` is one batch, dropping the folder's `drive_items`            |
| `apps/api/src/db/account.ts`                          | Account deletion revokes and drops the Drive rows                           |
| `apps/api/src/routes/capabilities.ts`                 | `driveMode`                                                                 |
| `apps/api/src/openapi/manifest.ts`                    | The Drive routes, tag `Drive`                                               |
| `packages/fake-google/`                               | The fake Google (Drive REST + OAuth) every test uses                        |
| `apps/live/lib/export-diagram-text.ts`                | The `livediagram.diagram` envelope                                          |
| `apps/live/lib/api/drive.ts`                          | Wire calls to `/api/drive/*`                                                |
| `apps/live/lib/drive/config.ts`                       | Client id, Picker key, `driveUiMode`                                        |
| `apps/live/lib/drive/cadence.ts`                      | Every cadence constant                                                      |
| `apps/live/lib/drive/log.ts`                          | `driveLog`, the `[drive-mirror]` fingerprint                                |
| `apps/live/lib/drive/drive-client.ts`                 | `DriveClient` interface, `DriveApiError`                                    |
| `apps/live/lib/drive/drive-rest-client.ts`            | `DriveClient` over Google's REST API                                        |
| `apps/live/lib/drive/thumbnail.ts`                    | SVG snapshot to PNG `contentHints.thumbnail`                                |
| `apps/live/lib/drive/livediagram-port.ts`             | `LivediagramPort` interface + implementation over `lib/api`                 |
| `apps/live/lib/drive/snapshot.ts`                     | `MirrorSnapshot` and its indexes                                            |
| `apps/live/lib/drive/plan-outbound.ts`                | Pure: snapshot + items to outbound ops                                      |
| `apps/live/lib/drive/plan-inbound.ts`                 | Pure: a change + snapshot + items to an inbound decision                    |
| `apps/live/lib/drive/tombstones.ts`                   | Per-browser memory of the rows last seen                                    |
| `apps/live/lib/drive/backoff.ts`                      | The back-off state machine                                                  |
| `apps/live/lib/drive/engine.ts`                       | `DriveMirrorEngine`: passes, triggers, lease, token, status                 |
| `apps/live/lib/drive/pass-context.ts`                 | One pass's snapshot, pending item rows and dependencies; the 409 retry      |
| `apps/live/lib/drive/engine-inbound.ts`               | Applies inbound decisions through the port                                  |
| `apps/live/lib/drive/engine-outbound.ts`              | Runs outbound ops against Drive, records what Google returns                |
| `apps/live/lib/drive/browser-engine.ts`               | The engine as a tab runs it: real fetch, timers, storage, telemetry mapping |
| `apps/live/lib/api/core.ts`                           | `registerTokenProvider`: the Bearer stays while any session mount remains   |
| `apps/live/lib/drive/token-source.ts`                 | Broker and browser-only (GIS) token sources                                 |
| `apps/live/lib/drive/consent.ts`                      | Google authorisation URL, pending-return memory                             |
| `apps/live/lib/drive/google-scripts.ts`               | Google Identity Services and Picker loaders, `FolderPicker`                 |
| `apps/live/lib/drive/open-with.ts`                    | `/drive/open` state parsing and outcome decision                            |
| `apps/live/lib/drive/tab-election.ts`                 | Web Locks election + BroadcastChannel relay                                 |
| `apps/live/components/drive/DriveMirrorProvider.tsx`  | Mounts the engine in the elected tab, publishes status                      |
| `apps/live/components/drive/drive-mirror-context.ts`  | `useDriveMirror`, `useDriveNotice`, the context value                       |
| `apps/live/components/drive/DriveConnected.tsx`       | `/drive/connected`: redeems the code once, returns to the page              |
| `apps/live/components/drive/DriveOpen.tsx`            | `/drive/open`: sign-in, Allow access, open, Import a copy, errors           |
| `apps/live/components/chrome/LandingCard.tsx`         | The centred landing card `/join` and the Drive routes share                 |
| `apps/live/components/providers/E2EAuthBridge.tsx`    | Test builds only: a signed-in session from a test-minted JWT                |
| `apps/live/e2e/drive-mirror.spec.ts`                  | The opt-in browser e2e against the fake Google                              |
| `apps/live/e2e/drive-support.ts`                      | Test JWKS, the fake Google over HTTP, routed Google traffic                 |
| `scripts/e2e-stack.mjs`                               | `E2E_DRIVE=1`: the api worker's test Drive and JWKS vars                    |
| `apps/live/components/drive/DriveDialog.tsx`          | The account menu's Google Drive panel                                       |
| `apps/live/components/drive/DriveReconnectBanner.tsx` | The quiet Needs reconnecting / Resume sync banner                           |
| `apps/live/components/drive/DriveNoticeMarker.tsx`    | The unseen-folder mark on an Explorer row                                   |
| `apps/live/app/drive/connected/page.tsx`              | The OAuth redirect target                                                   |
| `apps/live/app/drive/open/page.tsx`                   | The Drive UI integration's Open URL                                         |

## Domain and naming

| Term           | Identifier                                        | Meaning                                                                   |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Mirror         | `drive-mirror`                                    | The copy of Personal Space in the user's Drive                            |
| Connection     | `drive_connections` row, `DriveConnection`        | One user's grant and mirror state                                         |
| Mode           | `DriveMode`: `off` \| `browser` \| `broker`       | How the deployment gets Google access tokens                              |
| Status         | `DriveConnectionStatus`                           | `connected` \| `needs_reconnect`                                          |
| Item           | `drive_items` row, `DriveItem`                    | One mirrored diagram or folder and the Drive state livediagram last wrote |
| Item kind      | `DriveItemKind`: `diagram` \| `folder`            |                                                                           |
| Root           | `root_folder_id`                                  | The `livediagram` folder; Unsorted                                        |
| Diagram file   | `.livediagram` file                               | A diagram's mirror                                                        |
| Envelope       | `DiagramEnvelope`, `livediagram.diagram`          | The file's contents                                                       |
| Drive state    | `fileState(file)`                                 | `{ name, parentId, trashed, md5, headRevisionId }` of one Drive file      |
| Echo           | `planInbound` answering `echo`                    | A change whose Drive state equals the item's: livediagram's own write     |
| Foreign change | the differing attributes in `planInbound`         | The attributes of a change that differ from the item                      |
| Pass           | `DriveMirrorEngine.pass(kind)`                    | One run: token, snapshot, inbound, outbound                               |
| Inbound        | `planInbound`                                     | Drive to livediagram                                                      |
| Outbound       | `planOutbound`                                    | livediagram to Drive                                                      |
| Lease          | `lease_holder`, `lease_expires_at`                | Which device may write outbound                                           |
| Device id      | `livediagram:v2:drive-device`                     | A per-browser random id, the lease holder                                 |
| Elected tab    | Web Lock `livediagram:drive-mirror`               | The one tab per browser that runs the engine                              |
| Tombstone      | `SeenRow` in a `SeenStore`                        | A row this browser saw that has since disappeared                         |
| Notice         | `notice = 'unseen_folder'`                        | The item was moved in Drive to a folder livediagram cannot see            |
| Adoption       | `adoptFolder`                                     | Showing an unseen folder to livediagram with the Picker                   |
| Foreign file   | `resolveOpenWith` = `import` (`foreign`, `no-id`) | A `.livediagram` file from another deployment, or with no `ldDiagramId`   |

Banned synonyms: "sync target", "backup", "Drive location", "Drive save". The mirror is never where a diagram lives.

## Behaviour and state

### Deployment mode

`driveMode(env)` (api) and `driveUiMode(capabilities)` (live):

| api `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` and `DRIVE_TOKEN_KEY` | `driveMode` | live, with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | live, without it |
| ---------------------- | -------------------------------------------- | ----------- | ----------------------------------------- | ---------------- |
| unset                  | any                                          | `off`       | no Drive entry                            | no Drive entry   |
| set                    | either unset                                 | `browser`   | browser-only tokens                       | no Drive entry   |
| set                    | both set                                     | `broker`    | broker tokens                             | no Drive entry   |

A `DRIVE_TOKEN_KEY` that does not decode to 32 bytes counts as unset and logs `drive: key_invalid` once per isolate.

### Connection states (live)

`DriveMirrorState`, published by the engine (and relayed to the other tabs):

| State             | Means                                          | Panel shows                                   |
| ----------------- | ---------------------------------------------- | --------------------------------------------- |
| `starting`        | Auth or the first pass not settled             | "Checking your Google Drive connection…"      |
| `disconnected`    | No connection row                              | **Connect Google Drive**                      |
| `idle`, `syncing` | Row with status `connected` and a usable token | **Sync now**, **Last synced**, **Disconnect** |
| `needs_reconnect` | Row with status `needs_reconnect`              | **Reconnect**, **Disconnect**                 |
| `needs_resume`    | Browser-only mode, the token lapsed            | **Resume sync**, **Disconnect**               |

Transitions (`idle` / `syncing` read as connected): `disconnected` to `idle` by `/drive/connected` (broker) or the GIS grant (browser); `connected` to
`needs_reconnect` when `POST /api/drive/token` answers `409 drive_needs_reconnect`; `needs_reconnect` to `connected`
by a new consent; `connected` to `needs_resume` when the browser-only token expires; `needs_resume` to `connected`
by the **Resume sync** click; any state to `disconnected` by **Disconnect**.

### Passes

`DriveMirrorEngine` runs one pass at a time (a second trigger while one runs sets `rerun` and returns). A pass:

1. **Token.** `tokenSource.get()`; failure ends the pass with the matching state.
2. **Snapshot.** In parallel: `port.listPersonalDiagrams()`, `port.listPersonalFolders()`, `port.listPersonalTrash()`,
   `port.getConnection()`, `port.listItems()`. Build `MirrorSnapshot`.
3. **Root.** When `rootFolderId` is null (first mirror, or after a reconnect): if `pageToken` is null, take
   `changes.getStartPageToken` first, so every later write is read back and recognised as an echo (D1). Then look
   for a folder with `appProperties has { key='ldRoot' and value='<host>' }` and `trashed=false`; reuse the first,
   else create `livediagram` in My Drive with `ldRoot`. `PUT /api/drive/connection { rootFolderId, pageToken }`.
   Then **adopt**: list every file with `appProperties has { key='ldOrigin' and value='<host>' }` and record an item
   for each whose `ldDiagramId` / `ldFolderId` names a personal diagram, trashed diagram or folder with no item yet,
   using the file's current Drive state (the `adopt` decisions of `planInbound`), then re-read the snapshot. On an
   `arrival` pass a recorded root is checked once (`files.get`): a 404 makes it null again; a binned root stays the
   root.
4. **Inbound** (`changes.list` from the page token, `pageSize` `DRIVE_CHANGES_PAGE_SIZE`, every page, fields
   `DRIVE_CHANGE_FIELDS`), see [Inbound](#inbound). Skipped when the pass kind is `write` (an idle write or a flush).
   After inbound applied anything, the snapshot is re-read.
5. **Lease.** `POST /api/drive/lease { holder }` when the outbound plan is non-empty and the lease this device holds
   expires within `DRIVE_LEASE_RENEW_BEFORE_MS` (or is not held). Not acquired: publish `leaseHeldElsewhere`, skip
   step 6.
6. **Outbound**, see [Outbound](#outbound).
7. **Page token.** Persist the new token when it changed and `now - pageTokenSavedAt >= DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS`,
   or the pass kind is `flush`.
8. Publish `lastSyncedAt = now`, clear `error`, remember the rows seen (tombstones), fire `FirstMirrorFinished` once.

Pass kinds and triggers:

| Kind      | Trigger                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `arrival` | The tab is elected and the connection is `connected`                                                             |
| `poll`    | Every `DRIVE_POLL_INTERVAL_MS` x back-off while `document.visibilityState === 'visible'`                         |
| `focus`   | `focus` or `visibilitychange` to visible, when the last inbound read is older than `DRIVE_FOCUS_POLL_MIN_GAP_MS` |
| `write`   | `DRIVE_WRITE_IDLE_MS` after the last api write signal (`subscribeApiWrites`, relayed across tabs)                |
| `flush`   | `visibilitychange` to hidden, `pagehide`, and `requestDriveFlush()` when the editor leaves a diagram             |
| `manual`  | **Sync now**                                                                                                     |

Polls are scheduled only while the state is `idle`: a disconnected or needs-reconnecting engine waits for a trigger.
A trigger during a pass queues one more pass (a `flush` outranks the rest) and resolves when that later pass ends.
Signals raised by the engine's own api calls are ignored (`applying` flag). After a `flush` the lease is released
(`DELETE /api/drive/lease`, `keepalive`).

### Outbound

`planOutbound(snapshot, items, tombstones, opts)` returns ops in this order; the engine runs them in order and
stops the pass on a rate-limit error. `expectedParent(folderId)` is the folder's item `driveFileId`, else the root.

1. **Folders, parents before children** (depth order):
   - no item: `createFolder { name, parentId: expectedParent(parentId), appProperties: { ldFolderId, ldOrigin } }`.
   - item: `updateFolder` with the differing of: `name` when `folder.name !== item.ldName`; parents when
     `expectedParent(folder.parentId) !== item.parentId`; `trashed: false` when `item.trashed`.
2. **Live diagrams, oldest `createdAt` first:**
   - no item: `createFile` (content, thumbnail, `appProperties { ldDiagramId, ldOrigin }`, name
     `driveFileName(name)`, parent `expectedParent(folderId)`). A notice is never set by outbound.
   - item: metadata `updateFile` with the differing of name (`name !== item.ldName`, or Drive's recorded name strips
     to nothing), parents, `trashed: false`.
     A move clears the item's notice.
   - content (the `content` flag of an `update-file` op) when `savedAt > (item.mirroredSavedAt ?? 0)` and, unless the kind is `flush`,
     `now - savedAt >= DRIVE_WRITE_IDLE_MS` and `now - lastContentWrite(id) >= DRIVE_WRITE_MIN_INTERVAL_MS` x back-off.
     A deferred upload schedules a `write` pass for the moment it becomes due.
3. **Trashed personal diagrams** with an item not trashed: `updateFile { trashed: true }`.
4. **Items of diagrams neither live nor trashed in Personal Space** (moved into a team) not trashed:
   `updateFile { trashed: true }`; the row stays, so a move back out restores it (step 2).
5. **Tombstones:** for each: `getFile`; 404 or already gone: drop. Diagram: `trashed` then `deleteFile`, else
   `updateFile { trashed: true }`. Folder: `updateFile { trashed: true }` (its contents moved up in steps 1 and 2).

Every write asks Google for `DRIVE_FILE_FIELDS` and records the returned state with `PUT /api/drive/items`
(`ldName` the livediagram name written; `mirroredSavedAt` the `savedAt` of the content uploaded). Writes are
batched: the engine flushes recorded items every `DRIVE_ITEMS_PUT_BATCH` rows and at the end of the pass.
A **404** on an update re-creates the item in its expected place (a create op) and records the new file id.

### Inbound

Changes are coalesced to **one per file, the latest** (each entry carries the file's current state, so only the
last entry's `time` dates it), then sorted **folders first**, then files, each in `time` order. `planInbound(change, snapshot, items)`
returns one `InboundDecision`:

| Situation                                                                              | Decision                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| No item for `fileId`, file lacks `ldOrigin === host`                                   | `ignore` (not ours, or the root)                              |
| No item, `ldFolderId` names no folder, file not trashed                                | `recreate-folder` (same id, parent by Drive parent)           |
| No item, `ldFolderId` or `ldDiagramId` names a known entity                            | `adopt` (record the item, then re-plan)                       |
| `removed`, diagram item, diagram in the personal Trash                                 | `purge`                                                       |
| `removed`, diagram item, diagram live                                                  | `forget-file` (item dropped; outbound re-creates)             |
| `removed`, diagram item, diagram outside Personal Space                                | `forget-file`                                                 |
| `removed`, folder item                                                                 | `forget-file` (outbound re-creates it while the folder lives) |
| No foreign field                                                                       | `echo`                                                        |
| Folder item, `trashed` became true                                                     | `bin-folder`                                                  |
| Diagram item, `trashed` became true, diagram live                                      | `trash`                                                       |
| Diagram item, `trashed` became false, diagram in the personal Trash                    | `restore` then placement by Drive parent                      |
| Name changed, livediagram name unchanged since sync (`name === ldName`) or Drive later | `rename` to `stripDriveName(file.name)`; empty keeps the old  |
| Parent changed, livediagram parent unchanged or Drive later, parent a mirrored folder  | `move` to that folder                                         |
| Parent changed, same, parent the root                                                  | `move` to Unsorted                                            |
| Parent changed, same, parent unknown or none                                           | `move` to Unsorted (diagram) or top level (folder), `notice`  |
| Only `md5` / `headRevisionId` changed                                                  | `rewrite` (item `mirroredSavedAt` set to 0)                   |
| The value livediagram already holds                                                    | recorded only                                                 |

"Drive later" is `Date.parse(change.time) > ldChangedAt`, `ldChangedAt` being the diagram's `savedAt` or the
folder's `updatedAt`. A decision may carry several effects (a restore that also moves). After applying, the item
is always recorded with the file's Drive state, so a lost conflict is corrected by the next outbound pass.

`bin-folder`: every live personal diagram in the folder's livediagram subtree goes to the Trash (`DELETE
/api/diagrams/:id`), then the subtree's folders are deleted deepest first (`DELETE /api/folders/:id`, which drops
their items in its batch). `recreate-folder` re-creates the folder with its old id (`POST /api/folders`), records
its item, then lists the folder's children (`files.list q="'<id>' in parents"`) and plans each as a change, so the
diagrams restored with it come back inside it whether or not Drive emitted a change per child.

Every applied decision goes through the ordinary routes via `LivediagramPort` and fires
`track('Drive', 'Applied', type)`.

### Tombstones

`localSeenStore` keeps, per owner, in `localStorage` key `livediagram:v2:drive-seen:<ownerId>`, the rows the last
pass saw as `[kind, ldId, driveFileId]`. At the start of outbound, a remembered row that is no longer an item and
whose entity is neither a live personal diagram / folder nor in the personal Trash becomes a tombstone op. The
memory is rewritten at the end of each pass and cleared on disconnect.

### Tab election

`electDriveTab(onElected)` calls `navigator.locks.request('livediagram:drive-mirror', () => new Promise(release))`;
the holder runs the engine until `stop()`, which resolves the promise. Without `navigator.locks` every tab is
elected (D2). A `BroadcastChannel('livediagram:drive-mirror')` carries `status` (from the elected tab), `hello`
(asks for status), `write` (an api write in a non-elected tab), `flush`, `sync-now`, `adopt`, and in browser-only mode `token` (a grant made in a
non-elected tab, handed to the elected one).

### Back-off

`Backoff` holds `level` (0..`DRIVE_BACKOFF_MAX_LEVEL`) and `lastErrorAt`. `hit(now)`: `level + 1`. `factor(now)`:
0 when `now - lastErrorAt >= DRIVE_BACKOFF_CALM_MS` (then `level` resets), else `2 ** level`. Poll interval is
`min(DRIVE_POLL_INTERVAL_MS * factor, DRIVE_POLL_INTERVAL_MAX_MS)`, write interval
`min(DRIVE_WRITE_MIN_INTERVAL_MS * factor, DRIVE_WRITE_MIN_INTERVAL_MAX_MS)`.

### Open with

`parseOpenState(search)` reads `state` as JSON; `ids[0]` is the file, `resourceKeys[id]` its key. Outcomes of
`resolveOpenWith({ drive, port, host }, state)`:

| File                                                             | Outcome                       | Telemetry       |
| ---------------------------------------------------------------- | ----------------------------- | --------------- |
| `ldDiagramId`, `ldOrigin === host`, `port.canOpenDiagram` true   | `open`                        | `Opened`        |
| `ldDiagramId`, `ldOrigin === host`, cannot open (404, 403, 410)  | `import` (`no-access`)        | `ImportOffered` |
| our MIME or `.livediagram`, other `ldOrigin` or no `ldDiagramId` | `import` (`foreign`, `no-id`) | `ImportOffered` |
| anything else, 404, 403 or unreadable                            | `error`                       | `Error`         |

`import` shows **Import a copy**: download (`alt=media`), `parseDiagramEnvelope`, then
`port.importDiagramCopy` (fresh diagram and tab ids, tab links remapped with `remapTabLinks`, the deck carried).
Signed out: redirect to `/sign-in?redirect_url=<this URL>`. No usable token: **Allow access** runs the consent flow
with the pending return set to this URL.

## Interfaces and contracts

### Wire types (`@livediagram/api-schema`, `drive.ts`)

```ts
type DriveMode = 'off' | 'browser' | 'broker';
type DriveConnectionStatus = 'connected' | 'needs_reconnect';
type DriveItemKind = 'diagram' | 'folder';
type DriveNotice = 'unseen_folder';
type DriveConnection = {
  status: DriveConnectionStatus;
  hasRefreshToken: boolean;
  rootFolderId: string | null;
  pageToken: string | null;
  pageTokenSavedAt: number | null;
  connectedAt: number;
};
type DriveItem = {
  kind: DriveItemKind;
  ldId: string;
  driveFileId: string;
  name: string;
  ldName: string;
  parentId: string | null;
  trashed: boolean;
  md5: string | null;
  headRevisionId: string | null;
  mirroredSavedAt: number | null;
  notice: DriveNotice | null;
  noticeParentId: string | null;
};
type DriveLease = { acquired: boolean; holder: string | null; expiresAt: number | null };
type DriveAccessToken = { accessToken: string; expiresAt: number };
```

### Routes (`routes/drive.ts`)

Every route: `503 drive_not_configured` when `driveMode` is `off`; `401 sign_in_required` without `ctx.clerkUserId`
(guest header and API token both refused); owner is `ctx.clerkUserId`. Each logs `drive: <route> <outcome>`.

| Method   | Path                         | Body                                                | Success                      | Rejections                                                                                                                                         |
| -------- | ---------------------------- | --------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/drive/state`               | `{ redirectUri }`                                   | `200 { state }`              | `400 invalid_redirect_uri`; `503 drive_broker_unavailable` unless `broker`                                                                         |
| `POST`   | `/drive/connect`             | `{ code, state }`                                   | `200 { connection }`         | `400 invalid_request`, `400 invalid_state`, `502 drive_exchange_failed`, `502 drive_no_refresh_token`; `503 drive_broker_unavailable`              |
| `POST`   | `/drive/token`               | none                                                | `200 DriveAccessToken`       | `404 drive_not_connected`, `409 drive_needs_reconnect`, `429 drive_token_rate_limited`, `502 drive_refresh_failed`; `503 drive_broker_unavailable` |
| `GET`    | `/drive/connection`          |                                                     | `200 { connection \| null }` |                                                                                                                                                    |
| `PUT`    | `/drive/connection`          | `{ rootFolderId?, pageToken? }`                     | `200 { connection }`         | `400 invalid_request`; `404 drive_not_connected` (broker mode, no row)                                                                             |
| `DELETE` | `/drive/connection`          |                                                     | `204`                        |                                                                                                                                                    |
| `GET`    | `/drive/items`               |                                                     | `200 { items }`              |                                                                                                                                                    |
| `PUT`    | `/drive/items`               | `{ items: DriveItem[] }` (1..`DRIVE_ITEMS_PUT_MAX`) | `200 { items }` (as stored)  | `400 invalid_request`, `404 drive_not_connected`, `409 drive_item_conflict`                                                                        |
| `DELETE` | `/drive/items/{kind}/{ldId}` |                                                     | `204`                        | `400 invalid_request`                                                                                                                              |
| `POST`   | `/drive/lease`               | `{ holder }`                                        | `200 DriveLease`             | `400 invalid_request`, `404 drive_not_connected`                                                                                                   |
| `DELETE` | `/drive/lease?holder=`       |                                                     | `204`                        | `400 invalid_request`                                                                                                                              |

Validation: ids and file ids 1..`DRIVE_ID_MAX` characters of `[A-Za-z0-9_-]` (Drive ids) or the livediagram id
charset `[A-Za-z0-9_-]`; names 1..`DRIVE_NAME_MAX`; `holder` a 1..64 character `[A-Za-z0-9-]` string;
`redirectUri` an absolute URL whose path is `/drive/connected`, scheme `https`, or `http` on `localhost` /
`127.0.0.1`. `PUT /drive/connection` creates the row only in `browser` mode.

### Signed state (`drive/state.ts`)

`state = base64url(JSON { sub, redirectUri, exp, nonce }) + '.' + base64url(HMAC-SHA256(key, payload))`, `exp` =
now + `DRIVE_STATE_TTL_MS`, `nonce` 16 random bytes. `verifyDriveState(key, state, sub, now)` returns the
`redirectUri` or null (bad shape, bad signature, other `sub`, expired). The HMAC key is derived from
`DRIVE_TOKEN_KEY` with HKDF-SHA256 (`info = 'livediagram drive state'`), so the sealing key is never used to sign.

### Google OAuth (`drive/google-oauth.ts`)

`exchangeCode`, `refreshAccessToken`, `revokeToken`, all `POST` `application/x-www-form-urlencoded` to
`${GOOGLE_OAUTH_BASE_URL ?? 'https://oauth2.googleapis.com'}` `/token` and `/revoke`. A `400` whose JSON `error` is
`invalid_grant` becomes `GoogleOAuthError('invalid_grant')`; any other failure `GoogleOAuthError('failed')`.
Revoke is best effort: failures are logged, never thrown.

### DriveClient (`lib/drive/drive-client.ts`)

```ts
interface DriveClient {
  getStartPageToken(): Promise<string>;
  listChanges(
    pageToken: string,
  ): Promise<{ changes: DriveChange[]; nextPageToken?: string; newStartPageToken?: string }>;
  listFiles(q: string): Promise<DriveFile[]>; // every page
  getFile(id: string, resourceKey?: string): Promise<DriveFile>;
  download(id: string, resourceKey?: string): Promise<string>;
  createFolder(input: {
    name: string;
    parentId: string;
    appProperties: Record<string, string>;
  }): Promise<DriveFile>;
  createFile(input: DriveFileWrite & { name: string; parentId: string }): Promise<DriveFile>;
  updateFile(
    id: string,
    input: Partial<DriveFileWrite> & {
      name?: string;
      addParent?: string;
      removeParent?: string;
      trashed?: boolean;
    },
  ): Promise<DriveFile>;
  deleteFile(id: string): Promise<void>;
}
type DriveFileWrite = {
  content: string;
  thumbnailPng: string | null;
  appProperties: Record<string, string>;
};
```

`DriveApiError { status, reason }`: `isRateLimit` (429, or 403 with reason `userRateLimitExceeded` /
`rateLimitExceeded`), `isNotFound` (404), `isAuth` (401). Content up to `DRIVE_MULTIPART_MAX_BYTES` goes
`uploadType=multipart`; larger `uploadType=resumable` (session from `Location`, then one `PUT`).

### LivediagramPort (`lib/drive/livediagram-port.ts`)

Reads: `listPersonalDiagrams`, `listPersonalFolders`, `listPersonalTrash`, `loadEnvelope(id)`,
`loadSnapshotSvg(id)`, `canOpenDiagram(id)`. Writes: `renameDiagram`, `moveDiagram`, `trashDiagram`,
`restoreDiagram`, `purgeDiagram`, `createFolder(id, name, parentId)`, `renameFolder`, `moveFolder`, `deleteFolder`,
`importDiagramCopy(envelope)`. Mirror rows: `getConnection`, `putConnection`, `listItems`, `putItems`, `deleteItem`,
`acquireLease`, `releaseLease`. The production implementation is a thin map onto `lib/api/*`; tests use
`FakeLivediagram`.

### Envelope (`lib/export-diagram-text.ts`)

```ts
type DiagramEnvelope = {
  kind: 'livediagram.diagram';
  schemaVersion: 1;
  exportedAt: number;
  diagram: {
    id: string;
    name: string;
    presentation: string | null;
    tabs: (Tab & { folder?: string })[];
  };
};
```

`diagramToEnvelopeText(diagram, tabs)` serialises with two-space indent (stable `md5` for unchanged content apart
from `exportedAt`, D3). `parseDiagramEnvelope(text)` returns the envelope or a named failure:
`not_json`, `wrong_kind`, `unsupported_version`, `malformed`.

## Data and persistence

`0054_drive_mirror.sql`:

```sql
CREATE TABLE drive_connections (
  owner_id TEXT PRIMARY KEY,
  refresh_token_enc TEXT,
  root_folder_id TEXT,
  page_token TEXT,
  page_token_saved_at INTEGER,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect')),
  connected_at INTEGER NOT NULL,
  lease_holder TEXT,
  lease_expires_at INTEGER
);
CREATE TABLE drive_items (
  owner_id TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('diagram', 'folder')),
  ld_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ld_name TEXT NOT NULL,
  parent_id TEXT,
  trashed INTEGER NOT NULL DEFAULT 0,
  md5 TEXT,
  head_revision_id TEXT,
  mirrored_saved_at INTEGER,
  notice TEXT CHECK (notice IS NULL OR notice = 'unseen_folder'),
  notice_parent_id TEXT,
  PRIMARY KEY (owner_id, item_kind, ld_id),
  UNIQUE (owner_id, drive_file_id)
);
CREATE INDEX drive_items_ld_idx ON drive_items (item_kind, ld_id);
```

| Field                          | Class             | Notes                                                                |
| ------------------------------ | ----------------- | -------------------------------------------------------------------- |
| `refresh_token_enc`            | secret, encrypted | `v1.<iv b64url>.<ciphertext b64url>`, AAD = owner id; never read out |
| `root_folder_id`, `page_token` | mirror state      | Drive ids, not personal data                                         |
| `lease_*`                      | coordination      | Overwritten freely                                                   |
| `drive_items.name`, `ld_name`  | user content      | Diagram and folder names, as the diagrams table already holds        |
| everything else                | mirror state      |                                                                      |

Removal: `diagramRemovalStatements` gains `DELETE FROM drive_items WHERE item_kind = 'diagram' AND ld_id IN
(doomed)` before the diagrams delete; `deleteFolder` becomes one batch that also drops `item_kind = 'folder' AND
ld_id = ?`; `deleteAccount` revokes (when a refresh token decrypts) and deletes both tables' owner rows.
`migrateOwnerId` leaves both untouched (`account-only`: a guest never holds a connection). No snapshot or restore
beyond D1's own; a connection is re-creatable by reconnecting. `DELETE /api/drive/connection` deletes both.

## Errors and edge cases

| Case                                               | Handling                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Offline, `fetch` rejects                           | Pass ends, `error = 'offline'`, next trigger retries                                            |
| Google 401                                         | Token dropped, fetched again once; second 401 ends the pass (`error = 'failed'`)                |
| `429 drive_token_rate_limited` from the api        | Same as a Google rate limit: `backoff.hit`, `error = 'rate_limited'`, next poll backed off      |
| 403 rate / 429                                     | `backoff.hit`, pass ends, `error = 'rate_limited'` until a clean pass                           |
| 404 on update                                      | Re-create in the expected place                                                                 |
| 404 on the root                                    | Root treated as missing; step 3 of the pass runs                                                |
| 5xx from Google or the api                         | Pass ends, `error = 'failed'`, logged                                                           |
| `invalid_grant`                                    | Row `needs_reconnect`, `409`, banner                                                            |
| Content over 5 MB                                  | Resumable upload                                                                                |
| Thumbnail render fails                             | Upload without thumbnail, logged                                                                |
| Two devices                                        | Lease; the other still runs inbound                                                             |
| A change for an item whose value livediagram holds | Recorded only                                                                                   |
| Folder move would cycle (`409 cycle`)              | Recorded; outbound restores Drive's parent                                                      |
| Name over `MAX_NAME_LEN` from Drive                | Truncated to `MAX_NAME_LEN`                                                                     |
| `PUT /drive/items` unique conflict on file id      | `409 drive_item_conflict`; the engine drops the stale row holding that file id and retries once |
| `changes.list` page token rejected (400/404)       | New start page token; a full adoption listing runs (step 3 adopt), logged                       |
| Diagram restored in Drive while in a team          | Recorded; outbound bins it again                                                                |
| Open with: signed out                              | Sign-in redirect, back to the same URL                                                          |

## Security and trust

- Trust boundary: only `ctx.clerkUserId` reaches Drive rows; every statement is `WHERE owner_id = ?`.
- The refresh token never leaves the worker; AES-GCM with a random 12-byte IV, AAD the owner id, so a row copied to
  another owner fails to open.
- `state` binds user, redirect URI and 10 minutes; a code minted for one user cannot be redeemed by another.
- Access tokens reach the browser only for the caller's own grant, which is what the browser would hold anyway.
- Writes ride the existing `WRITE_RATE_LIMITER`. `POST /drive/token` also has its own `DRIVE_TOKEN_RATE_LIMITER`
  (10 per 60 s per Clerk user id, namespace `1007`, production and `[env.staging]`), checked before Google is
  called; absent binding allows (self-host).
- The browser never deletes a Drive file it did not create: tombstones name only files an item recorded.
- `/drive/open` treats `state` as untrusted JSON; ids are validated before any request; an unknown file is an error.
- No Google data is used for anything but the mirror (Limited Use); no Drive content reaches the server.
- The e2e session bridge exists only in a build with `NEXT_PUBLIC_E2E_AUTH=1`; the worker trusts nothing new, it
  verifies that JWT against `CLERK_JWKS_URL` like any other.
- Every session mount registers the api Bearer (`registerTokenProvider`), so the root-level Drive provider and a
  page never clear each other's credential on unmount.

## Performance and limits

- Server: `POST /drive/token` about once an active hour; D1 writes per active user-day: the page token (at most one
  per 10 minutes), the lease (at most one per 10 minutes of writing), item rows (one per upload or applied change).
- Drive units per active two-hour day stay near the research's 1,600: one `changes.list` per poll, one
  `files.update` per content write, metadata updates only on real changes. Adoption lists run only when the root is
  missing.
- `PUT /drive/items` carries at most `DRIVE_ITEMS_PUT_MAX` (100) rows, one D1 batch.
- `localStorage` tombstones: about 80 bytes a row.

## Presentation and UX

Account menu item **Google Drive** (signed in, `driveUiMode !== 'off'`), opening `DriveDialog`:

| State              | Copy                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `disconnected`     | "Keep a copy of your Personal Space in your own Google Drive, updated while livediagram is open." Button **Connect Google Drive**                            |
| `idle`             | "Mirroring to the **livediagram** folder in your Google Drive." **Last synced** "Just now" / relative time / "Not yet". Buttons **Sync now**, **Disconnect** |
| first mirror       | "Copying your diagrams to Drive: {done} of {total}" with a progress bar                                                                                      |
| `needs_reconnect`  | "Google Drive stopped accepting livediagram's access. Nothing was deleted." **Reconnect**                                                                    |
| `needs_resume`     | "Drive access has lapsed. Resume to carry on syncing." **Resume sync**                                                                                       |
| lease elsewhere    | "Another device is writing to Drive right now; this one keeps reading changes."                                                                              |
| `rate_limited`     | "Google asked livediagram to slow down. Syncing continues less often for a while."                                                                           |
| `offline`/`failed` | "Couldn't reach Google Drive. livediagram tries again when you come back."                                                                                   |
| notice             | "{name}: Moved in Drive to a folder livediagram can't see." **Show this folder to livediagram** (only with a Picker key)                                     |

Disconnect confirms: "Disconnect Google Drive? Your files stay in Drive; livediagram stops updating them."

Banner (`needs_reconnect` / `needs_resume`), bottom-left, dismissible for the session: "Google Drive sync is paused."
with **Reconnect** / **Resume sync**. `/drive/connected`: "Connecting Google Drive…", then back to the page the user
started from; on `error=access_denied`: "Google Drive wasn't connected." with **Back**. `/drive/open`: "Opening from
Google Drive…"; import: "This diagram isn't in your livediagram." **Import a copy**; error: "This file can't be
opened in livediagram." with **Go to Explorer**.

## Accessibility

The dialog uses the shared dialog primitive (focus trap, `aria-labelledby`, Escape). The progress bar is
`role="progressbar"` with `aria-valuenow` / `aria-valuemax`. Status changes are announced with the shared
announcer (polite). The banner is `role="status"`. The notice badge carries an `aria-label` with the notice text.
Colours are the existing slate / brand tokens, which meet AA in both themes.

## Observability

Browser: `driveLog(event, fields)` writes `console.info('[drive-mirror] <event>', fields)`; `warn` for failures.
Events: `elected`, `pass-start`, `pass-end`, `token`, `root-created`, `root-found`, `adopted`, `inbound`
(decision + file id), `echo`, `outbound` (op + id), `deferred`, `lease-held-elsewhere`, `backoff`, `tombstone`,
`recreated`, `error`. api: `console.log('drive: <route> <outcome>', { owner })`, never a token.

## Testing

| Spec rule                                  | Test                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| Encryption, AAD, never returned            | `apps/api/src/drive/crypto.test.ts`, `routes/drive.test.ts`             |
| Signed state                               | `apps/api/src/drive/state.test.ts`                                      |
| Token routes, `invalid_grant`, revoke      | `apps/api/src/routes/drive.test.ts`                                     |
| Clerk-only, 503 when off                   | `routes/drive.test.ts`                                                  |
| Rows removed with diagram, folder, account | `db/drive-removal.test.ts`, `account-owner-columns.test.ts`             |
| OpenAPI parity                             | `openapi/route-parity.test.ts`                                          |
| Envelope                                   | `apps/live/lib/export-diagram-text.test.ts`                             |
| REST client against the fake               | `apps/live/lib/drive/drive-rest-client.test.ts`                         |
| Every outbound row                         | `apps/live/lib/drive/engine.outbound.test.ts`                           |
| Every inbound row, echo, conflicts         | `apps/live/lib/drive/engine.inbound.test.ts`, `plan-inbound.test.ts`    |
| Two devices, catch-up, folder bin, unseen  | `apps/live/lib/drive/engine.scenarios.test.ts`                          |
| Cadence, back-off, page-token throttle     | `apps/live/lib/drive/engine.scenarios.test.ts`, `backoff.test.ts`       |
| Open with outcomes                         | `apps/live/lib/drive/open-with.test.ts`                                 |
| Fake Google                                | `packages/fake-google/src/*.test.ts`                                    |
| The whole flow in a browser (opt-in)       | `apps/live/e2e/drive-mirror.spec.ts`                                    |
| Consent URL, return path, state memory     | `apps/live/lib/drive/consent.test.ts`                                   |
| Back-off, tombstone memory                 | `backoff.test.ts`, `tombstones.test.ts`                                 |
| Connection, items, lease statements        | `apps/api/src/db/drive.test.ts`                                         |
| Disconnect and account deletion revoke     | `apps/api/src/drive/disconnect.test.ts`                                 |
| OAuth calls, mode resolution, capabilities | `google-oauth.test.ts`, `config.test.ts`, `routes/capabilities.test.ts` |
| Bearer survives a second session mount     | `apps/live/hooks/persistence/useClerkApiBootstrap.test.tsx`             |
| Telemetry vocabulary                       | `apps/live/lib/telemetry-coverage.test.ts`, `apps/telemetry` tests      |

The browser e2e is opt-in (`pnpm --filter @livediagram/live test:e2e:drive`), kept out of CI's default run to spare
its minutes: it rebuilds the live app with `NEXT_PUBLIC_E2E_AUTH=1`, which swaps Clerk for `E2EAuthBridge` (a
session JWT the test mints against its own JWKS, verified by the worker exactly as Clerk's), and boots the stack
with `E2E_DRIVE=1`. A real build never sets the flag, so the bridge is compiled out.

## Constants and configuration

| Constant                                   | Value                              | Where                    | Provenance / safe range                                |
| ------------------------------------------ | ---------------------------------- | ------------------------ | ------------------------------------------------------ |
| `DRIVE_POLL_INTERVAL_MS`                   | 20 min                             | `lib/drive/cadence.ts`   | Research cadence; 10..60 min                           |
| `DRIVE_POLL_INTERVAL_MAX_MS`               | 60 min                             | cadence                  | Research back-off cap                                  |
| `DRIVE_FOCUS_POLL_MIN_GAP_MS`              | 5 min                              | cadence                  | Research; 1..20 min                                    |
| `DRIVE_CHANGES_PAGE_SIZE`                  | 1000                               | cadence                  | Google maximum                                         |
| `DRIVE_WRITE_IDLE_MS`                      | 60 s                               | cadence                  | Research; 10 s..5 min                                  |
| `DRIVE_WRITE_MIN_INTERVAL_MS`              | 5 min                              | cadence                  | Research; 1..30 min                                    |
| `DRIVE_WRITE_MIN_INTERVAL_MAX_MS`          | 30 min                             | cadence                  | Research back-off cap                                  |
| `DRIVE_BACKOFF_CALM_MS`                    | 60 min                             | cadence                  | Research                                               |
| `DRIVE_BACKOFF_MAX_LEVEL`                  | 3                                  | cadence                  | 2^3 x 20 min > 60 min cap                              |
| `DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS` | 10 min                             | cadence                  | Research                                               |
| `DRIVE_TOKEN_RENEW_BEFORE_MS`              | 5 min                              | cadence                  | D4; 1..10 min of a 60-minute token                     |
| `DRIVE_TOKEN_RATE_LIMITER`                 | 10 per 60 s                        | `apps/api/wrangler.toml` | Lead review; about one token an hour is healthy; 5..30 |
| `DRIVE_LEASE_MS`                           | 15 min                             | api-schema `drive.ts`    | Spec; 5..30 min                                        |
| `DRIVE_LEASE_RENEW_BEFORE_MS`              | 5 min                              | api-schema               | Spec                                                   |
| `DRIVE_STATE_TTL_MS`                       | 10 min                             | api-schema               | Spec                                                   |
| `DRIVE_ITEMS_PUT_MAX`                      | 100                                | api-schema               | One D1 batch; D1 allows 1000 statements                |
| `DRIVE_ITEMS_PUT_BATCH`                    | 25                                 | cadence                  | D5                                                     |
| `DRIVE_MULTIPART_MAX_BYTES`                | 5 MiB                              | cadence                  | Google multipart limit                                 |
| `DRIVE_THUMBNAIL_WIDTH_PX`                 | 1600                               | cadence                  | Google's recommendation; min 220                       |
| `DRIVE_THUMBNAIL_MAX_BYTES`                | 2 MB                               | cadence                  | Google limit                                           |
| `DRIVE_FILE_MIME`                          | `application/vnd.livediagram+json` | api-schema               | Spec                                                   |
| `DRIVE_FILE_EXTENSION`                     | `.livediagram`                     | api-schema               | Spec                                                   |
| `DRIVE_ROOT_NAME`                          | `livediagram`                      | api-schema               | Spec                                                   |
| `DRIVE_SCOPES`                             | `drive.file drive.install`         | api-schema               | Spec                                                   |

Env: api `GOOGLE_CLIENT_ID` (var), `GOOGLE_CLIENT_SECRET` (secret), `DRIVE_TOKEN_KEY` (secret, base64 of 32 bytes,
`openssl rand -base64 32`), `GOOGLE_OAUTH_BASE_URL` (tests only); live `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
`NEXT_PUBLIC_GOOGLE_API_KEY`.

## Assets and external resources

| Resource                   | Source                                                        | Licence / terms   | Loaded                             |
| -------------------------- | ------------------------------------------------------------- | ----------------- | ---------------------------------- |
| Google Identity Services   | `https://accounts.google.com/gsi/client`                      | Google APIs Terms | Browser-only mode, on demand       |
| Google Picker              | `https://apis.google.com/js/api.js` (`picker`)                | Google APIs Terms | On **Show this folder**, on demand |
| Drive UI integration icons | the brand mark, rendered by the operator in the Cloud Console | MIT (ours)        | Not in the repo                    |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
