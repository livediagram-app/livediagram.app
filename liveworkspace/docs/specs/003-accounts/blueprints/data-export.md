# Download your data: blueprint

Derived from [data-export.md](../data-export.md). The spec decides; this file only adds engineering precision, read from
the code. Defaults are cited as `ACCn`. Paths are relative to the repository root.

Scope, by file:

| File                                                       | Role                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/data-export/src/`                                | The contract: keys, states, wire shapes, constants, the link's message        |
| `packages/app-doors/src/doors.ts`                          | `createAppDoors`: file, svg, csv, comments and import calls, the item's URL   |
| `packages/index-app/src/data-export-door.ts`               | The apps' side: the `csv` and `comments` formats and `DATA_EXPORT_KEY`        |
| `liveworkspace/apps/export/src/index.ts`                   | The Worker: the internal routes, the key check, the object's class            |
| `liveworkspace/apps/export/src/job/durable-object.ts`      | `DataExport`: start, status, file, delete, and the alarm that runs chunks     |
| `liveworkspace/apps/export/src/job/store.ts`               | The object's SQLite: the job, the queue, the zip's directory, parts, the rest |
| `liveworkspace/apps/export/src/job/steps.ts`               | One chunk: list, items, images, finish, within its budget                     |
| `liveworkspace/apps/export/src/zip/`                       | The zip writer: CRC-32, headers, deflate, the directory, the end record       |
| `liveworkspace/apps/export/src/upload.ts`                  | The R2 multipart upload in fixed parts, and what is left between chunks       |
| `liveworkspace/apps/export/src/sources.ts`                 | The index, the media service and the apps' doors as the job reads them        |
| `liveworkspace/apps/export/src/files.ts`                   | Names, the README, comments as JSON and CSV, the profile and team files       |
| `liveworkspace/apps/accounts/src/data-export/routes.ts`    | The session's doors, the download and the service's `ready` call              |
| `liveworkspace/apps/accounts/src/data-export/link.ts`      | Signing and checking the emailed link                                         |
| `liveworkspace/apps/accounts/src/data-export/email.ts`     | The ready and failed emails                                                   |
| `liveworkspace/apps/site/components/settings/data-export/` | The Your Data category                                                        |
| `packages/settings-ui/src/account-model.tsx`               | The category: `renderDataExport` / `dataExportHref`                           |

## Domain and naming

| Term       | Identifier                                               | Meaning                                                      |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Export key | `personal:<account id>`, `team:<team id>`                | One scope's latest export, and the Durable Object's name     |
| Export id  | `ex_<24 hex>`                                            | One run, in the R2 key `exports/<key>/<id>.zip` and the link |
| State      | `ExportStatus`: `running`, `ready`, `failed`, `expired`  | What Settings draws; none is `null`                          |
| Phase      | `ExportPhase`: `listing`, `items`, `images`, `finishing` | Where a running export is                                    |
| View       | `ExportView`                                             | The wire shape of one export's state                         |
| Requester  | `requestedBy`                                            | The account that started it, who gets the email and the link |

## Behaviour and state

- **Start** (`DataExport.start`): refused `running` while the scope's export runs; otherwise the previous file is
  deleted, a new job row written with a fresh id, the queue emptied, and the alarm set for now. Accounts checks first
  that the requester runs no other export (`personal` and each team they are admin of, in one status call).
- **A chunk** (`runChunk`): reads the job, then works phase by phase until `EXPORT_CHUNK_MS` of wall time or
  `EXPORT_CHUNK_SUBREQUESTS` requests are spent, saves what is left of the part buffer, and sets the next alarm now.
  Listing reads one index page (`LIST_LIMIT_MAX`) per step into the queue, then the images (personal); items take one
  item per step (file, then each tab's drawing up to `EXPORT_TAB_PICTURES_MAX`, then CSV for liveplanner, then
  comments, kept in the `comments` table); images one per step; finishing writes the comment files, the profile or
  team file, the README, the directory and the end record, completes the upload, marks `ready` with
  `expiresAt = now + EXPORT_LINK_TTL_MS`, tells accounts, and sets the alarm for `expiresAt` to delete the file.
- **The cap**: before an item, a file that would take the zip past `EXPORT_MAX_BYTES`, or the queue past
  `EXPORT_MAX_ITEMS`, stops the item phase; the rest are counted as left out (`capped`).
- **A failed step** is tried again on the next alarm after `min(5 s * 2^n, 5 min)`; `EXPORT_FAILURES_MAX` in a row
  fails the export. A door's `404` skips the item (gone since the list); another refusal names it in the README
  (`problems`) and goes on.
- **Expiry**: the alarm at `expiresAt` deletes the file and marks the job `expired`.

## Interfaces and contracts

- **Accounts to the service** (`EXPORT` binding, `Bearer EXPORT_KEY_ACCOUNTS`): `POST /internal/exports`
  `{ key, requestedBy, scope: { kind: 'personal', personId } | { kind: 'team', teamId, teamName }, profile? }` answers
  `202 { export }` or `409 { error: 'export_running' }`; `POST /internal/exports/status` `{ keys }` (at most
  `EXPORT_STATUS_KEYS_MAX`) answers `{ exports: { [key]: ExportView | null } }`; `GET /internal/exports/<key>/file`
  streams with `Content-Length`; `DELETE /internal/exports/<key>` answers `204`.
- **The service to accounts** (`ACCOUNTS` binding, same key): `POST /api/account/internal/data-export/ready`
  `{ key, exportId, requestedBy, status: 'ready' | 'failed', bytes, expiresAt, teamName? }`, `204`.
- **The browser** (session): `GET /api/account/data-export` answers `{ personal: ExportView | null, teams: [{ id, name,
export }] }`, each ready view carrying `downloadUrl` (a signed link for this person); `POST /api/account/data-export`
  `{ team? }` answers `202 { export }`, `403 admin_only`, `409 export_running`, `503 export_unavailable`.
- **The link**: `sig` is lowercase hex HMAC-SHA-256 of `exportLinkMessage(requestedBy, key, exportId, exp)`
  (`<requestedBy>\n<key>\n<exportId>\n<exp>`) under a key derived from `BETTER_AUTH_SECRET` by HKDF-SHA-256 (info
  `liveworkspace data export link`). The download checks the session, the signature (constant time), the expiry, that
  the export named is still the scope's ready one, and for a team the admin, then streams. Refusals redirect to
  `/explorer?settings=data&export=<reason>` (`expired`, `other-account`, `missing`); no session redirects to
  `/sign-in?return=<the link>`.
- **The doors**: [data-export.md "The apps"](../data-export.md#the-apps); `@liveworkspace/app-doors` maps a `204` or
  `404` to `null`, any other non-`200` to `DoorError`.

## Data and persistence

The object's SQLite: `export_job` (one row: id, key, scope JSON, requested_by, status, phase, list cursor, counts,
bytes, upload id, part number, started, finished, expires, failures, next try, error, capped, profile JSON),
`export_queue` (seq, kind `item` | `image`, app, ref id, name, updated), `export_entries` (seq, name, crc, method,
sizes, offset, dos time and date), `export_parts` (number, etag), `export_buffer` (seq, bytes: the unsent tail, in
chunks of at most 1 MiB), `export_comments` (seq, JSON row), `export_problems` (seq, app, name, reason). Start and
expiry clear all but the job row. R2 keeps one object per run; the next run deletes the last.

## Errors and edge cases

- An item listed but gone by its turn (`404` from the door) is skipped silently; one whose file the app refuses is in
  the README's problems. A tab whose drawing fails is left without a picture.
- An empty scope still makes a zip: the README, the profile or team file and empty comment files.
- A name that is empty after cleaning is `Untitled`. Two tabs of the same name are told apart by their number.
- A team deleted, or the requester no longer its admin, by the download: the download redirects `other-account`.
- The service unbound or unkeyed: accounts answers `503 export_unavailable` and Settings shows the category's error.

## Security and trust

- Only accounts reaches the service, by binding and key; the service has no route on the zone.
- The index delegate is read-only and scope-narrowed; the media key reads only; the apps' key opens only the export
  door. The person and team come from accounts' own records, never a token claim.
- Logs carry ids, counts, sizes and phases, never a name, a comment or any content.

## Performance and limits

Measured in `liveworkspace/apps/export/src/zip/zip.test.ts` and `job/steps.test.ts`: see the PR's Performance notes
for the numbers. Memory is bounded by one part (`EXPORT_PART_BYTES`) plus one item's files.

## Presentation and UX

[site.md "Your Data"](../../010-site/site.md#settings) and [data-export.md "Settings"](../data-export.md#settings).

## Observability

`[export] started|chunk|ready|failed|expired` lines with the key's kind, the export id, counts and bytes.

## Testing

`packages/data-export` (the link message, views), `packages/app-doors` (every call and status), the service's zip
writer (unzipped by an independent reader in the test), store, steps (a fake index, media, doors and R2), routes;
accounts' routes, link and email; the index's export delegate; media's export caller; the Settings category's states.

## Constants and configuration

| Constant                   | Value   | Where                        |
| -------------------------- | ------- | ---------------------------- |
| `EXPORT_MAX_BYTES`         | 2 GiB   | `@liveworkspace/data-export` |
| `EXPORT_MAX_ITEMS`         | 10,000  | `@liveworkspace/data-export` |
| `EXPORT_PART_BYTES`        | 8 MiB   | `@liveworkspace/data-export` |
| `EXPORT_CHUNK_MS`          | 20 s    | `@liveworkspace/data-export` |
| `EXPORT_CHUNK_SUBREQUESTS` | 400     | `@liveworkspace/data-export` |
| `EXPORT_TAB_PICTURES_MAX`  | 20      | `@liveworkspace/data-export` |
| `EXPORT_PICTURE_MAX_SIDE`  | 4096 px | `@liveworkspace/data-export` |
| `EXPORT_LINK_TTL_MS`       | 3 days  | `@liveworkspace/data-export` |
| `EXPORT_FAILURES_MAX`      | 8       | `@liveworkspace/data-export` |
| `EXPORT_STATUS_KEYS_MAX`   | 51      | `@liveworkspace/data-export` |
| `EXPORT_POLL_MS`           | 3 s     | `@liveworkspace/data-export` |

Bindings: the service's `DATA_EXPORT` (Durable Object), `EXPORTS` (R2), `INDEX`, `MEDIA`, `ACCOUNTS` (services); the
secrets `EXPORT_KEY_ACCOUNTS`, `INDEX_KEY_EXPORT`, `MEDIA_KEY_EXPORT`, `DATA_EXPORT_KEY_<APP>`; vars `APP_ORIGIN_<APP>`.
Accounts' `EXPORT` binding and `EXPORT_KEY_ACCOUNTS`.

## Defaults ledger

ACC24, ACC25, ACC26, ACC27.
