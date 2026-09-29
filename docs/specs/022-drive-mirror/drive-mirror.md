# Google Drive mirror

A signed-in user can **mirror their Personal Space to their own Google Drive**.
Every diagram becomes a `.livedoc` file in a folder tree that matches their
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
  offline access. `prompt=consent` is used only when no usable refresh token
  is stored, which is exactly when the connect flow runs (a first connect, or
  a reconnect after Google dropped the grant), so the user normally consents
  once.
- **State:** before redirecting, the app asks the api for a `state` value
  (`POST /api/drive/state`, with the redirect URI it will use). The api signs
  it with `DRIVE_TOKEN_KEY`, binding the user, the redirect URI and a
  10-minute expiry, so a code can only be redeemed by the user who asked for
  it, and only against the redirect URI it was issued for.
- **Exchange:** Google redirects back to the live app at `/drive/connected` with a code and the
  `state` value the app set; the app posts both to the api, which checks
  `state`, exchanges the code with the client secret, encrypts the refresh
  token and stores it. The browser never sees the refresh token.
- **First mirror:** the browser creates the **`livediagram`** folder in My
  Drive (or reuses the one recorded for this user), creates the folder tree,
  then uploads every Personal Space diagram, oldest first, with progress in
  the panel. It is resumable: a closed tab continues where it stopped on the
  next visit.
