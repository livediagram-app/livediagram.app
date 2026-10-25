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
collaboration, sharing and the Explorer are untouched by it. It replaces livediagram's own browser-run mirror
(livediagram/docs/specs/022-drive-mirror), whose rules it keeps except where this page says otherwise.

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

One Google Cloud project per environment, each with an OAuth client, a client secret, a Picker key and a Drive UI
integration. They are livediagram's two projects, carried over and renamed liveworkspace, so the client ids stay
`1067879369165-6o7bsl1nlrv14mqq4q0sc41immecd4u2.apps.googleusercontent.com` (production) and
`1086769580516-elcn86mcfr16vcp1oov4gnn3s32sb7ut.apps.googleusercontent.com` (staging). What the operator sets in each:

| Setting             | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| Consent screen name | liveworkspace                                                                       |
| Scopes              | `drive.file`, `drive.install`                                                       |
| JavaScript origins  | liveworkspace's origin and every app's origins in that environment (for the Picker) |
| Redirect URI        | `<liveworkspace origin>/drive/connected`                                            |
| Drive UI Open URL   | `<liveworkspace origin>/drive/open`                                                 |
| Drive UI MIME types | the four in [The file](#the-file), each with its extension                          |

The origins are the gateway's while liveworkspace.app is on another account (gateway.md):
`https://liveworkspace-gateway.liveworkspace-easing509.workers.dev` and `…-gateway-staging…`. Staging's client also
allows `http://localhost:3000` and each app's local port block.

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
  move, and a file from another environment is recognised as foreign.

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
| Item purged                      | File permanently deleted, if still in the bin                                              |
| Item moved into a team           | File moved to Drive's bin (the item left their own work)                                   |
| Item moved out of a team         | File created (or restored)                                                                 |
| Folder created / renamed / moved | Folder created / renamed / moved                                                           |
| Folder deleted                   | Its contents move to the parent (as the index does), then the empty folder goes to the bin |

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

These rules carry over from livediagram's mirror unchanged:

- **Our own writes are not echoes.** Each mirrored item keeps the last state the service wrote (name, parent,
  trashed, `md5Checksum`, `headRevisionId`); a change is foreign only when one of them differs.
- **Inbound before outbound.** A pass applies Drive's changes before it writes, so a rename made in Drive is not
  overwritten by a stale name.
- **Both sides changed the same thing:** the later change wins, Drive's change `time` against the item's
  `updatedAt` (a folder's own). A change whose value liveworkspace already holds is recorded, not applied.
- **A folder deleted in liveworkspace stays deleted**, even if Drive still reports the create made for it.
- **A permanent delete only purges from the Trash.** `removed` also means "lost access", so a live item whose file
  is removed is not deleted; its file is re-created on the next write.
- **Copies made in Drive, and Open with on a copy:** as livediagram's spec ("Copies made in Drive"), with "Import as
  new canvas" read as **Import as a copy** into the file's app.

## Folders liveworkspace can't see

As livediagram's spec ("Folders livediagram cannot see"), with liveworkspace for livediagram: the item moves to the
root with a notice kept on its row, shown in Cloud Sync and on the item's Explorer row; **Show this folder to
liveworkspace** opens the Google Picker (folder selection) in the browser with a short-lived access token from the
service (`POST /api/drive/picker-token`), and the picked folder is adopted: a matching folder is made in the index,
under its nearest mirrored ancestor, and the item moves into it.

## Cadence

Named constants in `@liveworkspace/drive` (`cadence.ts`):

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
- **Back-off.** On `403 userRateLimitExceeded` or `429`, the person's intervals double (up to 60 minutes), returning
  to normal after an hour without errors.

## Connecting

- **Where:** Settings > Account > **Cloud Sync**, in every app and on liveworkspace.app, from the shared settings
  (`@liveworkspace/settings-ui`). It is a catalogue of cloud providers, Google Drive its first row. It shows only
  where the deployment offers Drive (`GET /api/drive/config` says so) and only to a signed-in person.
- **The row:** as livediagram's spec ("Connecting", the row, statuses, problem lines, layout stability), with
  "documents" read as "your work", "livediagram" as "liveworkspace", and without **Paused** / **Resume** (there is no
  browser-only mode). Its statuses: Checking…, Not connected, Connecting…, Not synced yet, Last synced …, Syncing…,
  Copying 3 of 12…, and, in the warning colour with its glyph, Needs reconnecting, Needs attention, Offline.
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
- **Reconnecting with another Google account:** as livediagram's spec, word for word but for the names, including
  the 30-minute pending switch and the **Switch Google Account?** dialog on `/drive/connected`.

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
included, from `GET /api/drive/marks`: Synced, Waiting, Syncing and Failed, as livediagram's spec ("The Explorer
shows each document's sync"), with **Synced** when the item's `updatedAt` last uploaded is at least its `updatedAt`,
and the unseen-folder mark beside a name with a notice. Nothing shows for someone who isn't connected, and the marks
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

## The service

`liveworkspace/apps/drive` (`liveworkspace-drive`, `-staging`), behind the gateway at `/api/drive`, and on each app's
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

**Talking to the index.** Through its `INDEX` service binding, with its own key, `INDEX_KEY_DRIVE`, which may act as
any person, across every app, on that person's own personal items and folders only. The index keeps a
`drive_mirrored` flag per person, set and cleared by the service on connect and disconnect, and sends the change
signal only for flagged people, so nobody else costs anything.

**Talking to the apps.** Through each app's existing internal door, `<APP_ORIGIN_<APP>>/api/internal/items/…`, with
`DRIVE_KEY_<APP>` (the app's `DRIVE_KEY`):

- `GET /:id/export?format=file` answers the envelope (`Content-Type` the app's MIME type, `ETag` its version), built
  in the item's Durable Object from the same read a copy makes (`exportCopy`). `format=svg` is the existing preview.
- `POST /import` `{ owner, folderId, name, file }` makes a new item from an envelope of that app's kind, registers it
  in the index, and answers `{ id }`. It refuses another app's kind (`400 wrong_kind`) and a file over the app's
  item limits (`413`).

## Limits and cost

- **Google quota:** a pass costs 5 units with nothing new, about 100 more when Drive changed, plus one write per
  changed item; far inside Drive's per-user limits at the cadence above.
- **Worker limits:** a pass is bounded by `DRIVE_PASS_MAX_WRITES`, each write a handful of subrequests (export,
  thumbnail, upload), well under the paid plan's per-invocation subrequest limit. A file over 5 MB uses a resumable
  upload.
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

livediagram's mirror ran only in hosted livediagram, browser-only, and is off (its spec says why). Nothing is
carried over: there are no server rows to move, and its files (`ldDocumentId`, root `livediagram`) are left where
they are. A person who used it connects again and gets a fresh `liveworkspace` root. livediagram's Drive code,
routes, tables and settings row are removed once this ships.
