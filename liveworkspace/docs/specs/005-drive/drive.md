# Google Drive mirror

A signed-in person can keep a copy of their work, from every app, in their own Google Drive. Each item becomes a
file in a folder tree that matches their liveworkspace folders, and liveworkspace keeps the two in step: content goes
one way, from liveworkspace to Drive; names, folders and the bin go both ways. It runs on liveworkspace's servers, so
it keeps up whether or not a tab is open, and every app gets it without a line of sync code of its own.

```
packages/drive               @liveworkspace/drive: wire shapes, constants, the file formats, the Drive REST and OAuth
                             clients, the planners, and the browser client the UI uses
packages/fake-google         @liveworkspace/fake-google: an in-memory Google (OAuth + Drive), for tests only
liveworkspace/apps/drive     the service Worker (@liveworkspace/drive-service) and its per-person Durable Object
```

The mirror is a **copy**, never an item's home. The apps and the index stay the source of truth, so realtime
collaboration, sharing and the Explorer are untouched by it. It replaced livediagram's own browser-run mirror,
which is gone ([Coming from livediagram's mirror](#coming-from-livediagrams-mirror)); this page is the whole spec.

## Who and what

- **Signed-in people only.** A guest has no lasting identity to attach a Google account to. Every route verifies an
  account access token; a guest token is refused (`401 sign_in_required`), and so is an API token, since a token
  that could mint Google access would outlive the person's attention to it.
- **Their own work, in every app.** Everything the person owns outside a team, in livediagram, liveplanner,
  livedocuments and livedesign: the index's personal items and the person's whole folder tree, which already holds
  items from any app. Team items, items shared with them, and anything only in a browser (This Browser, Offline) are
  not mirrored.
- **Everyone, free.** A deployment without a Google client (below) has no Cloud Sync section: absent, not broken.

## Principles

1. **The server does the work.** A Durable Object per connected person reads Drive's change feed, writes files and
   applies changes. Nothing runs in the browser but the settings row and the Explorer's marks.
2. **It reacts to change, it doesn't poll blindly.** liveworkspace's index tells the service when a connected
   person's item or folder changes; Google tells it when their Drive changes. A slow fallback check covers a missed
   signal.
3. **Content flows one way, structure both ways.** liveworkspace writes a file's contents; Drive never writes them
   back. Names, folders and the bin travel both ways.
4. **Narrow access.** It asks only for `drive.file` (files it created, or the person opened with it) and
   `drive.install` ("Open with"). It never sees the rest of the person's Drive.
5. **Apps keep thin doors.** An app answers two calls about its own items, export the file and import a file, and
   nothing else.

## Google

One Google Cloud project, `liveworkspace`, published (In production) as an External app, with one web OAuth client
for every environment: `75973480147-lpppg0shfk6tju1qn0mrg1o62a16siin.apps.googleusercontent.com`. Its secret is
GOOGLE_CLIENT_SECRET on the drive and accounts Workers (both environments) and in their `.dev.vars`; the client id
is a var on drive (wrangler.toml) and a secret on accounts. What the operator sets:

| Setting             | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Branding            | name liveworkspace; home, privacy and terms on liveworkspace's origin; contact support@…       |
| Scopes              | `openid`, `email`, `profile` (sign-in); `drive.file`, `drive.install` (the mirror)             |
| JavaScript origins  | liveworkspace's origin in each environment, `liveworkspace.app` and `www.`, and localhost:3000 |
| Redirect URIs       | `<liveworkspace origin>/drive/connected` and `<origin>/api/auth/callback/google` for each      |
|                     | origin, plus each app's `/api/workspace/auth/callback/google` (sign-in on the app's address)   |
| Drive UI Open URL   | `<liveworkspace origin>/drive/open` (production's)                                             |
| Drive UI MIME types | the four in [The file](#the-file), each with its extension                                     |

The origins are `https://www.liveworkspace.app`, `https://liveworkspace.app` (for the move to www.) and `https://staging.liveworkspace.app`, and each app's own domain. The Picker's origins (every app's) and its API key come with Show folder.

## The file

| App           | Extension        | MIME type                            | Contents (each app's envelope)                    |
| ------------- | ---------------- | ------------------------------------ | ------------------------------------------------- |
| livediagram   | `.livediagram`   | `application/vnd.livediagram+json`   | `livediagram.document` (`document-envelope.ts`)   |
| liveplanner   | `.liveplanner`   | `application/vnd.liveplanner+json`   | `liveplanner.project` (`project-envelope.ts`)     |
| livedocuments | `.livedocuments` | `application/vnd.livedocuments+json` | `livedocuments.document` (`document-envelope.ts`) |
| livedesign    | `.livedesign`    | `application/vnd.livedesign+json`    | `livedesign.design` (`design-envelope.ts`)        |

- **Name:** the item's name plus its extension. A name Drive would alter is stored as Drive holds it, and the next
  inbound rename is compared against that stored form.
- **Contents:** the app's whole-item envelope, `{ kind, schemaVersion, exportedAt, <item> }`, exactly what its CLI
  exports. Images stay references to the media service; the file embeds no image bytes.
- **Thumbnail:** a PNG of the item's preview (its first tab), 440 px on the long side, drawn by the service from the
  app's `svg` export with `@liveworkspace/render-png`, sent as `contentHints.thumbnail`. An item with nothing to
  draw has none.
- **`appProperties`:** `lwItemId`, `lwApp`, `lwOrigin` (the liveworkspace origin of the environment) on a file;
  `lwFolderId` and `lwOrigin` on a folder; `lwRoot` on the root. A file maps back to its item after any rename or
  move, and a file from another environment is recognised as foreign. So is a file the person doesn't own
  (`ownedByMe` false): tags are only app properties, which anyone holding a token for this client can set on a file
  of their own and share, so a tagged file shared with the person and opened with liveworkspace is never taken for
  their root, one of their folders or an item's file. Rows already recorded keep their file whoever owns it.

## Folders

- **The root folder** is the root of the person's work: items without a folder sit directly in it. It is named
  `liveworkspace` in production, `liveworkspace (staging)` in staging and `liveworkspace (development)` locally,
  given only when the root is created. It may be renamed or moved anywhere in Drive; it is tracked by id, and its
  `lwRoot` lets a reconnect find it again rather than make a second one.
- Every folder in the person's tree is a Drive folder at the same place. The tree is the index's, shared by every
  app, so a folder holding a Plan and a Canvas holds both files.
- **Folders made in Drive** are invisible under `drive.file` until the person shows them to liveworkspace
  ([Folders liveworkspace can't see](#folders-liveworkspace-cant-see)).

## Outbound: liveworkspace to Drive

| In liveworkspace                 | In Drive                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Item created                     | File created in its folder                                                                 |
| Item edited                      | File contents and thumbnail rewritten, at the [cadence](#cadence)                          |
| Item renamed                     | File renamed                                                                               |
| Item moved to another folder     | File moved                                                                                 |
| Item moved to the Trash          | File moved to Drive's bin                                                                  |
| Item restored from the Trash     | File restored from the bin (re-created if it is gone)                                      |
| Item purged                      | File stays in Drive's bin, which empties it after 30 days (see below)                      |
| Item moved into a team           | File moved to Drive's bin (the item left their own work)                                   |
| Item moved out of a team         | File created (or restored)                                                                 |
| Folder created / renamed / moved | Folder created / renamed / moved                                                           |
| Folder deleted                   | Its contents move to the parent (as the index does), then the empty folder goes to the bin |

The service never deletes a file outright. The index answers a purged item and one moved into a team alike (gone
from the person's own work), so both go to Drive's bin, where a way back (out of the team) restores the file and
Drive empties the rest after 30 days; the row is forgotten when Drive reports the file removed.

## Inbound: Drive to liveworkspace

The service reads `changes.list` from the stored page token and applies each change whose file it recognises (by
`lwItemId` or a recorded folder id), through the index acting as the person, so authorisation, the Timeline, the
Explorer and open rooms behave exactly as if the person had done it in an app:

| In Drive                                                | In liveworkspace                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| File copied (Drive's "Make a copy")                     | Nothing: the copy is invisible under `drive.file`                               |
| File renamed                                            | Item renamed (the extension dropped; an empty name keeps the old one)           |
| File moved to another mirrored folder, or root          | Item moved there                                                                |
| File moved to a folder it can't see, or out of the tree | Item moved to the root, with a notice                                           |
| File moved to the bin                                   | Item moved to the Trash                                                         |
| File restored from the bin                              | Item restored, into the folder its file sits in                                 |
| File permanently deleted                                | Item purged, only if it is in the Trash                                         |
| Folder renamed / moved between mirrored folders         | Folder renamed / moved                                                          |
| Folder moved to the bin                                 | Its items go to the Trash and the folder is removed; restoring it restores both |
| File contents edited                                    | Ignored; the file is rewritten from liveworkspace on the next pass              |

These rules carry over from livediagram's mirror:

- **Our own writes are not echoes.** Each mirrored item keeps the last state the service wrote (name, parent,
  trashed, `md5Checksum`, `headRevisionId`); a change is foreign only when one of them differs.
- **Inbound before outbound.** A pass applies Drive's changes before it writes, so a rename made in Drive is not
  overwritten by a stale name.
- **Both sides changed the same thing:** the later change wins, Drive's change `time` against the item's
  `updatedAt` (a folder's own). A change whose value liveworkspace already holds is recorded, not applied.
- **A folder deleted in liveworkspace stays deleted**, even if Drive still reports the create made for it.
- **A permanent delete only purges from the Trash.** `removed` also means "lost access", so a live item whose file
  is removed is not deleted; its file is re-created on the next write.
- **Copies made in Drive** (Drive's "Make a copy") are invisible under `drive.file` (verified against real Google):
  not a file liveworkspace created, so they never reach `changes.list` and nothing happens when one is made. The way
  in is **Open with** on the copy, or Duplicate inside an app.
- **Open with on a copy.** Opening it grants access to that one file, which carries the **original's** `lwItemId`
  and `lwOrigin`. It is recognised as a copy because the mirror records another file for that item, and it is never
  taken for the original: never opened as it, re-tagged or adopted. It offers **Import as a copy**, which makes a
  new item in the file's app from the **copy's contents**. A copy the person owns is then re-tagged with the new
  item's id and recorded, so it mirrors the new item and no second file is made (one someone else owns is imported
  and left as it is). The new item lands in the folder the copy's Drive folder mirrors: the root when the copy sits
  in the root, and the root with [the notice](#folders-liveworkspace-cant-see) when it sits in a folder
  liveworkspace can't see.
- **A copy's later changes** are ignored (`drive: inbound-foreign-copy`): an inbound change for a file carrying a
  mirrored item's id under another file id is never applied, re-tagged or adopted. Two files claiming one item after
  a reconnect are both left alone, and the next write makes a fresh file for it.

## Folders liveworkspace can't see

Under `drive.file`, a folder the person makes in Drive is invisible to liveworkspace: moving an item's file into it
shows up only as "moved to an unknown folder". The mirror handles this openly, never silently: the item moves to the
root, and a notice, "Moved to a Drive folder liveworkspace can't see.", is kept on its mirror row, so every device
shows it, in Cloud Sync and on the item's Explorer row. It clears when the item is moved again from either side, or
when the folder is adopted; until then the file stays where the person put it in Drive. A folder moved into one is
placed at the top level with the same notice. Folders made in liveworkspace always appear in Drive, so building the
tree from liveworkspace needs no adoption, and widening access to all of Drive (a restricted scope with a yearly
paid security assessment) is deliberately not the answer. **Show this folder to liveworkspace** opens the Google Picker (folder selection) in the browser with a short-lived access token from the
service (`POST /api/drive/picker-token`), and the picked folder is adopted: a matching folder is made in the index,
under its nearest mirrored ancestor, and the item moves into it.

## Cadence

Named constants in `@liveworkspace/drive` (`constants.ts`):

- **Change signals.** The index tells the service after any change to a connected person's personal item or folder
  (created, renamed, moved, trashed, restored, purged, shared into or out of a team, or a content save, which reaches
  the index as the item's summary push). The person's mirror then runs a pass `DRIVE_PASS_DEBOUNCE_MS` (30 s) after
  the last signal, so a burst of edits is one pass.
- **Writes.** An item's content is rewritten at most once every `DRIVE_ITEM_MIN_WRITE_INTERVAL_MS` (5 min); a later
  edit inside the window is written when it ends. Renames, moves and the bin are not throttled.
- **Drive's side.** The service keeps a `changes.watch` channel open for each connected person, so Google posts to
  `/api/drive/push` when their Drive changes, and a pass follows after the same debounce. A channel lasts a week and
  is renewed a day before it ends.
- **Fallback.** A pass runs at least every `DRIVE_FALLBACK_CHECK_MS` (30 min) for a person whose channel is down or
  unconfirmed, and every 6 hours otherwise, so a missed signal is caught. Opening Cloud Sync runs a pass unless one
  finished in the last 30 s.
- **The gate.** Each pass first asks for `changes.getStartPageToken` and reads `changes.list` only when it moved.
- **Batches.** A pass writes at most `DRIVE_PASS_MAX_WRITES` (40) files and continues in the next alarm straight
  away, so a first mirror of thousands of items stays inside a Worker invocation's limits.
- **Drive's side in batches.** A pass applies at most `DRIVE_PASS_MAX_INBOUND` (200) Drive-side changes that have an
  effect (echoes and ignored changes don't count). When it stops short, the page token stays where it was and the
  next alarm, `DRIVE_PASS_CONTINUE_MS` later, reads the same changes again. The ones already applied read as echoes,
  because each recorded its row. Outbound waits until every change is in, so it never writes over one not yet read.
- **Back-off.** On `403 userRateLimitExceeded` or `429`, the person's intervals double (up to 60 minutes), returning
  to normal after an hour without errors.

## Connecting

- **Where:** Settings > Account > **Cloud Sync**, in every app and on liveworkspace.app, from the shared settings
  (`@liveworkspace/settings-ui`). It is a catalogue of cloud providers, Google Drive its first row. It shows only
  where the deployment offers Drive (`GET /api/drive/config` says so) and only to a signed-in person.
- **The row is one row:** the cloud and "Google Drive" on the left; on the right the status and one button:
  **Connect** when not connected (held, still reading Connect, while the status says Connecting…), the neutral grey
  **Disconnect** when connected (reversible; the Drive files stay). Connected, the quoted root folder name under the
  card is a link to that folder in Google Drive, in a new tab, once its id is known. On a narrow screen the status
  and button wrap under the name rather than leave the card. There is no Sync now: syncing is automatic.
- **The status** is plain, small, muted text: Checking…, Not connected, Connecting…, Not synced yet, Last synced …,
  Syncing…, Copying 3 of 12…; when something needs the person it turns to the warning colour **with a small warning
  glyph**, so colour is never the only signal: Needs reconnecting, Needs attention (a folder notice), Offline. There
  is no Paused / Resume (there is no browser-only mode).
- **A second line only for problems,** with what to press: a Connect that could not start ("Couldn't reach Google.
  Check your connection and try again."), a cancel at Google, calmly ("Connection cancelled. Connect whenever you're
  ready."), "Google Drive needs reconnecting. Your files are safe." with **Reconnect**, "Can't reach Google Drive.
  Trying again automatically.", and a folder notice ("<name>: Moved to a Drive folder liveworkspace can't see.", with
  "and n more" for several). The why is in the help article.
- **Nothing moves within a phase** (layout stability, "reserve per phase, not per message"). The phases are **not
  connected** (checking, not connected, connecting, a connect that failed, a cancel), **connected** (synced, syncing,
  the first copy, offline, folder notices) and **needs attention** (reconnect). Within a phase the row keeps its
  shape: the status holds that phase's wordings at their widest realistic value, and the button its phase's labels.
  The problem line appears only while there is a problem, below the row, moving nothing in it; a change of phase that
  follows the person's own action may change the card's height. Counts and times use tabular numerals.
- **Where the status lives:** only in Cloud Sync. The avatar carries no sync mark.
- **Below the card:** not connected, "Your work from every app, copied to your Google Drive in matching folders.
  Renames, moves and deletions sync both ways. liveworkspace only sees files it created."; connected, "Your work is
  synced to “<root folder name>” in Google Drive."
- **The flow.** Connect sends the browser to `<liveworkspace>/drive/connect?return=<the page it came from>` (a page of
  liveworkspace.app's site), which asks the service for a signed `state` and goes to Google (authorisation code,
  redirect mode, `prompt=consent`, offline access). Google returns to `<liveworkspace>/drive/connected`, which posts
  the code and state to the service and sends the browser back to `return` with Settings open on Account > Cloud
  Sync. `return` must be a page of liveworkspace or of an app in this environment (`appOfOrigin`); anything else
  returns to liveworkspace.app's Explorer. A cancel at Google comes back the same way, calmly.
- **State** is signed with `DRIVE_TOKEN_KEY`, binding the person, the redirect URI, the return page and a 10-minute
  expiry.
- **First mirror:** the service makes the root (or finds the one carrying `lwRoot`), the folder tree, then every item,
  oldest first, in batches, with progress in the row.
- **Reconnecting with another Google account.** Every consent asks Drive which account it belongs to
  (`about.user.permissionId`; `about` answers under `drive.file`) and records it on the connection. A consent from the
  same account keeps everything. One from a **different** account changes nothing yet, since the root, the page token
  and every mirrored item belong to the first account's Drive:
  - The connect stores the new account's sealed token and id as a **pending switch** beside the live connection,
    which keeps syncing the first account meanwhile.
  - `/drive/connected` then asks, in a dialog titled **Switch Google Account?**: "This Google account is not the one
    liveworkspace syncs with. Switching moves Cloud Sync to the new account and starts a fresh copy of your work in
    its Drive. The files already in the other account's Drive stay there untouched." Buttons **Keep Current
    Account** and **Switch Account**.
  - **Switch Account** replaces the token and account in one step, clears the root, the page token and every mirror
    row, and the next pass starts a fresh mirror, as after a disconnect; the first account's grant is revoked (best
    effort) and its files stay. **Keep Current Account** drops the pending switch and revokes its grant (best
    effort).
  - A pending switch lasts **30 minutes**. Confirming one that has expired (or was never made) answers
    `409 drive_account_switch_expired` and changes nothing. A newer consent replaces a pending switch.
  - A new account that sent no refresh token answers `502 drive_no_refresh_token`; one Drive cannot name answers
    `502 drive_exchange_failed`. Neither stores anything.
  - **Share roles:** an account-level setting of the signed-in owner, reached only from their own Cloud Sync; no
    shared item reaches it.

## Tokens

- The refresh token is sealed with AES-GCM under `DRIVE_TOKEN_KEY` (the person's id as associated data) and stored
  in the person's object. It never leaves the service.
- The service mints access tokens for its own calls, refreshing a minute before expiry.
- `POST /api/drive/picker-token` gives the browser a one-hour access token for the Picker, and nothing else does;
  10 a minute per person.
- **Revoked or expired grant** (`invalid_grant`): the connection turns **Needs reconnecting**; Cloud Sync offers
  **Reconnect**, and the Explorer shows a quiet banner. Nothing is deleted.

## The Explorer shows each item's sync

The shared Explorer (`@liveworkspace/explorer`) draws the cloud mark on every Explorer, liveworkspace.app's
included, from `GET /api/drive/marks`: a small cloud at the right of an item's Updated time
(on the same centre line as the visibility badge and the time), and the unseen-folder mark beside a name with a
notice, instead of the cloud. The cloud is a vendored Lucide glyph at a 1px stroke in the quiet metadata colour; only
its symbol takes a colour, and it is named on hover and focus:

| State   | Glyph                                           | Symbol colour | Name                                                       |
| ------- | ----------------------------------------------- | ------------- | ---------------------------------------------------------- |
| Synced  | `cloud-check`                                   | green         | Synced to Google Drive                                     |
| Waiting | `cloud-upload`                                  | blue          | Waiting to sync to Google Drive                            |
| Syncing | `cloud-sync`, pulsing (not with reduced motion) | blue          | Syncing to Google Drive…                                   |
| Failed  | `cloud-alert`                                   | amber         | Couldn't sync to Google Drive. Trying again automatically. |

**Synced** when the item's `updatedAt` last uploaded is at least its `updatedAt`; **Waiting** otherwise, or
**Syncing** while a pass runs; **Failed** when that item's last upload failed on its own (not a network, rate-limit
or sign-in failure, which stop the pass and show in Cloud Sync), cleared by the next success. Nothing shows for someone who isn't connected, and the marks
request isn't made for them (the config answer says whether they are).

## Open with

`<liveworkspace>/drive/open` is the Drive UI integration's Open URL for every app's files. The page asks the service
about the file (`POST /api/drive/open` `{ fileId }`), which reads its `appProperties` and answers one of:

- **open** the item in its app (the person can open it, and the mirror records this file for it, or records none);
- **import**: a copy of a mirrored item, a file someone shared with them, or one from another environment, offered
  as **Import as a copy**, which the service does through the app's import door and then opens the new item;
- **not ours**: not a liveworkspace file, or unreadable, with a clear error page.

A signed-out visitor signs in first; someone with no usable Drive access is offered **Allow access**, which connects
and comes back to the same file.

## Disconnecting and account deletion

- **Disconnect** revokes the grant (and a pending switch's), deletes the token and every mirror row, closes the push
  channel, and leaves every Drive file in place.
- **Account deletion** does the same (accounts calls `DELETE /app/people/<id>` on the service).

## The UI

What the browser draws, beyond what the sections above pin (`@liveworkspace/settings-ui` `cloud-sync/`,
`@liveworkspace/explorer` `drive/`, the site's `app/drive/*`; the browser client is `@liveworkspace/drive/client`).

- **One client.** `createDriveClient({ getToken })` calls this origin's `/api/drive` (liveworkspace.app's route,
  the router's proxy on an app's address) with the person's account token, and answers every call as a result, never
  a throw. A host makes one only for an account: a guest's page asks nothing.
- **The section appears** once `GET /api/drive/config` (asked each time Settings opens) says `enabled`. It sits in the
  Profile, after Sign-in Methods and before Your Account. Opening it, someone connected asks for a pass
  (`POST /check`) and reads `GET /connection`, and again once the pass is asked for; while a pass or a first copy runs
  (or the first pass of a connection just made hasn't reported) the row reads the connection every 5 s
  (`DRIVE_ROW_REFRESH_MS`), and only while it is open. A failing pass is the service's to retry: the row stops.
- **The way back.** Connect first rewrites this page's own history entry to name Settings on Cloud Sync
  (`?settings=<host's Profile>&section=cloud-sync`: `profile` on liveworkspace.app's Explorer, `account:account` in an
  editor), then goes to `<liveworkspace>/drive/connect?return=<that page>`. `/drive/connect` keeps the return page in
  the tab's `sessionStorage` against the state it was issued, so a cancel at Google (state, no code) still returns
  there. `/drive/connected` sends the browser back with `drive=connected` or `drive=cancelled` added; the row reads it
  once (Connecting… until the connection shows, or the calm cancel line) and takes it out of the address.
  `/drive/connect` refuses a return page that isn't liveworkspace's or an app's in this environment, or is one of the
  connect pages, and uses liveworkspace.app's Explorer on Cloud Sync instead; Open with's `/drive/open` is allowed,
  so Allow access comes back to the same file.
- **Disconnect** asks first, neutrally: "Disconnect Google Drive?", "Your work stops syncing to Google Drive. The files
  already there stay where they are, and you can connect again any time.", **Disconnect** / **Cancel** (the shared
  ConfirmDialog).
- **Switch Google Account?** treats a `409`, `410` or `404` (or `invalid_state`) from `/account-switch` as the 30
  minutes having passed: the dialog says the request timed out, with **Back to Cloud Sync**. Keep Current Account on
  a switch already gone simply returns.
- **Show folder** (the Picker) is not in the shared row: Google's Picker loads `apis.google.com`, which no page's
  CSP or Trusted Types policy allows. The notice line says what happened, and moving
  the item again, from either side, clears it.
- **The Explorer's marks** come from the service's answer alone (it names only the person's mirrored items), so an
  item made since the last read shows nothing until the next. Config first; marks and the connection (for the banner)
  only for someone connected; read once per Explorer mount and on window focus at most every 30 s
  (`DRIVE_MARKS_MIN_GAP_MS`); no polling. The banner ("Google Drive sync is paused.", **Reconnect**) sits bottom-left
  and closes for the tab's session. The page Explorer and the editors' Explorer panel both take the host
  (`drive`); the site's Explorer passes it, and so does every editor's panel, for an account holder only (it draws
  only the name's mark).

## The service

`liveworkspace/apps/drive` (`liveworkspace-drive`, `-staging`), on liveworkspace.app's `/api/drive` route, and on each app's
own address through its router's workspace proxy (`/api/drive`, cookies dropped). The browser authenticates with an
account access token, verified offline against accounts' keys (issuer `<accounts>/api/auth`, any app API audience),
exactly as the index does.

| Route                                       | For                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/drive/config`                     | `{ enabled, connected }`, cheap: what the UI shows                          |
| `GET /api/drive/connection`                 | the connection summary and status for Cloud Sync                            |
| `POST /api/drive/state`                     | a signed consent `state` for a return page                                  |
| `POST /api/drive/connect`                   | `{ code, state }`: exchange and store; a pending switch for another account |
| `POST` / `DELETE /api/drive/account-switch` | confirm / cancel a pending switch                                           |
| `DELETE /api/drive/connection`              | disconnect                                                                  |
| `POST /api/drive/check`                     | run a pass now (Cloud Sync open), at most every 30 s                        |
| `GET /api/drive/marks`                      | each mirrored item's mark and notices                                       |
| `POST /api/drive/picker-token`              | an access token for the Picker                                              |
| `POST /api/drive/adopt`                     | `{ folderId, itemId? }`: adopt a picked folder                              |
| `POST /api/drive/open`                      | `{ fileId }`: what Open with should do                                      |
| `POST /api/drive/import`                    | `{ fileId }`: import a copy, answering the new item's address               |
| `POST /api/drive/push`                      | Google's change notifications (channel token checked, no person token)      |
| `POST /app/changes`                         | the index's change signal (`DRIVE_KEY_INDEX`)                               |
| `DELETE /app/people/<id>`                   | accounts' account deletion (`DRIVE_KEY_ACCOUNTS`)                           |

**State.** One SQLite Durable Object per connected person (`DriveMirror`, by account id), holding
`drive_connection` (one row: sealed refresh token, root id, page token, status, Google account id, pending switch,
push channel id and expiry, back-off) and `drive_items` (`kind` `item` | `folder`, `app` for an item, the
liveworkspace id, the Drive file id, the last written name / parent / trashed / md5 / head revision, the `updatedAt`
last uploaded, the liveworkspace name it mirrors, the notice). Its alarm runs passes. A D1-free service: the index's
`drive_mirrored` flag (below) is the only cross-person record.

**As built** (where the service settles what the above leaves open):

- A guest, an API token or no token answers `401 unauthorised` (the wire's code). `config` answers a guest
  `connected: false`.
- `config` reads the index's flag (`GET /app/people/:id/drive`) and asks the person's object only when the index
  can't answer, so a page view never wakes an object.
- `POST /api/drive/account-switch` with nothing pending, or one past its deadline, answers `404 not_found`.
  `DELETE /app/people/<id>` for someone who never connected answers `404`, which accounts takes as done.
- `/api/drive/push` always answers `200`, even for a channel token it didn't make (logged), so Google never backs
  off the address. A `sync` notification is ignored.
- The push channel opens on connect, from the page token taken then. A failed flag write on connect is logged, and
  the fallback check covers it.
- Check now sets the next pass to write every changed item regardless of the per-item interval.
- An import lands in the person's root (`folderId: null`). An import door that refuses the envelope answers
  `400 invalid_request`, and one that finds it too big `413 file_too_large`. Any other door failure answers
  `502 google_failed`.
- An import downloads at most 32 MiB (`DRIVE_IMPORT_MAX_BYTES`, the apps' import door's own cap, index-app
  `IMPORT_MAX_BYTES`): a larger file is `413 file_too_large`, refused by its declared length or, without one, as soon
  as the bytes read pass the cap, so the service never holds more than that. /drive/open says the file is bigger than
  32 MB, the most an import can take.
- Open and import answer `502 google_failed` for any failure they have no named answer for: Google erroring once the
  client stops retrying, Google's token endpoint down, the index erroring, or a door timing out. Never a bare 500.
  The person's own mirror out of reach is no upstream's failure: any route answers it `503 storage_unavailable`
  ([When a request fails](../002-architecture/architecture.md#when-a-request-fails)).
- Marks cover the mirrored rows and failed writes. An item not yet mirrored carries no mark until its first pass.
- The Durable Object's RPC for consent is `connectGoogle` (`connect` is the runtime's own name).
- Locally the service runs on port 3011 (`corepack pnpm dev:drive`). The site's dev server and each router's
  `DRIVE_ORIGIN` forward `/api/drive` there.

## Contracts

### The index

The service reaches the index through its `INDEX` service binding.

- **Acting as the person.** The index's ordinary person routes (`/api/index/…`, the same ones `@liveworkspace/index-client`
  calls), with `Authorization: Bearer <INDEX_KEY_DRIVE>`, `X-Index-App: drive` and `X-Index-Person: <account id>`.
  The index takes this as the person (`delegatedPersonOf`), with two differences from an app's delegate: lists are
  not forced to one app (an `app` filter, if given, still applies), and only the person's **personal** items are
  reachable, never a team's or one shared with them, by read or write (a team item answers `404`). Folders are the
  person's own tree, as for any caller. `X-Index-Teams` is ignored for this key. A guest id is refused (`403`).
- **The flag.** `PUT /app/people/:id/drive` and `DELETE /app/people/:id/drive` (same key) set and clear the person's
  `drive_mirrored` flag (`204`); `GET` answers `{ mirrored }`. Purging a person clears it.
- **The change signal.** After any write that changes a flagged person's personal item or folder, the index calls
  its `DRIVE` service binding, after the response (`waitUntil`):
  `POST /app/changes` `{ personId, at }` with `Authorization: Bearer <DRIVE_KEY_INDEX>`. One call per person per
  write request, whatever it changed: an item made, renamed, moved (between folders, or into or out of a team),
  trashed, restored, copied or purged; a folder made, renamed, moved or deleted; a summary push that raised an
  item's `updatedAt`. The signal names no item; a pass reads the whole picture. A failed call is logged
  (`index: drive-signal failed`) and dropped: the fallback check catches up. Without the binding nothing is sent.

### The apps

Each app's internal door (`@liveworkspace/index-app` `handleInternalItems`), at
`<APP_ORIGIN_<APP>>/api/internal/items/…`, accepts `Authorization: Bearer <DRIVE_KEY>` (the app's `DRIVE_KEY`
secret, the service's `DRIVE_KEY_<APP>`) on exactly these two routes, alongside the keys each already takes:

- **Export the file.** `GET /:id/export?format=file`, `If-None-Match` optional. The handler's `export(itemId, query)`
  gets `format: 'file'` and answers `{ status: 'ok', body, contentType, version }` with `body` the app's whole-item
  envelope as JSON text, `contentType` the app's MIME type ([The file](#the-file)), and `version` the content's last
  save (epoch ms). The envelope's `exportedAt` is that version, so unchanged content is byte-identical. Built in the
  item's Durable Object from the same read a copy makes (`exportCopy`). `304` when unchanged, `404` when gone.
- **Import a file.** `POST /import`, JSON `{ owner, folderId, name, file }`: `owner` an account id, `folderId` a
  folder of theirs or null, `name` the new item's name, `file` the envelope text. The handler `import(input)` makes
  a new item for `owner` from it, with fresh ids throughout (tab ids and links remapped as a copy remaps them),
  registers it in the index as `owner`'s personal item in `folderId`, and answers `201 { id }`. It refuses an
  envelope of another kind or that doesn't parse (`400 invalid_file`) and one past the app's item limits
  (`413 too_large`).

`@liveworkspace/drive` holds the four kinds, MIME types and extensions (`APP_FILE_FORMATS`), so the service and every
app name them from one place.

## Limits and cost

- **Google quota:** a pass costs 5 units with nothing new, about 100 more when Drive changed, plus one write per
  changed item; far inside Drive's per-user limits at the cadence above.
- **Worker limits:** every request a pass makes (Google, the index, the apps' doors) is charged to one meter before
  it is sent, against `DRIVE_PASS_SUBREQUEST_BUDGET` (800, under the paid plan's default of 1,000 per invocation,
  with room for an uncounted token refresh). Each call to the object gets its own meter. Before each change or write
  the pass checks that the usual cost still fits (4 for a change, 6 for a write) and stops cleanly if not. A charge
  past the budget, such as a binned folder with many items, ends the pass as a batch to continue in the next alarm,
  not as a failure. Within that, a pass is also bounded by `DRIVE_PASS_MAX_WRITES` and `DRIVE_PASS_MAX_INBOUND`. A file
  over 5 MB uses a resumable upload.
- **A very large library** (tens of thousands of items) spends much of the budget reading the index's picture, up to
  3 lists × `DRIVE_LIST_PAGES_MAX` pages. At the extreme, the picture alone could take the whole budget and a pass
  would make no progress.
- **Thumbnails** load the 3 MB renderer on first use in an isolate, as the share card does.
- **No one connected costs nothing:** the index sends no signal and no object exists.

## Configuration

- On the service: `GOOGLE_CLIENT_ID` (var), `GOOGLE_CLIENT_SECRET`, `GOOGLE_PICKER_KEY`, `DRIVE_TOKEN_KEY` (base64 of
  32 random bytes), `DRIVE_KEY_<APP>` for each app, `DRIVE_KEY_INDEX`, `DRIVE_KEY_ACCOUNTS`, `INDEX_KEY_DRIVE`.
  Without the client id and secret every route but `config` answers `503 drive_not_configured` and `config` says
  `enabled: false`.
- On each app's api: `DRIVE_KEY`. On the index: `INDEX_KEY_DRIVE` and `DRIVE_KEY_INDEX`. On accounts:
  `DRIVE_KEY_ACCOUNTS`.

## Logs

Every decision point logs a fingerprinted line, `drive:` and the step (`drive: pass person=… in=3 out=5`,
`drive: inbound-foreign-copy`, `drive: token invalid_grant`), and every route its outcome, so a failure is traceable
in `wrangler tail`. Addresses and names are never logged; ids are.

## Coming from livediagram's mirror

livediagram had its own mirror, run in the browser while a tab was open, for livediagram documents only. It was
switched off in both hosted environments before this service shipped (it ran browser-only, with no client secret,
and could tell someone who had never connected that sync was paused), and has since been removed: its code, routes,
settings row, Explorer marks and its PersonStore tables (dropped by a migration). Nothing is carried over: there are
no server rows to move, and its files (tagged `ldDocumentId`, under a root named `livediagram`) are left where they
are in the person's Drive. A person who used it connects here and gets a fresh `liveworkspace` root.