- The `livediagram` root folder may be **moved anywhere** in Drive and
  renamed; it is tracked by id, not by name or place. It carries the
  `appProperties` `ldRoot` (the deployment's host), so a reconnect finds it
  again rather than making a second one.

## Tokens

- `POST /api/drive/connect` (`{ code, state }`): exchanges the code, stores the
  encrypted refresh token, returns the connection summary.
- `POST /api/drive/token` has its own per-user rate limit (10 a minute), far
  below the general write limit, because every call reaches Google; past it the
  api answers `429 drive_token_rate_limited` and the browser backs off exactly as
  it does for Google's own rate limits. A deployment without the limiter binding
  allows every call.
- `POST /api/drive/token`: mints a one-hour access token from the stored
  refresh token and returns `{ accessToken, expiresAt }`. Called on arrival and
  shortly before expiry, so about once per active hour per user.
- `DELETE /api/drive/connection`: revokes the grant at Google, deletes the
  stored token and mirror rows. Drive files stay.
- The browser's own bookkeeping, all small rows owned by the caller:
  `GET` / `PUT /api/drive/connection` (the connection summary; the root
  folder and page token), `GET` / `PUT /api/drive/items` and
  `DELETE /api/drive/items/:kind/:ldId` (the mirrored items),
  `POST` / `DELETE /api/drive/lease` (the cross-device lease).
- Every Drive route answers only a **Clerk session** (`401 sign_in_required`
  otherwise): not the guest header, and not an API token, since a token that
  could mint Google access would outlive the person's attention to it.
- `GET /api/capabilities` reports `driveMode`: `off`, `browser` (client id
  only) or `broker` (client id, secret and key), so the app knows which
  token path to take.
- The refresh token is encrypted with AES-GCM under a worker secret
  (`DRIVE_TOKEN_KEY`) before it reaches D1, and is never returned by any route.
- One refresh token per user, shared by all their devices, keeps well inside
  Google's limit of 100 live tokens per account per client.
- **Revoked or expired grant** (`invalid_grant`, or six months unused): the
  connection turns **Needs reconnecting**; the panel and a quiet banner offer
  **Reconnect**. Nothing is deleted.

## The file

- **Name:** the diagram name plus `.livedoc`. Names that Drive would
  alter are stored as Drive holds them, and the next inbound rename is
  compared against that stored form, never against the livediagram name.
- **Why `.livedoc`:** a diagram is becoming one kind of tab (beside the
  whiteboard and the event-storming board), so the file is named for the
  document that holds them, not for one kind of tab. And `.livedoc` is not a
  top-level domain, so a chat app never turns a file name like `plan.livedoc`
  into a link. The MIME type below keeps the product name. Nothing shipped
  under another extension, so no other extension is read.
- **MIME type:** `application/vnd.livediagram+json`, registered as the app's
  default type for "Open with", with `livedoc` as its default extension.
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
  move, and a file from another deployment is recognised as foreign. Mirrored
  folders carry `ldFolderId` and `ldOrigin` the same way, so a folder
  restored from the bin, or met again after a reconnect, is recognised too.

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
| File renamed                                         | Diagram renamed (the `.livedoc` extension is dropped; an empty name keeps the old one)          |
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
  change wins, by Drive's change `time` against the livediagram change's time
  (a diagram's `savedAt`, a folder's `updatedAt`). "Changed since the last
  sync" is judged against the item row: Drive's side against the stored Drive
  state, livediagram's side against `ld_name` and the stored parent. A change
  whose value livediagram already holds is recorded, not applied.
- **Restoring from the bin places the diagram where its file sits** in Drive,
  so restoring a binned folder brings back its diagrams inside it.
- **A permanent delete only purges from the Trash.** `removed` also means
  "livediagram lost access", so a live diagram whose file is removed is not
  deleted; its file is re-created on the next write.
- **A file whose contents were edited in Drive** (a new `md5Checksum`) is
  rewritten from livediagram on the next outbound pass, so the canonical copy
  comes back without waiting for the next edit.
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
  can't see." The notice is kept on the item row, so every device shows it; it
  clears when the diagram is moved again from either side, or when the folder
  is adopted. Until then the file stays where the user put it in Drive. A folder moved into one is placed at
  the top level with the same notice in the panel.
- **Adopting a folder:** the notice offers **Show this folder to livediagram**,
  which opens the Google Picker with folder selection. Picking the folder
  grants livediagram access to it; livediagram then creates the matching
  Personal Space folder, places it under its nearest mirrored ancestor (or at
  the root when that is unknown too), and moves the diagram into it. From then
  on that folder syncs both ways like any other. Widening access to all of
  Drive (a restricted scope with a yearly paid security assessment) is
  deliberately not the answer.
- Whether picking a folder also grants access to files inside it that
  livediagram did not create is untested; adoption relies only on access to
  the folder itself.
- Folders created **in livediagram** always appear in Drive, so building the
  tree from livediagram needs no adoption.

## Cadence

Named constants in one cadence module of the mirror code, with the values and budget from
[Migration readiness, proposed sync cadence](../../research/migration-readiness.md#proposed-sync-cadence):

- **Any livediagram page may run it** (the Explorer, the editor, the wizard),
  never an embed and never the Drive routes themselves; it starts once the
  signed-in session has settled.
- **One tab syncs per browser**, elected with the Web Locks API; across
  devices, a short lease row in D1 keeps two browsers from writing the same
  diagram at once. The lease lasts 15 minutes, is renewed only when a pass
  has something to write and under 5 minutes remain, and is released when the
  tab hides, so a device that walks away hands over at once.
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
- A signed-in user with no usable Drive access (never connected, or the grant
  was dropped) is offered **Allow access**, which runs the connect flow and
  comes back to the same file.
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
- `refresh_token_enc` is empty for a browser-only connection (client id only).
- `drive_items` also keeps `ld_name` (the livediagram name the Drive name
  mirrors, since Drive may store a name differently), and `notice` with
  `notice_parent_id` for the [unseen-folder notice](#folders-livediagram-cannot-see).
- **Finishing a removal in Drive.** Because a purge or a folder deletion takes
  the row with it, each browser remembers the rows it last saw. A row that
  disappears while its diagram or folder is gone from livediagram is finished
  in Drive by the next pass in any browser that saw it: a binned file is
  deleted for good, anything else goes to the bin (a diagram taken offline,
  a deleted folder once its contents have moved up). A file nobody saw go is
  left to Drive's own 30-day bin.

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
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and the Google Picker's browser key as
  `NEXT_PUBLIC_GOOGLE_API_KEY`. Documented in each `.env.example`. The api's
  `GOOGLE_CLIENT_ID` switches the feature on at all; without it every Drive
  route answers `503 drive_not_configured`.
- **All three unset:** no Drive entry in the account menu.
- **Client id only (no secret):** browser-only tokens via the Google Identity
  Services token model. Google cannot renew those without a click, so when a
  token lapses the panel shows **Resume sync** instead of syncing silently.
- A mirror is per Google project: files created by one deployment are foreign
  to another (`ldOrigin`), and are imported as copies.
- `GOOGLE_OAUTH_BASE_URL` on the api worker points the token exchange and
  revoke at another origin. It exists for the test suite's fake Google and is
  never set by a real deployment.

## Costs

Near zero on our side; the traffic is browser to Google. See the
[cost model](../../research/migration-readiness.md#cost-model): about $0 at 50
and 10,000 users, about $18.50 a month at 10 million. No Durable Object is
used. Google's Drive API is free within its quotas; the cadence keeps 10
million users at about 80% of the free daily threshold.

The research model counted only the page token's D1 writes. Two more are
inherent in the design: one item row per upload or applied change (about six
an active user-day at this cadence) and the lease (renewed at most every ten
minutes of writing). Together they add about $70 a month at 10 million users
(200,000 active a day, about 12 row writes each, at $1 per million), and
nothing measurable at 10,000.

## Privacy

The privacy policy states what livediagram does with Google user data under
Google's Limited Use rules: it writes and reads only the files it created or
the user opened with it, stores only an encrypted refresh token and file ids,
and never uses Drive data for anything but the mirror.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Preset-enum events only, category `Drive`: connected and disconnected
(`Linked` / `Unlinked`, typed `Broker` or `Browser`), reconnect needed
(`Changed` `NeedsReconnect`), first mirror finished (`Created` `FirstMirror`,
once per connection per browser), an inbound change applied (`Applied`, by
type: `Rename`, `Move`, `Trash`, `Restore`, `Purge`, `UnknownFolder`), an Open
with (`Opened`, by outcome: `Opened`, `ImportOffered`, `Error`).

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
