# Google Drive mirror

A signed-in user can **mirror My documents to their own Google Drive**.
Every document becomes a `.livediagram` file in a folder tree that matches their
livediagram folders, kept in step both ways while a livediagram tab is open.
Double-clicking such a file in Drive opens it in livediagram.

The mirror is a **copy**, never the document's home
([Save Locations](../006-document/save-locations.md#google-drive-is-a-mirror-not-a-location)).
livediagram's database stays the source of truth, so realtime collaboration,
share links and the change log are untouched by it.

Evidence for every Google claim below (scopes, tokens, quotas, fields) is in
[Migration readiness, section A](../../research/migration-readiness.md#a-google-drive-two-way-mirror);
this spec does not restate it.

## Who and what

- **Signed-in users only.** A guest has no lasting identity to attach a Google
  account to. The verified Clerk user id owns the connection; the unsigned
  `X-Owner-Id` header never reaches any Drive route.
- **My documents only.** Team libraries are not mirrored (whose Drive would
  hold a team's copy is unresolved). Documents shared with the user, and Offline
  Mode documents, are not mirrored either.
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

- **Where:** Settings > Account > **Cloud Sync**, a section beside **You**,
  **Your Data** and **Danger Zone**. Cloud Sync is a **catalogue of cloud
  providers**, one row each; Google Drive is its first row, and another
  provider (Dropbox, OneDrive) is another row in the same section with no new
  UI. The section is there only where the deployment offers a provider. The
  account menu has no Drive entry. Search finds the row by drive, google,
  sync, backup, mirror and cloud; it links to the help article.
- **The row is one row:** the cloud and "Google Drive" on the left; on the
  right, the status and one button: **Connect** when not connected (held,
  still reading Connect, while the status says "Connecting…"), the neutral
  grey **Disconnect** when connected or paused (reversible, and the Drive
  files stay; its confirmation is neutral too). Connected, the grey line under
  the card says where the documents go, and the **quoted folder name is a
  link** to that folder in Google Drive, in a new tab
  (`https://drive.google.com/drive/folders/<root id>`), once the root's id is
  known, which our own server tells before any call to Google. On a narrow
  screen the status and button wrap under the name rather than leave the card.
  There is no body text and no Sync now: **syncing is
  automatic** (after edits, every 2 minutes, and on returning to the tab,
  retrying by itself; the exact rhythm is in the help article).
- **The status** is plain, small, muted text: "Checking…", "Not connected",
  "Connecting…", "Last synced just now", "Last synced 3 mins ago" ("Not
  synced yet" before the first), "Syncing…" (only once a sync has run for a
  moment, so a routine check never flickers it), "Copying 3 of 12…". When
  something needs the user it turns to the warning colour **with a small
  warning glyph**, so colour is never the only signal: "Needs reconnecting",
  "Paused", "Needs attention" (a folder notice) or "Offline".
- **A second line only for problems,** with what to press:
  - a Connect that could not start: "Couldn't reach Google. Check your
    connection and try again." (it starts as **Connecting…** at once, and stays
    so while the consent state is fetched and the browser leaves for Google,
    so there is never a moment where nothing seems to happen);
  - a cancel at Google, calmly: "Connection cancelled. Connect whenever you're
    ready.";
  - "Google Drive needs reconnecting. Your files are safe." with
    **Reconnect**, or "Syncing paused in this browser. Resume to continue."
    with **Resume**;
  - "Can't reach Google Drive. Trying again automatically.";
  - a folder notice, "<name>: Moved to a Drive folder livediagram can't
    see." (with "and n more" for several; the next shows once one is
    resolved) with **Show folder**.
    The why (rate limits, reconnecting, the rhythm and its per-document limit,
    copies made in Drive) is in the help article.
- **Leaving for Google and coming back** always returns the user to exactly
  where they started: the same page with Settings open on Account > Cloud
  Sync. Before leaving, the page's own history entry is given
  `?settings=account&section=cloud-sync` (the entry is kept, not replaced by
  a navigation), so the browser's Back button from Google's page reloads it
  with Cloud Sync open. The same place is carried through the consent (kept
  in this browser's session against the consent state, and accepted only as
  a same-origin path), so a finished connection, and a **cancel at Google**,
  come back there too. Back from a finished connection the status says
  **Connecting…** (never Not connected: the connection exists) until the
  mirror reports, and the mirror syncs at once, even when another tab of the
  same browser is the one running it.
- **Below the card:** not connected, "My documents, copied to your
  Google Drive in matching folders. Renames, moves and deletions sync both
  ways. livediagram only sees files it created."; connected, "Your documents
  are synced to “<root folder name>” in Google Drive." (the root's actual
  name, as the user may have renamed it; "Your documents are synced to Google
  Drive." while unknown).
- **Terminology:** "documents"; "Google Drive", then "Drive" once named;
  "sync" for the ongoing work, "copy" only for the first copy.
- **Nothing moves within a phase** (the product's layout stability rule,
  "Layout stability" in the interface design specs, **reserve per phase, not
  per message**). The phases are **not connected** (checking, not connected,
  connecting, a connect that failed, a cancel), **connected** (synced,
  syncing, the first copy, offline, folder notices) and **needs attention**
  (reconnect, resume). Within a phase the row keeps its shape: the status
  holds that phase's wordings at their widest realistic value, and the button
  its phase's labels ("Connect" / "Connecting…"). The problem line appears
  only while there is a problem, below the row, moving nothing in it; a
  change of phase that follows the user's own action (Connect, Disconnect,
  Reconnect) may change the card's height. No blank space is kept for
  anything, and no button covers anything at any width. Counts and times use
  tabular numerals.
- **Where the status lives:** only in Cloud Sync. The avatar carries no
  sync mark, badge or tooltip; it renders exactly as without Drive.
- **Targeting a section:** Settings opens on a category and, optionally, a
  **section** of it: the section scrolls into view and its heading takes
  focus. Any section can be targeted this way; the connect flow returns to
  Account > Cloud Sync through it.
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
- **First mirror:** the browser creates the root folder in My Drive (or
  reuses the one recorded for this user), creates the folder tree,
  then uploads every document in My documents, oldest first, with progress in
  the Cloud Sync row. It is resumable: a closed tab continues where it stopped on the
  next visit.
- **The root folder's name** comes from the deployment's address, with no
  setting, so the roots of different environments never share a name in one
  tester's Drive (each environment makes its own root: its own Google project,
  database and `ldRoot`):

  | Host                                                                                                           | Root folder name            |
  | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
  | `livediagram.app`, `www.livediagram.app`                                                                       | `livediagram`               |
  | `staging.livediagram.app`; loopback (`localhost`, `127.0.0.1`, `::1`, any port), which uses the staging client | `livediagram (staging)`     |
  | any other host (a self-hosted deployment)                                                                      | `livediagram (self-hosted)` |

  Hosts compare case-insensitively. The name is given only when the root is
  **created**; a root the user renamed keeps its name, and livediagram never
  renames an existing root back.

