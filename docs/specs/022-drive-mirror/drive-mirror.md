# Google Drive mirror

A signed-in user can **mirror their Personal Space to their own Google Drive**.
Every diagram becomes a `.livediagram` file in a folder tree that matches their
livediagram folders, kept in step both ways while a livediagram tab is open.
Double-clicking such a file in Drive opens it in livediagram.

The mirror is a **copy**, never the diagram's home
([Save Locations](../006-diagram/save-locations.md#google-drive-is-a-mirror-not-a-location)).
livediagram's database stays the source of truth, so realtime collaboration,
share links and the change log are untouched by it.

Evidence for every Google claim below (scopes, tokens, quotas, fields) is in
[Migration readiness, section A](../../research/migration-readiness.md#a-google-drive-two-way-mirror);
this spec does not restate it.

## Who and what

- **Signed-in users only.** A guest has no lasting identity to attach a Google
  account to. The verified Clerk user id owns the connection; the unsigned
  `X-Owner-Id` header never reaches any Drive route.
- **Personal Space only.** Team libraries are not mirrored (whose Drive would
  hold a team's copy is unresolved). Diagrams shared with the user, and Offline
  Mode diagrams, are not mirrored either.
- **Everyone, free.** Hosted livediagram.app offers it to every signed-in user.
  Self-hosters enable it with their own Google project (see
  [Self-hosting](#self-hosting)); without one, the feature is absent, not broken.

## Principles

1. **The browser does the work.** Reading Drive's change log, uploading files
   and applying changes all run in the user's own browser, straight against
   Google's API. The server only brokers tokens and stores a few small rows.
2. **Only while a tab is open.** There is no server polling. A tab syncs while
   open and catches up on arrival; nothing happens while nobody is here.
3. **Content flows one way, structure flows both ways.** livediagram writes the
   file's contents; Drive never writes them back. Names, folders and the bin
   travel both ways.
4. **Narrow access.** livediagram asks only for `drive.file` (files it creates
   or the user opens with it) and `drive.install` ("Open with"). It never sees
   the rest of the user's Drive.

## Connecting

- **Where:** the account menu's **Google Drive** entry opens a small panel:
  connection state, **Connect Google Drive**, and once connected, **Sync now**,
  **Last synced**, and **Disconnect**.
- **Consent:** the authorisation-code flow in **redirect mode** (works on iOS
  and past popup blockers), requesting `drive.file` and `drive.install` with
  offline access. `prompt=consent` is used only when no refresh token is
  stored, so the user normally consents once.
- **Exchange:** Google redirects back to the live app with a code and the
  `state` value the app set; the app posts both to the api, which checks
  `state`, exchanges the code with the client secret, encrypts the refresh
  token and stores it. The browser never sees the refresh token.
- **First mirror:** the browser creates the **`livediagram`** folder in My
  Drive (or reuses the one recorded for this user), creates the folder tree,
  then uploads every Personal Space diagram, oldest first, with progress in
  the panel. It is resumable: a closed tab continues where it stopped on the
  next visit.
- The `livediagram` root folder may be **moved anywhere** in Drive and
  renamed; it is tracked by id, not by name or place.

## Tokens

- `POST /api/drive/connect` (`{ code, state }`): exchanges the code, stores the
  encrypted refresh token, returns the connection summary.
- `POST /api/drive/token`: mints a one-hour access token from the stored
  refresh token and returns `{ accessToken, expiresAt }`. Called on arrival and
  shortly before expiry, so about once per active hour per user.
- `DELETE /api/drive/connection`: revokes the grant at Google, deletes the
  stored token and mirror rows. Drive files stay.
- The refresh token is encrypted with AES-GCM under a worker secret
  (`DRIVE_TOKEN_KEY`) before it reaches D1, and is never returned by any route.
- One refresh token per user, shared by all their devices, keeps well inside
  Google's limit of 100 live tokens per account per client.
- **Revoked or expired grant** (`invalid_grant`, or six months unused): the
  connection turns **Needs reconnecting**; the panel and a quiet banner offer
  **Reconnect**. Nothing is deleted.

## The file

- **Name:** the diagram name plus `.livediagram`. Names that Drive would
  alter are stored as Drive holds them, and the next inbound rename is
  compared against that stored form, never against the livediagram name.
- **MIME type:** `application/vnd.livediagram+json`, registered as the app's
  default type for "Open with".
- **Contents:** a whole-diagram envelope, the sibling of the per-tab export's
  `livediagram.tab` envelope (`apps/live/lib/export-tab-text.ts`):
  `{ kind: 'livediagram.diagram', schemaVersion, exportedAt, diagram }`, where
  `diagram` holds the id, name and every tab with its folders and slide
  deck. Images stay references to livediagram's image store; the file does
  not embed image bytes.
- **Thumbnail:** a PNG of the first tab, rasterised in the browser from the
  existing SVG snapshot, sent as `contentHints.thumbnail` (PNG, at least 220 px
  wide, under 2 MB). There is no separate preview file.
- **`appProperties`:** `ldDiagramId` (the diagram id) and `ldOrigin` (the
  deployment's host), so a file maps back to its diagram after any rename or
  move, and a file from another deployment is recognised as foreign.

## Folders

- The `livediagram` root folder is **Unsorted**: diagrams without a folder sit
  directly in it.
- Every Personal Space folder is a Drive folder at the same place in the tree.
- **Folders created in Drive** by the user are invisible to livediagram under
  `drive.file` until the user shows them to it; see
  [Folders livediagram cannot see](#folders-livediagram-cannot-see).

## Outbound: livediagram to Drive

| In livediagram                   | In Drive                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Diagram created                  | File created in its folder                                                                                                |
| Diagram edited                   | File contents and thumbnail rewritten, at the [cadence](#cadence)                                                         |
| Diagram renamed                  | File renamed                                                                                                              |
| Diagram moved to another folder  | File moved                                                                                                                |
| Diagram deleted (to Trash)       | File moved to Drive's bin                                                                                                 |
| Diagram restored from Trash      | File restored from the bin (re-created if it is gone)                                                                     |
| Diagram purged from Trash        | File permanently deleted, if still in the bin                                                                             |
| Diagram moved into a team        | File moved to Drive's bin (the diagram left Personal Space)                                                               |
| Diagram moved out of a team      | File created (or restored), as a new Personal Space diagram                                                               |
| Folder created / renamed / moved | Folder created / renamed / moved                                                                                          |
| Folder deleted                   | Its diagrams and subfolders move up ([Folders](../013-workspace/folders.md)), then the empty Drive folder goes to the bin |

## Inbound: Drive to livediagram

The browser reads `changes.list` from the stored page token and applies each
change whose file it recognises (by `appProperties.ldDiagramId` or a recorded
folder id):

| In Drive                                             | In livediagram                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| File renamed                                         | Diagram renamed (the `.livediagram` extension is dropped; an empty name keeps the old one)      |
| File moved to another mirrored folder                | Diagram moved to that folder                                                                    |
| File moved to the root folder                        | Diagram moved to Unsorted                                                                       |
| File moved to a folder livediagram cannot see        | Diagram moved to Unsorted, with a notice (see below)                                            |
| File moved outside the `livediagram` tree entirely   | Same as a folder livediagram cannot see                                                         |
| File moved to the bin                                | Diagram moved to Trash ([Trash](../013-workspace/trash.md))                                     |
| File restored from the bin                           | Diagram restored from Trash                                                                     |
| File permanently deleted (`removed`, or bin emptied) | Diagram purged from Trash                                                                       |
| Folder renamed / moved between mirrored folders      | Folder renamed / moved                                                                          |
| Folder moved to the bin                              | Its diagrams go to Trash and the folder is removed; restoring the folder in Drive restores both |
| File contents edited                                 | Ignored; the next outbound write replaces them                                                  |

- **Our own writes are not echoes.** For each mirrored item the api stores the
  last state livediagram wrote (`name`, `parents`, `trashed`, `md5Checksum`,
  `headRevisionId`). A change is foreign only when one of them differs; Drive's
  `version` is not used, since it moves for invisible reasons.
- **Order.** On arrival, inbound changes are applied before any outbound
  write, so a rename made in Drive while away is not overwritten by a stale
  local name.
- **Both sides changed the same attribute** since the last sync: the later
  change wins, by Drive's change `time` against the livediagram change's time.
- Inbound changes go through the ordinary api routes (rename, move, delete,
  restore), so authorisation, the change log and realtime rooms behave exactly
  as if the user had done it in livediagram.

## Folders livediagram cannot see

Under `drive.file`, a folder the user creates in Drive is invisible to
livediagram: moving a diagram's file into it shows up only as "moved to an
unknown folder". The user's goal is to shape the tree from either side with
the same result, so the mirror handles this openly, never silently:

- The diagram moves to **Unsorted**, and a notice in the Drive panel (and on
  the diagram's Explorer row) says so: "Moved in Drive to a folder livediagram
  can't see."
- **Adopting a folder** (pending operator decision, tracked in
  `AMBIGUITIES.md`): the notice offers **Show this folder to livediagram**,
  which opens the Google Picker with folder selection. Picking the folder
  grants livediagram access to it; livediagram then creates the matching
  Personal Space folder, places it under its nearest mirrored ancestor (or at
  the root when that is unknown too), and moves the diagram into it. From then
  on that folder syncs both ways like any other.
- Folders created **in livediagram** always appear in Drive, so building the
  tree from livediagram needs no adoption.

## Cadence

Named constants in one module
(`apps/live/lib/drive-mirror/cadence.ts`), with the values and budget from
[Migration readiness, proposed sync cadence](../../research/migration-readiness.md#proposed-sync-cadence):

- **One tab syncs per browser**, elected with the Web Locks API; across
  devices, a short lease row in D1 keeps two browsers from writing the same
  diagram at once.
- **Arrival:** one `changes.list` catch-up, then re-upload of every diagram
  saved since its last mirrored revision.
- **While visible:** poll every 20 minutes, and on focus when the last poll is
  over 5 minutes old; never while hidden.
- **Writes:** a diagram is mirrored after 60 seconds without edits, at most
  once per 5 minutes, and flushed when the tab hides or the user leaves the
  diagram.
- **Back-off:** on `403 userRateLimitExceeded` or `429`, the intervals double
  (capped), returning to normal after an hour without errors.
- The page token is written to D1 only when it changed, at most every 10
  minutes and on flush.

## Open with

- The live app serves `/drive/open`, the Drive UI integration's Open URL.
  Google passes `state={"ids":[...],"action":"open",...}`.
- The browser reads the file's `appProperties`:
  - **The user can open the diagram** in livediagram: go to it.
  - **They cannot** (someone shared the Drive file with them): offer
    **Import a copy**, which creates a new Personal Space diagram from the
    file's contents.
  - **The file is from another deployment** (`ldOrigin` differs) or has no
    `ldDiagramId`: offer **Import a copy** only.
  - **Not a livediagram file**, or unreadable: a clear error page.
- A signed-out visitor is asked to sign in first, then continues.
- Opening with "Open with" grants livediagram access to that one file, which is
  what makes the import possible under `drive.file`.
- **Double-click** opening is the goal; Google documents only the "Open with"
  menu, so the help article promises "Open with" until a real test confirms
  double-click.

## Disconnecting and account deletion

- **Disconnect** revokes the grant, deletes the stored token and mirror rows,
  and **leaves every Drive file in place**. Reconnecting later starts a fresh
  mirror into a new or re-chosen root, matching existing files by
  `ldDiagramId` where it can.
- **Account deletion** does the same revoke and delete as part of deleting the
  account. Drive files are the user's and stay.

## Data

D1, owned by the api worker:

- `drive_connections`: `owner_id` (Clerk user id, primary key),
  `refresh_token_enc`, `root_folder_id`, `page_token`, `page_token_saved_at`,
  `status` (`connected` | `needs_reconnect`), `connected_at`, `lease_holder`,
  `lease_expires_at`.
- `drive_items`: `owner_id`, `item_kind` (`diagram` | `folder`), `ld_id`,
  `drive_file_id`, and the last written `name`, `parent_id`, `trashed`,
  `md5`, `head_revision_id`, plus `mirrored_saved_at` (the diagram revision
  last uploaded). Unique on `(owner_id, item_kind, ld_id)` and on
  `(owner_id, drive_file_id)`.
- Deleting a diagram, folder or account deletes its rows in the same batch as
  the rest of the removal.

## Errors and edge cases

- **Offline or Google unreachable:** the sync pauses and resumes on the next
  arrival or focus; the panel shows **Last synced** honestly.
- **A mirrored file or folder deleted outside livediagram's knowledge**
  (`404` on write): the item is re-created in its expected place.
- **Diagram JSON over 5 MB:** uploaded with a resumable upload instead of
  multipart.
- **Quota or rate errors:** back-off as above; a persistent failure shows in
  the panel, never silently.
- **Two devices at once:** the D1 lease decides which one writes; the other
  still reads changes.
- Every decision point logs a fingerprinted line in the browser console
  (`[drive-mirror]`) and every api route logs its outcome (`drive:`), so a
  failure is traceable from either side.

## Self-hosting

- Env on the api worker: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `DRIVE_TOKEN_KEY`; the live app reads the client id as
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Documented in each `.env.example`.
- **All three unset:** no Drive entry in the account menu.
- **Client id only (no secret):** browser-only tokens via the Google Identity
  Services token model. Google cannot renew those without a click, so when a
  token lapses the panel shows **Resume sync** instead of syncing silently.
- A mirror is per Google project: files created by one deployment are foreign
  to another (`ldOrigin`), and are imported as copies.

## Costs

Near zero on our side; the traffic is browser to Google. See the
[cost model](../../research/migration-readiness.md#cost-model): about $0 at 50
and 10,000 users, about $18.50 a month at 10 million. No Durable Object is
used. Google's Drive API is free within its quotas; the cadence keeps 10
million users at about 80% of the free daily threshold.

## Privacy

The privacy policy states what livediagram does with Google user data under
Google's Limited Use rules: it writes and reads only the files it created or
the user opened with it, stores only an encrypted refresh token and file ids,
and never uses Drive data for anything but the mirror.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Preset-enum events only: connected, disconnected, reconnect needed, first
mirror finished, an inbound change applied (by type: `Rename`, `Move`,
`Trash`, `Restore`, `Purge`, `UnknownFolder`), an Open with (by outcome:
`Opened`, `ImportOffered`, `Error`).

## Non-goals

- Drive as a place a diagram lives.
- Mirroring team libraries.
- Importing content edits made to a file in Drive.
- Server-side polling or Drive push notifications.
- A Google Workspace Marketplace listing (possible later, as a discovery channel).

## References

[Save Locations](../006-diagram/save-locations.md),
[Trash](../013-workspace/trash.md),
[Folders](../013-workspace/folders.md),
[Auth + guest access](../014-identity/auth-and-guest-access.md),
[Migration readiness](../../research/migration-readiness.md).
