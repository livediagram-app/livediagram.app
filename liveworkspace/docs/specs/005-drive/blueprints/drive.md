# The Google Drive mirror: blueprint

Derived from [drive.md](../drive.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term          | Identifier                                            | Meaning                                              |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Mirror        | `DriveMirror` Durable Object, `idFromName(accountId)` | One per connected account                            |
| Connection    | `drive_connection` row                                | The sealed refresh token, the root folder, the state |
| Mirrored item | `drive_items` row                                     | An item and its Drive file                           |
| Pass          | `pass.ts`                                             | One sync run over the whole picture, both directions |
| Change signal | `POST /app/changes`                                   | The index telling the mirror something changed       |
| File format   | `APP_FILE_FORMATS` (`@liveworkspace/drive`)           | Each app's MIME type and extension                   |

## Behaviour and state

The mirror has no cron: each Durable Object sets its own alarm for its next pass, and the index's change signal
or Google's push channel (`X-Goog-Channel-*`) brings it forward.

## Interfaces and contracts

A browser calls `/api/drive/…` with its accounts token. The index calls `POST /app/changes` with
`DRIVE_KEY_INDEX`; accounts calls the disconnect with `DRIVE_KEY_ACCOUNTS`. The mirror calls the index with
`INDEX_KEY_DRIVE` and each app's export and import doors with `DRIVE_KEY_<APP>`.

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                              | Specified in                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST /api/drive/picker-token`     | [drive.md "Folders liveworkspace can't see"](../../005-drive/drive.md#folders-liveworkspace-cant-see)         |
| `GET /api/drive/config`            | [drive.md "Connecting"](../../005-drive/drive.md#connecting)                                                  |
| `GET /api/drive/marks`             | [drive.md "The Explorer shows each item's sync"](../../005-drive/drive.md#the-explorer-shows-each-items-sync) |
| `POST /api/drive/open`             | [drive.md "Open with"](../../005-drive/drive.md#open-with)                                                    |
| `DELETE /app/people/<id>`          | [drive.md "Disconnecting and account deletion"](../../005-drive/drive.md#disconnecting-and-account-deletion)  |
| `POST /check`                      | [drive.md "The UI"](../../005-drive/drive.md#the-ui)                                                          |
| `GET /connection`                  | [drive.md "The UI"](../../005-drive/drive.md#the-ui)                                                          |
| `GET /api/drive/connection`        | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/state`            | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/connect`          | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `DELETE /api/drive/account-switch` | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `DELETE /api/drive/connection`     | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/check`            | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/adopt`            | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/import`           | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/push`             | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /app/changes`                | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `GET /app/people/:id/drive`        | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `POST /api/drive/account-switch`   | [drive.md "The service"](../../005-drive/drive.md#the-service)                                                |
| `PUT /app/people/:id/drive`        | [drive.md "The index"](../../005-drive/drive.md#the-index)                                                    |
| `DELETE /app/people/:id/drive`     | [drive.md "The index"](../../005-drive/drive.md#the-index)                                                    |
| `GET /:id/export?format=file`      | [drive.md "The apps"](../../005-drive/drive.md#the-apps)                                                      |
| `POST /import`                     | [drive.md "The apps"](../../005-drive/drive.md#the-apps)                                                      |

## Security and trust

Refresh tokens are sealed with `DRIVE_TOKEN_KEY`, which must be base64 of 32 bytes: without a valid key the
mirror is off, and a set but invalid key logs `drive: key-invalid` once (`env.ts`). Google's push calls are checked by channel token (`channel-token.ts`). The mirror
only ever reaches a person's personal items. Secrets are set once per Worker and environment with `wrangler secret put` and survive every deploy; the
`Env fields` line under the Worker's configuration below lists every name the Worker reads, vars and secrets
together (a name not in a `[vars]` table is a secret). App keys are compared in constant time, and each key speaks
only for its own app.

## Performance and limits

Each pass is bounded by Google's quota (`meter.ts`) and the budgets in [drive.md "Limits and cost"](../drive.md#limits-and-cost);
failures back off (`@liveworkspace/drive` `backoff.ts`).

## Observability

Every route logs one line through `logRoute`, and every pass step through `log.ts` (`drive: <step>`), as
[drive.md "Logs"](../drive.md#logs) specifies:

| Level      | Fingerprint                                         | Where       |
| ---------- | --------------------------------------------------- | ----------- |
| `logRoute` | `account-switch`                                    | `routes.ts` |
| `logRoute` | `adopt`                                             | `routes.ts` |
| `logRoute` | `connect`                                           | `routes.ts` |
| `logRoute` | `disconnect`                                        | `routes.ts` |
| `warn`     | `drive: key-invalid (DRIVE_TOKEN_KEY must be base6` | `env.ts`    |
| `log`      | `drive: …`                                          | `log.ts`    |
| `warn`     | `drive: …`                                          | `log.ts`    |
| `logRoute` | `import`                                            | `routes.ts` |
| `logRoute` | `open`                                              | `routes.ts` |
| `logRoute` | `picker-token`                                      | `routes.ts` |
| `logRoute` | `route,`                                            | `routes.ts` |
| `logRoute` | `state`                                             | `routes.ts` |

## Files

| File                                                    | Role                                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/drive/src/app-doors.ts`             | Each app's two Drive doors (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"), at `<APP_ORIGIN_<APP>>/api/internal/items/…` with the app's DRIVE_KEY: the item's whole-i… |
| `liveworkspace/apps/drive/src/app-routes.ts`            | The routes no browser calls (liveworkspace/docs/specs/005-drive/drive.md "The service"): POST /api/drive/push Google's change notifications: the channel token names the person             |
| `liveworkspace/apps/drive/src/auth.ts`                  | Who is asking (liveworkspace/docs/specs/005-drive/drive.md "Who and what", "The service"): - a person, by an accounts access token, checked offline against accounts' keys exactly as the … |
| `liveworkspace/apps/drive/src/channel-token.ts`         | The push channel's token (liveworkspace/docs/specs/005-drive/drive.md "Cadence"): Google echoes it on every notification as X-Goog-Channel-Token, and it names the person and proves the s… |
| `liveworkspace/apps/drive/src/consent.ts`               | The consent's addresses (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): where Google sends the code back, the page the browser returns to afterwards, and Google's consent URL… |
| `liveworkspace/apps/drive/src/dispatch.ts`              | Which handler a request is for (index.ts is the Worker around it)                                                                                                                           |
| `liveworkspace/apps/drive/src/env.ts`                   |                                                                                                                                                                                             |
| `liveworkspace/apps/drive/src/http.ts`                  | Responses and request bodies                                                                                                                                                                |
| `liveworkspace/apps/drive/src/index-api.ts`             | The index as the mirror reaches it (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"), through the INDEX binding: acting as one person on their personal items and fold… |
| `liveworkspace/apps/drive/src/index.ts`                 | liveworkspace's Google Drive mirror (liveworkspace/docs/specs/005-drive/drive.md): one Worker on liveworkspace.app/api/drive (and each app's /api/drive through its router), and a Durable… |
| `liveworkspace/apps/drive/src/log.ts`                   | The service's log lines (liveworkspace/docs/specs/005-drive/drive.md "Logs"): `drive: <step>` and ids, never a name or an address, so a failure is traceable in `wrangler tail` without th… |
| `liveworkspace/apps/drive/src/mirror/answers.ts`        | What Cloud Sync's row and the Explorer's marks read (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "The Explorer shows each item's sync"): answered from the person's rows alo… |
| `liveworkspace/apps/drive/src/mirror/channel.ts`        | The push channel (liveworkspace/docs/specs/005-drive/drive.md "Cadence"): a `changes.watch` on the person's Drive, so Google posts to /api/drive/push when it changes and a pass follows    |
| `liveworkspace/apps/drive/src/mirror/connect.ts`        | Connecting, switching Google account and disconnecting (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "Tokens", "Disconnecting and account deletion"), carried over from lived… |
| `liveworkspace/apps/drive/src/mirror/context.ts`        | What a person's mirror runs on (liveworkspace/docs/specs/005-drive/drive.md "The service"): its store, its alarm, Google, the index, the apps' doors and the clock, all injected, so the D… |
| `liveworkspace/apps/drive/src/mirror/durable-object.ts` | The person's Durable Object (liveworkspace/docs/specs/005-drive/drive.md "The service"): one SQLite-backed `DriveMirror` per connected account, by `idFromName(accountId)`                  |
| `liveworkspace/apps/drive/src/mirror/inbound.ts`        | Inbound: Drive's changes applied to liveworkspace (liveworkspace/docs/specs/005-drive/drive.md "Inbound"), ported from livediagram's engine-inbound                                         |
| `liveworkspace/apps/drive/src/mirror/meter.ts`          | The subrequest budget (liveworkspace/docs/specs/005-drive/drive.md "Limits and cost"): one meter per pass or per call to the object, charged before every request to Google, the index or … |
| `liveworkspace/apps/drive/src/mirror/mirror.ts`         | A person's Google Drive mirror (liveworkspace/docs/specs/005-drive/drive.md "The service"): everything its Durable Object answers, as a plain class over injected deps (context.ts), so th… |
| `liveworkspace/apps/drive/src/mirror/outbound.ts`       | Outbound: running the planner's ops against Drive (liveworkspace/docs/specs/005-drive/drive.md "Outbound"), ported from livediagram's engine-outbound                                       |
| `liveworkspace/apps/drive/src/mirror/pass-state.ts`     | What one pass carries between its inbound and outbound halves: the snapshot (kept up to date as effects land), the person's index, and the row writes, each persisted at o…                 |
| `liveworkspace/apps/drive/src/mirror/pass.ts`           | One pass (liveworkspace/docs/specs/005-drive/drive.md "The service", "Cadence"), run by the object's alarm: a token, the root, the push channel, the person's whole picture from the index… |
| `liveworkspace/apps/drive/src/mirror/store.ts`          | A person's mirror state in their Durable Object's SQLite (liveworkspace/docs/specs/005-drive/drive.md "The service"): `drive_connection`, one row (the sealed refresh token, the root, the… |
| `liveworkspace/apps/drive/src/mirror/tokens.ts`         | The service's Google access tokens (liveworkspace/docs/specs/005-drive/drive.md "Tokens"): minted from the sealed refresh token, kept in the object's memory (never stored), refreshed a m… |
| `liveworkspace/apps/drive/src/open.ts`                  | Drive's "Open with" (liveworkspace/docs/specs/005-drive/drive.md "Open with"), carried over from livediagram's open-with.ts to the server: what `<liveworkspace>/drive/open` should do wit… |
| `liveworkspace/apps/drive/src/routes.ts`                | The browser's routes (liveworkspace/docs/specs/005-drive/drive.md "The service"), under /api/drive on liveworkspace's origin and on each app's through its router                           |
| `liveworkspace/apps/drive/src/thumbnail.ts`             | A file's thumbnail (liveworkspace/docs/specs/005-drive/drive.md "The file"): the app's `svg` export of the item's first tab, drawn as a PNG DRIVE_THUMBNAIL_PX on its long side by the sha… |
| `packages/drive/src/backoff.ts`                         | Back-off on Google's rate limits (liveworkspace/docs/specs/005-drive/drive.md "Cadence"): each 403 userRateLimitExceeded / 429 doubles the intervals, up to their ceilings; an hour withou… |
| `packages/drive/src/base64.ts`                          | base64url without padding, for sealed tokens and signed state; plain base64 read too, for the key secret.                                                                                   |
| `packages/drive/src/client.ts`                          | The browser's side of the Drive service (liveworkspace/docs/specs/005-drive/drive.md "The service"): one typed method per browser route, for Cloud Sync's row (@liveworkspace/settings-ui)… |
| `packages/drive/src/constants.ts`                       | Every timing and size the Drive mirror runs on, in one place (liveworkspace/docs/specs/005-drive/drive.md "Cadence")                                                                        |
| `packages/drive/src/formats.ts`                         | The file each app's item becomes in Google Drive (liveworkspace/docs/specs/005-drive/drive.md "The file"): one place for the envelope kind, the MIME type and the extension, so the servic… |
| `packages/drive/src/index.ts`                           |                                                                                                                                                                                             |
| `packages/drive/src/plan/index.ts`                      |                                                                                                                                                                                             |
| `packages/drive/src/plan/plan-inbound.ts`               | Inbound: what one Drive change means for liveworkspace (liveworkspace/docs/specs/005-drive/drive.md "Inbound")                                                                              |
| `packages/drive/src/plan/plan-outbound.ts`              | Outbound: what Drive must do to match liveworkspace (liveworkspace/docs/specs/005-drive/drive.md "Outbound")                                                                                |
| `packages/drive/src/plan/snapshot.ts`                   | One pass's view of both sides (liveworkspace/docs/specs/005-drive/drive.md "The service"): the person's own work as the index holds it, and the mirror's rows, indexed the ways the planne… |
| `packages/drive/src/plan/types.ts`                      | The two sides a pass compares (liveworkspace/docs/specs/005-drive/drive.md "The service"): the person's own work as the index holds it, and the mirror's rows, the last Drive state the se… |
| `packages/drive/src/server/crypto.ts`                   | Sealing the Google refresh token at rest (liveworkspace/docs/specs/005-drive/drive.md "Tokens").                                                                                            |
| `packages/drive/src/server/drive-client.ts`             | The service's view of Google Drive (liveworkspace/docs/specs/005-drive/drive.md "The service"): the calls a pass makes, over Drive's REST API v3, with an access token the caller supplies  |
| `packages/drive/src/server/google-oauth.ts`             | The service's calls to Google's OAuth endpoint: redeem a consent code, mint an access token from the stored refresh token, revoke the grant, and learn which Google accoun…                 |
| `packages/drive/src/server/google.ts`                   | Where Google is, and the one way a call to it fails (liveworkspace/docs/specs/005-drive/drive.md "Tokens")                                                                                  |
| `packages/drive/src/server/index.ts`                    | The service's side of the Drive mirror: Google, sealing, consent state, and the Drive client.                                                                                               |
| `packages/drive/src/server/state.ts`                    | The consent `state` (liveworkspace/docs/specs/005-drive/drive.md "Connecting")                                                                                                              |
| `packages/drive/src/wire.ts`                            | What the service's browser routes answer (liveworkspace/docs/specs/005-drive/drive.md "The service"), shared by the service and the UI (`@liveworkspace/settings-ui`'s Cloud Sync row, the… |

## Constants and configuration: the Worker

`liveworkspace/apps/drive/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                        | Value                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Worker name                    | `liveworkspace-drive`                                                                      |
| Route                          | `liveworkspace.app/api/drive*`                                                             |
| Service `INDEX`                | `liveworkspace-index`                                                                      |
| Durable Object `DRIVE_MIRROR`  | class `DriveMirror`                                                                        |
| Var `ENVIRONMENT`              | `production`                                                                               |
| Var `GOOGLE_CLIENT_ID`         | `75973480147-lpppg0shfk6tju1qn0mrg1o62a16siin.apps.googleusercontent.com`                  |
| Var `DRIVE_PUBLIC_URL`         | `https://liveworkspace.app`                                                                |
| Var `ACCOUNTS_URL`             | `https://www.liveworkspace.app`                                                            |
| Var `INDEX_AUDIENCES`          | `https://livediagram-router.liveworkspace-easing509.workers.dev/api,https://liveplanner.…` |
| Var `APP_ORIGIN_LIVEDIAGRAM`   | `https://livediagram-router.liveworkspace-easing509.workers.dev`                           |
| Var `APP_ORIGIN_LIVEPLANNER`   | `https://www.liveplanner.app`                                                              |
| Var `APP_ORIGIN_LIVEDOCUMENTS` | `https://www.livedocuments.app`                                                            |
| Var `APP_ORIGIN_LIVEDESIGN`    | `https://www.livedesign.app`                                                               |

**`env.staging`**

| Setting                        | Value                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Worker name                    | `liveworkspace-drive-staging`                                                              |
| Route                          | `staging.liveworkspace.app/api/drive*`                                                     |
| Service `INDEX`                | `liveworkspace-index-staging`                                                              |
| Durable Object `DRIVE_MIRROR`  | class `DriveMirror`                                                                        |
| Var `ENVIRONMENT`              | `staging`                                                                                  |
| Var `GOOGLE_CLIENT_ID`         | `75973480147-lpppg0shfk6tju1qn0mrg1o62a16siin.apps.googleusercontent.com`                  |
| Var `DRIVE_PUBLIC_URL`         | `https://staging.liveworkspace.app`                                                        |
| Var `ACCOUNTS_URL`             | `https://staging.liveworkspace.app`                                                        |
| Var `INDEX_AUDIENCES`          | `https://livediagram-router-staging.liveworkspace-easing509.workers.dev/api,https://stag…` |
| Var `APP_ORIGIN_LIVEDIAGRAM`   | `https://livediagram-router-staging.liveworkspace-easing509.workers.dev`                   |
| Var `APP_ORIGIN_LIVEPLANNER`   | `https://staging.liveplanner.app`                                                          |
| Var `APP_ORIGIN_LIVEDOCUMENTS` | `https://staging.livedocuments.app`                                                        |
| Var `APP_ORIGIN_LIVEDESIGN`    | `https://staging.livedesign.app`                                                           |

Env fields (`env.ts`): `ACCOUNTS_URL`, `APP_ORIGIN_LIVEDESIGN`, `APP_ORIGIN_LIVEDIAGRAM`, `APP_ORIGIN_LIVEDOCUMENTS`, `APP_ORIGIN_LIVEPLANNER`, `DRIVE_KEY_ACCOUNTS`, `DRIVE_KEY_INDEX`, `DRIVE_KEY_LIVEDESIGN`, `DRIVE_KEY_LIVEDIAGRAM`, `DRIVE_KEY_LIVEDOCUMENTS`, `DRIVE_KEY_LIVEPLANNER`, `DRIVE_PUBLIC_URL`, `DRIVE_TOKEN_KEY`, `ENVIRONMENT`, `GOOGLE_APP_ID`, `GOOGLE_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PICKER_KEY`, `INDEX_AUDIENCES`, `INDEX_KEY_DRIVE`, `INDEX_URL`.

## Data and persistence

Each connected person has one `DriveMirror` Durable Object (`idFromName(accountId)`), whose SQLite holds:

| Table              | Columns                                                                                                                                                                                                                                                                                                                                                                                                                            | Declared in |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `drive_connection` | `id`, `person_id`, `sealed_refresh`, `google_account`, `connected_at`, `status`, `root_id`, `root_name`, `page_token`, `pending_sealed`, `pending_account`, `pending_until`, `channel_id`, `channel_resource`, `channel_expires_at`, `channel_failed_at`, `backoff_level`, `backoff_error_at`, `last_pass_at`, `last_synced_at`, `syncing`, `progress_done`, `progress_total`, `flush_next`, `picker_window_start`, `picker_count` | `store.ts`  |
| `drive_items`      | `kind`, `id`, `app`, `drive_file_id`, `name`, `parent_id`, `trashed`, `md5`, `head_revision_id`, `local_name`, `mirrored_updated_at`, `content_written_at`, `notice`, `notice_parent_id`, `seen_updated_at`                                                                                                                                                                                                                        | `store.ts`  |
| `drive_failures`   | `id`, `at`                                                                                                                                                                                                                                                                                                                                                                                                                         | `store.ts`  |

## Constants and configuration: named constants

| Constant                               | Value                                        | File              |
| -------------------------------------- | -------------------------------------------- | ----------------- |
| `DOOR_TIMEOUT_MS`                      | `20_000`                                     | `app-doors.ts`    |
| `STATUS_OF`                            | `(object or list, see file)`                 | `http.ts`         |
| `NO_BACKOFF`                           | `{ level: 0, lastErrorAt: null }`            | `backoff.ts`      |
| `DRIVE_CONNECT_PATH`                   | `'/drive/connect'`                           | `client.ts`       |
| `DRIVE_CONNECTED_PATH`                 | `'/drive/connected'`                         | `client.ts`       |
| `DRIVE_OPEN_PATH`                      | `'/drive/open'`                              | `client.ts`       |
| `DRIVE_HELP_PATH`                      | `'/help/google-drive'`                       | `client.ts`       |
| `DRIVE_RETURN_PARAM`                   | `'return'`                                   | `client.ts`       |
| `DRIVE_OUTCOME_PARAM`                  | `'drive'`                                    | `client.ts`       |
| `CLOUD_SYNC_SECTION`                   | `'Cloud Sync'`                               | `client.ts`       |
| `CLOUD_SYNC_SECTION_ID`                | `'cloud-sync'`                               | `client.ts`       |
| `DRIVE_FOLDER_MIME`                    | `'application/vnd.google-apps.folder'`       | `constants.ts`    |
| `DRIVE_SCOPES`                         | `(object or list, see file)`                 | `constants.ts`    |
| `DRIVE_PROP_ITEM_ID`                   | `'lwItemId'`                                 | `constants.ts`    |
| `DRIVE_PROP_APP`                       | `'lwApp'`                                    | `constants.ts`    |
| `DRIVE_PROP_FOLDER_ID`                 | `'lwFolderId'`                               | `constants.ts`    |
| `DRIVE_PROP_ORIGIN`                    | `'lwOrigin'`                                 | `constants.ts`    |
| `DRIVE_PROP_ROOT`                      | `'lwRoot'`                                   | `constants.ts`    |
| `DRIVE_STATE_TTL_MS`                   | `10 * MINUTE`                                | `constants.ts`    |
| `DRIVE_ACCOUNT_SWITCH_TTL_MS`          | `30 * MINUTE`                                | `constants.ts`    |
| `DRIVE_PASS_DEBOUNCE_MS`               | `30 * SECOND`                                | `constants.ts`    |
| `DRIVE_ITEM_MIN_WRITE_INTERVAL_MS`     | `5 * MINUTE`                                 | `constants.ts`    |
| `DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS` | `30 * MINUTE`                                | `constants.ts`    |
| `DRIVE_FALLBACK_CHECK_MS`              | `30 * MINUTE`                                | `constants.ts`    |
| `DRIVE_FALLBACK_CHECK_WATCHED_MS`      | `6 * HOUR`                                   | `constants.ts`    |
| `DRIVE_FALLBACK_CHECK_MAX_MS`          | `6 * HOUR`                                   | `constants.ts`    |
| `DRIVE_CHECK_MIN_GAP_MS`               | `30 * SECOND`                                | `constants.ts`    |
| `DRIVE_PASS_MAX_WRITES`                | `40`                                         | `constants.ts`    |
| `DRIVE_PASS_CONTINUE_MS`               | `1 * SECOND`                                 | `constants.ts`    |
| `DRIVE_PASS_MAX_INBOUND`               | `200`                                        | `constants.ts`    |
| `DRIVE_PASS_SUBREQUEST_BUDGET`         | `800`                                        | `constants.ts`    |
| `DRIVE_CHANGES_PAGE_SIZE`              | `1000`                                       | `constants.ts`    |
| `DRIVE_BACKOFF_CALM_MS`                | `HOUR`                                       | `constants.ts`    |
| `DRIVE_BACKOFF_MAX_LEVEL`              | `5`                                          | `constants.ts`    |
| `DRIVE_TOKEN_RENEW_BEFORE_MS`          | `MINUTE`                                     | `constants.ts`    |
| `DRIVE_CHANNEL_TTL_MS`                 | `7 * 24 * HOUR`                              | `constants.ts`    |
| `DRIVE_CHANNEL_RENEW_BEFORE_MS`        | `24 * HOUR`                                  | `constants.ts`    |
| `DRIVE_MULTIPART_MAX_BYTES`            | `5 * 1024 * 1024`                            | `constants.ts`    |
| `DRIVE_IMPORT_MAX_BYTES`               | `32 * 1024 * 1024`                           | `constants.ts`    |
| `DRIVE_THUMBNAIL_PX`                   | `440`                                        | `constants.ts`    |
| `DRIVE_THUMBNAIL_MAX_BYTES`            | `2 * 1000 * 1000`                            | `constants.ts`    |
| `DRIVE_PICKER_TOKENS_PER_MINUTE`       | `10`                                         | `constants.ts`    |
| `GOOGLE_CALL_TIMEOUT_MS`               | `10 * SECOND`                                | `constants.ts`    |
| `DRIVE_LIST_PAGES_MAX`                 | `100`                                        | `constants.ts`    |
| `DRIVE_NAME_MAX`                       | `1024`                                       | `constants.ts`    |
| `APP_FILE_FORMATS`                     | `(object or list, see file)`                 | `formats.ts`      |
| `APP_NAMES`                            | `Object.keys(APP_FILE_FORMATS) as AppName[]` | `formats.ts`      |
| `LOCAL_NAME_MAX`                       | `200`                                        | `plan-inbound.ts` |
| `DRIVE_API_PATH`                       | `'/api/drive'`                               | `wire.ts`         |

## Testing

17 test files:

- `liveworkspace/apps/drive/src/consent.test.ts`
- `liveworkspace/apps/drive/src/mirror/budget.test.ts`
- `liveworkspace/apps/drive/src/mirror/mirror.test.ts`
- `liveworkspace/apps/drive/src/mirror/pass.test.ts`
- `liveworkspace/apps/drive/src/routes.test.ts`
- `packages/drive/src/backoff.test.ts`
- `packages/drive/src/base64.test.ts`
- `packages/drive/src/client.test.ts`
- `packages/drive/src/constants.test.ts`
- `packages/drive/src/formats.test.ts`
- `packages/drive/src/plan/plan-inbound.test.ts`
- `packages/drive/src/plan/plan-outbound.test.ts`
- `packages/drive/src/plan/snapshot.test.ts`
- `packages/drive/src/server/crypto.test.ts`
- `packages/drive/src/server/drive-client.test.ts`
- `packages/drive/src/server/google-oauth.test.ts`
- `packages/drive/src/server/state.test.ts`