- The root folder may be **moved anywhere** in Drive and
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
  connection turns **Needs reconnecting**; the Cloud Sync row and a quiet banner offer
  **Reconnect**. Nothing is deleted.

## The file

- **Name:** the document name plus `.livediagram`. Names that Drive would
  alter are stored as Drive holds them, and the next inbound rename is
  compared against that stored form, never against the livediagram name.
- **MIME type:** `application/vnd.livediagram+json`, registered as the app's
  default type for "Open with".
- **Contents:** a whole-document envelope, the sibling of the per-tab export's
  `livediagram.tab` envelope (`apps/live/lib/export-tab-text.ts`):
  `{ kind: 'livediagram.document', schemaVersion, exportedAt, document }`, where
  `diagram` holds the id, name and every tab with its folders and slide
  deck. Images stay references to livediagram's image store; the file does
  not embed image bytes.
- **Thumbnail:** a PNG of the first tab, rasterised in the browser from the
  existing SVG snapshot, sent as `contentHints.thumbnail` (PNG, at least 220 px
  wide, under 2 MB). There is no separate preview file.
- **`appProperties`:** `ldDocumentId` (the document id) and `ldOrigin` (the
  deployment's host), so a file maps back to its document after any rename or
  move, and a file from another deployment is recognised as foreign. Mirrored
  folders carry `ldFolderId` and `ldOrigin` the same way, so a folder
  restored from the bin, or met again after a reconnect, is recognised too.

## Folders

- The root folder is the **root of My documents**: documents without a folder sit
  directly in it.
- Every folder in My documents is a Drive folder at the same place in the tree.
- **Folders created in Drive** by the user are invisible to livediagram under
  `drive.file` until the user shows them to it; see
  [Folders livediagram cannot see](#folders-livediagram-cannot-see).

## Outbound: livediagram to Drive

| In livediagram                   | In Drive                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Document created                 | File created in its folder                                                                                                 |
| Document edited                  | File contents and thumbnail rewritten, at the [cadence](#cadence)                                                          |
| Document renamed                 | File renamed                                                                                                               |
| Document moved to another folder | File moved                                                                                                                 |
| Document deleted (to Trash)      | File moved to Drive's bin                                                                                                  |
| Document restored from Trash     | File restored from the bin (re-created if it is gone)                                                                      |
| Document purged from Trash       | File permanently deleted, if still in the bin                                                                              |
| Document moved into a team       | File moved to Drive's bin (the document left My documents)                                                                 |
| Document moved out of a team     | File created (or restored), as a new document in My documents                                                              |
| Folder created / renamed / moved | Folder created / renamed / moved                                                                                           |
| Folder deleted                   | Its documents and subfolders move up ([Folders](../013-workspace/folders.md)), then the empty Drive folder goes to the bin |

## Inbound: Drive to livediagram

The browser reads `changes.list` from the stored page token and applies each
change whose file it recognises (by `appProperties.ldDocumentId` or a recorded
folder id):

| In Drive                                             | In livediagram                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| File copied (Drive's "Make a copy")                  | Nothing: livediagram never sees the copy (**verified**, [Copies made in Drive](#copies-made-in-drive)) |
| File renamed                                         | Document renamed (the `.livediagram` extension is dropped; an empty name keeps the old one)            |
| File moved to another mirrored folder                | Document moved to that folder                                                                          |
| File moved to the root folder                        | Document moved to the root of My documents                                                             |
| File moved to a folder livediagram cannot see        | Document moved to the root of My documents, with a notice (see below)                                  |
| File moved outside the `livediagram` tree entirely   | Same as a folder livediagram cannot see                                                                |
| File moved to the bin                                | Document moved to Trash ([Trash](../013-workspace/trash.md))                                           |
| File restored from the bin                           | Document restored from Trash                                                                           |
| File permanently deleted (`removed`, or bin emptied) | Document purged from Trash                                                                             |
| Folder renamed / moved between mirrored folders      | Folder renamed / moved                                                                                 |
| Folder moved to the bin                              | Its documents go to Trash and the folder is removed; restoring the folder in Drive restores both       |
| File contents edited                                 | Ignored; the next outbound write replaces them                                                         |

- **Our own writes are not echoes.** For each mirrored item the api stores the
  last state livediagram wrote (`name`, `parents`, `trashed`, `md5Checksum`,
  `headRevisionId`). A change is foreign only when one of them differs; Drive's
  `version` is not used, since it moves for invisible reasons.
- **Order.** On arrival, inbound changes are applied before any outbound
  write, so a rename made in Drive while away is not overwritten by a stale
  local name.
- **Both sides changed the same attribute** since the last sync: the later
  change wins, by Drive's change `time` against the livediagram change's time
  (a document's `savedAt`, a folder's `updatedAt`). "Changed since the last
  sync" is judged against the item row: Drive's side against the stored Drive
  state, livediagram's side against `ld_name` and the stored parent. A change
  whose value livediagram already holds is recorded, not applied.
- **Restoring from the bin places the document where its file sits** in Drive,
  so restoring a binned folder brings back its documents inside it.
- **A permanent delete only purges from the Trash.** `removed` also means
  "livediagram lost access", so a live document whose file is removed is not
  deleted; its file is re-created on the next write.
- **A file whose contents were edited in Drive** (a new `md5Checksum`) is
  rewritten from livediagram on the next outbound pass, so the canonical copy
  comes back without waiting for the next edit.
- Inbound changes go through the ordinary api routes (rename, move, delete,
  restore), so authorisation, the change log and realtime rooms behave exactly
  as if the user had done it in livediagram.

## Copies made in Drive

**Verified** against real Google (the staging client, scopes `drive.file` and
`drive.install`): a copy the user makes in Drive's own UI ("Make a copy") is
**invisible to livediagram**. It is not a file livediagram created, so
`files.list` does not show it and it never reaches `changes.list`. Drive-UI
copies are therefore **not mirrored** automatically: nothing happens in
livediagram when one is made. The way in is **Open with > livediagram** on the
copy (below), or **Duplicate** inside livediagram.

- **Open with on a copy.** Opening the copy with livediagram grants access to
  that one file, and it carries the **original's** `ldDocumentId` and
  `ldOrigin`. It is a different Drive file: recognised because the mirror
  records another file for that `ldDocumentId` (and `ldOrigin` is this
  host). It is never taken for the original: livediagram never opens the
  original from it and never re-tags or adopts it as the original. It offers
  **Import as new document**, which makes a new document in My documents from
  the **copy's contents**.
- **What the copy becomes** (the current rule, **pending the operator's
  confirmation**): after the import a copy the user owns is re-tagged with the
  new document's id and recorded (one someone else owns is imported and left
  as it is), so it mirrors the new document like any mirrored
  file and no second file is made for it. The new document lands in the
  livediagram folder the copy's Drive folder mirrors; at the root of My documents when the copy
  sits in the root, and at that root with [the notice](#folders-livediagram-cannot-see)
  when it sits in a folder livediagram cannot see.
- **Afterwards.** Once opened, the copy can reach livediagram's change feed.
  An inbound change for a file that carries a mirrored document's id under
  another file id is ignored (logged as `inbound-foreign-copy`), never
  applied, re-tagged or adopted. The same holds when the mirror is re-met after
  a reconnect: two files claiming one document are both left alone, and the next
  write makes a fresh file for it.
- **Traceable.** A file livediagram is shown but does not take as its own
  (no `ldOrigin` of this deployment) is logged quietly
  (`[drive-mirror] inbound-not-ours`, with whether it carried any
  `appProperties` at all).

## Folders livediagram cannot see

Under `drive.file`, a folder the user creates in Drive is invisible to
livediagram: moving a document's file into it shows up only as "moved to an
unknown folder". The user's goal is to shape the tree from either side with
the same result, so the mirror handles this openly, never silently:

- The document moves to the **root of My documents**, and a notice in the Cloud Sync row (and on
  the document's Explorer row) says so: "Moved in Drive to a folder livediagram
  can't see." The notice is kept on the item row, so every device shows it; it
  clears when the document is moved again from either side, or when the folder
  is adopted. Until then the file stays where the user put it in Drive. A folder moved into one is placed at
  the top level with the same notice in the Cloud Sync row.
- **Adopting a folder:** the notice offers **Show this folder to livediagram**,
  which opens the Google Picker with folder selection. Picking the folder
  grants livediagram access to it; livediagram then creates a matching
  folder in My documents, places it under its nearest mirrored ancestor (or at
  the root when that is unknown too), and moves the document into it. From then
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
  document at once. The lease lasts 15 minutes, is renewed only when a pass
  has something to write and under 5 minutes remain, and is released when the
  tab hides, so a device that walks away hands over at once.
- **Arrival:** one `changes.list` catch-up, then re-upload of every document
  saved since its last mirrored revision.
- **A visible tab is never left unsynced.** While any livediagram tab of the
  browser is visible, Drive is checked every **2 minutes** and when the user
  returns to a tab (at most once every 30 seconds), whichever tab is the one
  that syncs: a visible tab that does not sync asks the one that does, over
  the tabs' channel. If that tab does not answer within 10 seconds (it is
  frozen or gone), the visible tab takes the sync over. Nothing is checked
  while every tab is hidden. After sleep, the first moment a tab is visible
  again brings a check.
- **Opening Cloud Sync checks.** When the Cloud Sync row scrolls into view, a
  check runs (unless one finished in the last 30 seconds): the status reads
  "Checking…" while it runs, then "Last synced just now".
- **"Last synced" means the last successful check**, including a check that found
  nothing new. A visible tab whose last check is older than two check
  intervals logs `drive: stale` (a bug to find, never a state shown quietly)
  and asks for a check at once. Each check first asks for
  `changes.getStartPageToken` (5 units) and reads `changes.list` (about 100
  units) only when that token differs from the stored one. The gate never
  skips a real change: the start token names the position after the latest
  change, so an equal token means nothing new since the stored one; it only
  saves cost. The arrival catch-up and every requested check use the same gate.
- **Diagnostic:** with `localStorage['livediagram:v2:drive-diagnostics'] = '1'`
  every check logs `drive: start-token moved=<bool> listed=<n>`, which is how
  the unverified point below (research E-A3) is settled against real Drive.
- **Writes:** a document is mirrored after 60 seconds without edits, at most
  once per 5 minutes, and flushed when the tab hides or the user leaves the
  document.
- **Back-off:** on `403 userRateLimitExceeded` or `429`, the intervals double
  (the check up to 60 minutes, writes up to 30), returning to normal after an
  hour without errors.
- The page token is written to D1 only when it changed, at most every 10
  minutes and on flush.

## Other views follow

When a check applies a change from Drive, every open view that lists or shows
documents re-reads itself without a reload: the Explorer (Recent, folders,
My documents, the Trash view), the editor's own Explorer panel and folders, the
New Document page's recent list, and the open editor itself (its title after a
rename, its folder after a move, the deleted card after a move to the Trash).
Every open tab follows, not only the one that ran the check. It rides the
existing "something was just written" signal the Timeline already listens to,
marked as coming from Drive so a view re-reads only for those.

## The Explorer shows each document's sync

Each document the mirror copies carries a small cloud on its Explorer row and
card, at the right of its Updated time, on the same centre line as the
visibility badge and the time ([Optical alignment](../004-interface-design/optical-alignment.md)).
It is a vendored Lucide glyph drawn at a 1px stroke: the cloud in the quiet
metadata colour, and only its symbol in colour, named on hover and focus.

| State   | Glyph                                           | Symbol colour | Name                                                       |
| ------- | ----------------------------------------------- | ------------- | ---------------------------------------------------------- |
| Synced  | `cloud-check`                                   | green         | Synced to Google Drive                                     |
| Waiting | `cloud-upload`                                  | blue          | Waiting to sync to Google Drive                            |
| Syncing | `cloud-sync`, pulsing (not with reduced motion) | blue          | Syncing to Google Drive…                                   |
| Failed  | `cloud-alert`                                   | amber         | Couldn't sync to Google Drive. Trying again automatically. |

What decides it:

- **Mirrorable** is known from the row itself: the user's own document, in
  My documents, saved in the cloud. Team documents, documents shared
  with the user and offline documents never carry a mark.
- **Synced** when the savedAt last uploaded (`drive_items.mirrored_saved_at`)
  is at least the document's savedAt. Otherwise **Waiting**, or **Syncing**
  while a pass runs. A mirrorable document the engine has not seen yet (new,
  duplicated, imported, moved out of a team, synced up from offline, restored
  from the Trash) is Waiting at once: it is known it will be copied.
- **Failed** when that document's last upload failed on its own (not a network,
  rate-limit or sign-in failure, which stop the whole pass and show in Cloud
  Sync). It is retried every pass and clears when one succeeds; the failures
  are kept in memory, so after a reload the document shows Waiting until the
  first pass fails it again.
- **Known from our own server first.** On arrival the engine reads
  `drive_items` before any call to Google, so the marks appear at once. They
  stay while syncing is paused (reconnect or resume): which documents are up
  to date is still known.
- **Nothing** before it is known whether Drive is connected, once it is not, or
  on a row whose document has a folder notice (that marker instead).
- Changes made in Drive while the user was away show after the catch-up check;
  until then the mark says what livediagram last uploaded.

## Open with

- The live app serves `/drive/open`, the Drive UI integration's Open URL.
  Google passes `state={"ids":[...],"action":"open",...}`.
- The browser reads the file's `appProperties`:
  - **The user can open the document** in livediagram, and the file is the one
    the mirror records for it (or the mirror records none): go to it.
  - **A copy of a mirrored document** (the mirror records a different file for
    that `ldDocumentId`): offer **Import as new document**
    ([Copies made in Drive](#copies-made-in-drive)), never the original.
  - **They cannot** (someone shared the Drive file with them): offer
    **Import a copy**, which creates a new document in My documents from the
    file's contents.
  - **The file is from another deployment** (`ldOrigin` differs) or has no
    `ldDocumentId`: offer **Import a copy** only.
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
  `ldDocumentId` where it can.
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
  `md5`, `head_revision_id`, plus `mirrored_saved_at` (the document revision
  last uploaded). Unique on `(owner_id, item_kind, ld_id)` and on
  `(owner_id, drive_file_id)`.
- Deleting a document, folder or account deletes its rows in the same batch as
  the rest of the removal.
- `refresh_token_enc` is empty for a browser-only connection (client id only).
- `drive_items` also keeps `ld_name` (the livediagram name the Drive name
  mirrors, since Drive may store a name differently), and `notice` with
  `notice_parent_id` for the [unseen-folder notice](#folders-livediagram-cannot-see).
- **Finishing a removal in Drive.** Because a purge or a folder deletion takes
  the row with it, each browser remembers the rows it last saw. A row that
  disappears while its document or folder is gone from livediagram is finished
  in Drive by the next pass in any browser that saw it: a binned file is
  deleted for good, anything else goes to the bin (a document taken offline,
  a deleted folder once its contents have moved up). A file nobody saw go is
  left to Drive's own 30-day bin.

## Errors and edge cases

- **Offline or Google unreachable:** the sync pauses and resumes on the next
  arrival or focus; the Cloud Sync row shows **Last synced** honestly.
- **A mirrored file or folder deleted outside livediagram's knowledge**
  (`404` on write): the item is re-created in its expected place.
- **Document JSON over 5 MB:** uploaded with a resumable upload instead of
  multipart.
- **Quota or rate errors:** back-off as above; a persistent failure shows in
  the Cloud Sync row, never silently.
- **Two devices at once:** the D1 lease decides which one writes; the other
  still reads changes.
- Every decision point logs a fingerprinted line in the browser console
  (`[drive-mirror]`) and every api route logs its outcome (`drive:`), so a
  failure is traceable from either side. The console lines are trace lines
  ([Console logging](../003-system-architecture/console-logging.md)): shown in
  development, and in production only with the debug flag set
  (`localStorage['livediagram:debug'] = 'drive-mirror'`); its warnings always.

## Self-hosting

- Env on the api worker: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `DRIVE_TOKEN_KEY`; the live app reads the client id as
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and the Google Picker's browser key as
  `NEXT_PUBLIC_GOOGLE_API_KEY`. Documented in each `.env.example`. The api's
  `GOOGLE_CLIENT_ID` switches the feature on at all; without it every Drive
  route answers `503 drive_not_configured`.
- **All three unset:** no Cloud Sync section in Settings.
- **Client id only (no secret):** browser-only tokens via the Google Identity
  Services token model. Google cannot renew those without a click, so when a
  token lapses the Cloud Sync row shows **Resume sync** instead of syncing silently.
- A mirror is per Google project: files created by one deployment are foreign
  to another (`ldOrigin`), and are imported as copies.
- `GOOGLE_OAUTH_BASE_URL` on the api worker points the token exchange and
  revoke at another origin. It exists for the test suite's fake Google and is
  never set by a real deployment.

## Hosted deployment: one Google project per environment

livediagram.app runs **two Google Cloud projects**, one for production and one
for staging, so each environment has its own OAuth client id, client secret,
Picker key and Drive UI integration:

- A project has exactly one Drive UI integration **Open URL**, so with one
  project "Open with" could never be tried on staging once production claimed
  it.
- `drive.file` access is per project: a file one project created is foreign to
  the other, so staging's test files never mix with real users' mirrors.
- Consent screens and test users stay apart.

Within an environment the api worker and the live build always carry the
**same** client id: both come from that environment's entry in the hosted
profile, and every deploy proves it (the worker's live vars, and the built
live app, checked against the entry). While an entry is empty the Drive mirror
is off in that environment (no Drive entry, every route `503`). Each
environment's Picker key is its own secret: `NEXT_PUBLIC_GOOGLE_API_KEY` for
production, `NEXT_PUBLIC_GOOGLE_API_KEY_STAGING` for staging; the client secret
and `DRIVE_TOKEN_KEY` were already per environment.

What the operator configured (changed only by the operator):

| Setting                                                  | Production                                               | Staging                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| JavaScript origins                                       | `https://livediagram.app`, `https://www.livediagram.app` | `https://staging.livediagram.app`, `http://localhost:3000`, `http://localhost:3002` |
| Redirect URIs                                            | each origin + `/drive/connected`                         | each origin + `/drive/connected`                                                    |
| Drive UI Open URL                                        | `https://livediagram.app/drive/open`                     | `https://staging.livediagram.app/drive/open`                                        |
| Default MIME type                                        | `application/vnd.livediagram+json`                       | the same                                                                            |
| Default extension                                        | `livediagram`                                            | the same                                                                            |
| Scopes                                                   | `drive.file`, `drive.install`                            | the same                                                                            |
| Automatic consent                                        | off                                                      | off                                                                                 |
| Creating files, importing, multiple files, shared drives | off                                                      | off                                                                                 |
| Mobile browser support                                   | on                                                       | on                                                                                  |

`livediagram.app` answers with a permanent redirect to `www.livediagram.app`,
keeping path and query, before the app runs. So the app, and with it the
consent flow, always runs on `www`: it sends
`https://www.livediagram.app/drive/connected` as the redirect URI (registered,
and accepted by the api's redirect check, which takes any `https` origin at
`/drive/connected`), and Drive's Open URL on the apex arrives at
`https://www.livediagram.app/drive/open` with its `state` intact.

## Costs

Near zero on our side; the traffic is browser to Google. See the
[cost model](../../research/migration-readiness.md#cost-model): about $0 at 50
and 10,000 users, about $18.50 a month at 10 million. No Durable Object is
used. Google's Drive API is free within its quotas.

**Google's daily threshold** (400M units per project per day) at 10 million
users, by the research assumptions (200,000 active connected users a day):

| Cadence                                          | Share of 400M units/day | Depends on E-A3 |
| ------------------------------------------------ | ----------------------- | --------------- |
| The research's proposal (20-minute poll)         | about 80%               | no              |
| A plain 2-minute `changes.list`                  | about 330%              | no              |
| 2 minutes, gated on `getStartPageToken` (chosen) | about 95%               | **yes**         |

The gated figure holds only if the start token moves just for changes
livediagram can see (research E-A3, **unverified**). If it also moves for the
rest of the user's Drive, a busy Drive makes most checks list anyway and the
cost drifts back towards the plain 2-minute figure. The diagnostic under
[Cadence](#cadence) settles it; until then 95% is the planning figure, and
past the threshold Google has announced charges, not a hard stop. Push
notifications, which would remove polling Google altogether, are a separate
follow-up ([Prototype scope](../005-project-roadmap/prototype-scope.md)).

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
with (`Opened`, by outcome: `Opened`, `ImportOffered`, `Error`). `Linked` fires when a
connection completes, not where it started, so moving Connect into Settings
leaves the pair as it is.

## Non-goals

- Drive as a place a document lives.
- Mirroring team libraries.
- Importing content edits made to a file in Drive.
- Server-side polling or Drive push notifications.
- A Google Workspace Marketplace listing (possible later, as a discovery channel).

## References

[Save Locations](../006-document/save-locations.md),
[Trash](../013-workspace/trash.md),
[Folders](../013-workspace/folders.md),
[Auth + guest access](../014-identity/auth-and-guest-access.md),
[Migration readiness](../../research/migration-readiness.md).
