# Offline Mode

**Offline Mode** lets you create a document that is saved **only in the current
browser** — never to the API, never to the server. It is the default for a guest's
new document ([Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local))
and an opt-in choice for everyone else. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a document that physically never leaves
their machine. It also reinforces the OSS promise ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a document**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ document is
a separate concern — see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) — and out of scope here.)

Tab bodies are stamped with their **tab kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire` — the two stores must agree about what a tab IS, or a Sync Document would hand the cloud a board that has forgotten itself ([Event storming](../021-event-storming/event-storming.md)).

## Turning it on

Offline Mode is **on by default for a guest and off by default for a signed-in person**
([Save Locations → The default depends on who is creating](save-locations.md#the-default-depends-on-who-is-creating)).
Either way it is chosen when creating a document:

- The **New Document** wizard ([Dedicated route for new-document creation](../007-editor/new-document-route.md)) runs two steps: Template, then
  **Location** (the Settings step in code). It carries the **Save location** chooser
  ([Save Locations](save-locations.md)), alongside the document name and where it is saved (a personal
  folder or a team library). **livediagram** = a normal cloud
  document; **Local Browser** = the new document is created offline. The tile
  pre-selected is the default for who is creating.
- The links that create without the wizard (`/new?template=`, `/new?blank=1`,
  [Dedicated route for new-document creation → Start Blank](../007-editor/new-document-route.md#start-blank-skip-the-wizard))
  take the same default, so a guest following a template from the landing page
  gets a Local only document.
- The Local Browser tile is captioned _"This device only"_, and choosing it
  reveals a data-loss warning and removes the folder / team step (there is
  nothing to choose), so the durability trade-off is set at the moment of
  choice.
- The template and theme choices work identically; the location only changes
  _where the document is stored_.

No global "offline mode" switch: the choice is **per document**, so a person can
have cloud documents and offline documents side by side.

## Where offline documents live

- Stored in **IndexedDB** in the browser (roomy + async; `localStorage`'s ~5 MB
  synchronous cap is too small for image-bearing documents). One record per
  document holds its meta + tabs, keyed by the document id.
- The app keeps a small **local index** of offline document ids (also in
  IndexedDB) so the Explorer can list them and the persistence layer knows which
  ids resolve locally vs to the API.
- **Every tab of the browser agrees on the index.** Each tab mirrors it in memory
  (`apps/live/lib/offline/offline-ids.ts`), and every id registered or removed is told
  to the other tabs on the `livediagram-offline` BroadcastChannel (`{ kind: 'add' |
'remove', id }`), which apply it at once. Without it, a tab that missed a Take
  Offline kept saving that document to the server (where it no longer is), and a tab
  that missed a Sync Document or purge kept "saving" into a record that was gone.
- **A write to a record that is gone fails out loud.** When an edit (a tab, the name,
  the order, the folder, the card types) finds its record missing while the tab still
  lists the id, the id is forgotten (and the other tabs told) and the write fails with
  `OfflineDocumentMissingError`, logged `[offline-store] write-to-missing-record`: the
  autosave shows the failure instead of "Saved", and its retry routes to wherever the
  document now is. A missing record whose id the tab has already forgotten (its own
  Sync Document, with a save still queued) stays a quiet no-op.
- **Each read-modify-write is one transaction.** A write reads the whole record and
  writes it back; the two happen in one IndexedDB `readwrite` transaction
  (`OfflineBackend.update`), so another tab's write cannot land between them and be
  overwritten. Writes from the same tab are also queued one after another.

<!-- legacy-names -->

- **Store rename (version 2).** Offline documents were kept in the `diagrams` object store until
  the container became a document ([Document](document.md#renaming-from-diagram)). Opening
  version 2 of `livediagram-offline` moves every record into `documents` inside the upgrade
  transaction, then drops the old store, logging how many moved
  (`apps/live/lib/offline/legacy-offline-store.ts`). A tab still running the code from before the upgrade
  asks for version 1, which the browser refuses once another tab has opened version 2; its offline
  documents are out of reach in that tab until it reloads.
- **Durability honesty (important).** An offline document has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly — at the chooser, on the document (see the badge), and in the
  help article. "Offline" means _yours only_, with the responsibility that
  implies.

<!-- /legacy-names -->

## What's different in an offline document

The document model (`Tab[]` + meta, per [Document structure](document-structure.md)) is **identical** — an offline
document is a normal document whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline document:

| Feature                                                                   | Offline behaviour                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds                                                      | The header **Share** button stays visible, but for an offline document it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Live app](../007-editor/live-app.md), /54). |
| Live presence / realtime                                                  | N/A — a private document never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                    |
| Teams / shared library                                                    | Hidden — a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                               |
| Comments                                                                  | Local-only (just you), stored in the document; no cross-user.                                                                                                                                                                                                                   |
| AI assistance                                                             | Works online — it reads the current canvas, not the stored document ([AI Assistance](../007-editor/ai-assistance.md)); only a lost connection stops it.                                                                                                                         |
| Duplicate                                                                 | Makes **another offline document** — a copy never uploads what the user chose to keep local.                                                                                                                                                                                    |
| Folders                                                                   | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                    |
| Tab linking ([Tab ↔ document many-to-many](tab-document-many-to-many.md)) | Unavailable in either direction — linked tabs are one shared server row.                                                                                                                                                                                                        |
| Thumbnails                                                                | A fixed **offline illustration** in the Explorer — there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                                                                                                                  |
| Images                                                                    | **Embedded locally** — see below.                                                                                                                                                                                                                                               |

**Images embed locally ([Image element + per-owner gallery](../009-elements/images.md)).** In a cloud document, an added image uploads
to R2 and is referenced by URL. In an offline document it can't — so an image is
stored **inline as a `data:` URI** inside the document. Rendering is unchanged
(`<img>` reads a data URI fine). This costs local storage, which is the accepted
trade for staying fully offline. (Conversion re-homes images — see below.)

Autosave still runs for an offline document ([Per-tab storage](per-tab-storage.md)) — it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## Instant open

A Local only document lives in this browser, so opening it waits on nothing the
server says. The editor bootstrap ([Dedicated route for new-document creation → In-place handoff](../007-editor/new-document-route.md#in-place-handoff-to-the-editor),
`app/document/[id]/useIdentityBootstrap.ts`) takes an **early open** when, before
auth has settled, the path names a document registered in the local index
(`isOfflineId`). Share links, embeds and workbenches always wait for auth.

- The early open does **not wait for auth to settle**, mint a guest id or fetch
  the participant. It reads the document from IndexedDB and paints it under the
  `'self'` placeholder participant.
- **Owner-scoped work waits for the real reader.** Under `'self'`, nothing is
  read or written as an owner: the participant record is not saved, preferences
  stay local (`writeUserPreferences`), and the custom themes, shape libraries,
  recent images and Explorer lists load only once the reader is known. Sync
  Document from the Share dialog waits too (the gate's `ready`).
- **The reader resolves in the background** once auth answers, exactly as a
  cloud open resolves it (`resolveParticipant` in
  `app/document/[id]/resolve-participant.ts`: the Clerk id or signed guest id,
  then the participant row), followed by the Explorer lists and the guest naming
  nudge. The document is not reloaded: an offline document is the reader's own
  whoever they turn out to be.
- **`/new` does not wait either.** For a guest ([Who is a guest, before Clerk answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-clerk-answers))
  creating Local only, the create writes to IndexedDB and hands off without
  waiting on auth, the guest id or the participant, which resolve in the
  background (`commitNewDocument` in `app/new/page.tsx`).
- The editor reads back the record `/new` has just written rather than taking
  the tabs across in memory: the read is one IndexedDB get, small beside the
  waits removed, and keeps one load path.

**Measured** against production builds of `main` and of this change, served the
same way with the local api (headless Chromium, 10 runs each, interleaved; a
fresh browser profile per first visit), guest create to first canvas paint:

| Link                   | Before (cloud) first / return | After (Local only) first / return | API requests |
| ---------------------- | ----------------------------- | --------------------------------- | ------------ |
| `/new?template=kanban` | 2,956 / 1,775 ms              | 955 / 819 ms                      | 24 → 1       |
| `/new?blank=1`         | 3,076 / 1,803 ms              | 1,053 / 834 ms                    | 20 → 1       |

The one request left is `GET /api/capabilities`; the guest id, participant and
Explorer lists follow after the paint.

## "Local only" badge + Explorer

- **Editor header badge.** The status pill reads Private / Shared / Team
  (the `SharedBadge` in `EditorHeader`). For an offline document it reads
  **"Local only"** (a state that supersedes "Private" for these documents),
  matching the [Local only pill](#local-only-pill): the same words, the same
  browser-window icon, the same amber tone and contrast, and the same sentence,
  "Lives only in this browser. Clearing this browser's site data deletes it.",
  shown in the badge's visibility legend on hover and focus and given to
  assistive technology as the badge's description. It stays a status, not a
  link: the legend explains it in place.
- **The visibility legend** (`VisibilityLegend`, on the badge's hover and focus): **Who Can See This**, "From
  just you to everyone, as you share it.", then the audiences as a ladder joined by a rail: **Private** (a lock),
  **Shared** (a link), **Team** (people), **Public** (a globe), each a round tile in its tone over its name and
  its sentence; the document's own state tinted in its tone and marked **Current** with a check. **Local only**
  (its browser-window icon, amber) stands apart under a divider, the deliberate opt-out. For the eye only: the
  badge carries the current state's words for assistive technology.
- **Explorer.** Offline documents appear in Recent (and the other lists)
  alongside cloud documents, each with the **Local only** pill (below) and the
  fixed offline thumbnail, so a local-only document is recognisable at a glance.
  The Explorer view merges the API-fetched cloud list with the local index of
  offline documents; offline rows never trigger a server fetch (list, thumbnail,
  or otherwise).
- **The reader's own.** An offline document counts as one of the reader's own
  documents: Space `mine` and owner "You", like a document in My documents
  ([Explorer structure: Local only documents](../013-workspace/explorer-structure.md#local-only-documents)).
- **Sidebar.** The full-page Explorer's **This browser** row (the More group,
  [Explorer structure](../013-workspace/explorer-structure.md)) opens
  `/explorer/offline`, the list of every offline document, titled **This
  browser**; the row shows while this browser holds at least one.
- **Home.** An offline document's opens are counted in its own local record, never
  sent anywhere, so Home's Jump back in places it among the reader's other
  documents by the same rule, with the **Local only** pill on its thumbnail
  ([Explorer Home](../013-workspace/explorer-home.md#opens)).

### Local only pill

Every row and card of an offline document carries a **Local only** pill,
wherever the document is listed: the list and card views (folders, Search results,
This browser, Recent, Favourites), Home's Jump back in, the folder previews' tiles excepted (they
are pictures, not rows), the search panel's results, the editor's Explorer
rows and its Current Document card, and the Trash.

- **Not colour alone.** The pill shows an icon (a browser window) and the words
  "Local only", in an amber tone whose text meets 4.5:1 on its fill in light and
  dark mode; the ring meets 3:1 against the row.
- **What it means, on hover and focus.** Its hover card reads "Local only" over
  "Lives only in this browser. Clearing this browser's site data deletes it."
  The same sentence is the pill's accessible description (`aria-describedby`),
  so a screen reader hears it without hovering.
- **The guide is one click away.** The pill is a link to the Offline Mode help
  article (new tab, the editor's help-link telemetry), with its own focus ring.
  Where the row is itself a single control (a search result, the panel's
  Current Document row), the pill is a plain label inside it, carrying the same
  description: a link cannot sit inside a button. In a tree (the editor's
  Explorer), the pill is a link out of the tab order, since the tree owns
  the one tab stop, and the row itself carries the description. The Trash row's
  pill is a link like any other.
- **It replaces the "Offline" visibility badge** in the Explorer's lists: an
  offline document shows the pill beside its name at every width, and its
  visibility column stays empty. Minimal chrome keeps the words: the pill is a
  warning, not a teaching hint.

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog (below), and after signing in by
the move prompt ([Auth + guest access → Moving Local only documents after signing in](../014-identity/auth-and-guest-access.md#moving-local-only-documents-after-signing-in)).

### Sharing a Local only document

Share is how most people find out a document needs the server. Pressing it never
uploads anything by itself; the dialog explains and asks, for a guest and a
signed-in person alike:

- **The gate.** Share on a Local only document opens the Share dialog on its
  offline gate (`ShareOfflineGate`): **This Document Is Offline**, "It is saved only
  in this browser, so there is nothing to share yet. Sync it to livediagram to
  share it: share links, real-time collaboration and the live image all need it
  on our servers. You can take it offline again any time.", with **Sync Document**
  and Cancel.
- **Sync Document** syncs the open document **in place** (below): the button shows
  **Syncing…** with a spinner, then a toast confirms "Synced. Your document is on
  livediagram now." and the same dialog shows the share options. No reload, no
  second press of Share. A guest's upload is owned by the guest id like any guest
  cloud document.
- The button waits for the reader to be known (an early open runs under the
  `'self'` placeholder, [Instant open](#instant-open)).
- A failed sync keeps the document Local only, says why in a toast
  (`syncFailureMessage`) and leaves the button to try again; nothing is
  half-uploaded (see below).

### Syncing in place

Sync Document from inside the editor (`useSyncInPlace` in
`app/document/[id]/useSyncInPlace.ts`) converts the open document without a
reload:

1. **It waits for this browser's last save** to land (`hasUnsavedChanges`), up to
   `SYNC_SAVE_WAIT_MS` (5 s), so the record it uploads is what is on screen and no
   save lands in a record about to be deleted. Past that it refuses with
   `SyncStillSavingError` ("Still saving this document. Try again in a moment.").
2. **It uploads** with `saveOfflineToCloud`, which returns the images it re-homed
   (data URI → gallery id).
3. **The offline index announces the move** (`subscribeOfflineIds` in
   `lib/offline/offline-store.ts`, told on every create, sync and Take Offline).
   What reads offline-ness follows it: the header badge and every
   `useIsOfflineDocument` (so the Share dialog swaps the gate for its options), the
   Plan board's items (`usePlanItems` loads the server's store and revision) and
   the sheets (`SheetStore.resync`, so confirmed revisions are the server's).
4. **The open tabs' images are re-pointed** at their gallery copies, in the editor
   and in its last-saved copy, so the next save does not write the data URIs back.
5. **The room opens** (`documentServerStored` turns true) and the Explorer list
   refreshes.

The Explorer's row menu and the move prompt after signing in still reload after a
sync: the document there is not the one on screen, or several move at once.

### Save to server (Offline → Cloud)

Action: **"Sync Document"** (one name everywhere: the Explorer row menu, the
Share dialog gate, and the move prompt after signing in).

- Uploads the document's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud document owned by the current identity (signed-in account, or the guest
  `X-Owner-Id` if not signed in — [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Images re-home:** each embedded `data:` URI is uploaded to the gallery
  (SHA-256 dedupe server-side, [Image element + per-owner gallery](../009-elements/images.md)) and the element's reference swaps to
  the returned R2 id, so the cloud copy carries real gallery images instead of
  bloated tab JSON. A failed transfer keeps the data URI (it still renders
  anywhere); the per-tab byte cap surfaces a hard failure to the caller.
- **Everything on the record travels**, not just tabs: the slide deck
  ([Presentation mode](../012-collaboration/presentation-mode.md)), the created date, the folder (kept only when it is one of the
  caller's own personal folders, else the root of My documents) and the star ([Favourite documents](../013-workspace/favourites.md)). The
  local copy is deleted next, so anything the create leaves behind is gone.
- **A refused folder lands at the root, on the sync's say-so.** The create carries the folder as
  its placement ([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)),
  and the server refuses a folder deleted since, or not the caller's, by name rather than
  filing it elsewhere. On `folder_not_found` or `folder_scope_mismatch` the sync creates the
  document again at the root of My documents and logs `[offline-sync] placement refused reason=<code>, filed at root`;
  any other failure fails the sync and keeps the local copy.
- **A forked tab comes back as its own tab.** The create never writes into a tab
  another document holds: a seeded tab whose id is already taken outside this
  document is created under a fresh id, and the document's tab / element links and
  deck slides follow it. So a tab that forked on Take Offline returns as a new
  tab beside the original rather than overwriting it; joining them again is an
  explicit "Add to Document". A retried create (the tab already in this document)
  keeps its ids.
- **What went up is what is removed.** The upload takes seconds and the document
  stays editable meanwhile (here or in another tab). The local copy is removed only if
  it still matches what was uploaded (its save time, card store revision and each
  sheet's revision), checked and deleted in one transaction. If it changed, the cloud
  copy is taken back (a raw delete declared as a move into this browser, so it skips
  the Trash) and the newer record is uploaded again, logged
  `[offline-sync] changed-during-upload attempt=<n>`; after three uploads that each
  went stale the sync stops, keeps the local copy and says the document kept changing.
- **The cloud copy must hold every card and sheet.** A create that resolves to an
  existing row (a retry after a half-finished sync) never re-seeds the card or sheet
  stores, so before the local copy goes the sync reads the cloud copy's cards and
  sheets back and compares their counts with the record's (skipped when the record
  has none). Short, the cloud copy is taken back, the local copy kept, and the sync
  fails, logged `[offline-sync] stores-short`.
- **One conversion per document at a time.** A second Sync Document or Take Offline
  of a document while one runs (a second menu, or the Share gate) does nothing; the
  guard lives with the conversion, not with the menu that started it, which closes.
- On success the **local copy is removed** from IndexedDB so there's one source
  of truth; the document is now a cloud document (Share / AI / Teams reappear). The
  id is unchanged, so the route stays the same: from the Share dialog the editor
  turns into the cloud document in place ([Syncing in place](#syncing-in-place));
  from the Explorer it reloads.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**. This is **destructive on the server** and gated by a
confirmation:

- **Confirmation** warns clearly: _"This removes it from your account and every
  other device. It will exist only in this browser, with no backup."_ When the
  document has shared tabs, the shared-tab notice follows (see below).
- On confirm: download the document's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **Local only**. Referenced R2 images are downloaded and embedded
  as `data:` URIs BEFORE the server copy is deleted (the deletion would make
  them "unused" and the retention reaper would eventually take the bytes); an
  incomplete embed aborts the conversion and the document stays on the server.
- **The deck, star and personal folder come along** for the same reason: the
  server row they live on is about to be deleted. The star is read from the account's
  favourites; if that read fails the conversion aborts before anything is written,
  rather than taking the document as unstarred and losing the star with the row. A team document's folder is a
  team folder, which has no place in the personal tree, so it lands at the root of My documents.
- **Shared tabs fork.** A tab also linked into other documents
  ([Tab ↔ document many-to-many](tab-document-many-to-many.md)) is not taken
  away from them: the server delete keeps it there whole, history included, and
  the offline copy holds its own copy of the content. From then on the two are
  independent; an edit on either side never reaches the other. The
  confirmation says so up front (see [Shared-tab notice](tab-document-many-to-many.md#shared-tab-notice)).
- **Every tab, or nothing.** If any tab fails to download the conversion aborts
  before anything is written locally and before the server delete, so the cloud
  copy stays authoritative. This is the one failure in this direction that
  nothing could undo: a partial download followed by the server delete leaves
  the missing tab's elements nowhere at all, while reporting success. A tab read
  can come back empty from two directions — a failed request, or a 404 that the
  api client maps to `null` rather than an error — and both count as failure
  here. (The best-effort "keep what loaded" shape is right for _duplicating_ a
  document, where the source survives; it inverts once the source is destroyed.)
- **If that server delete fails, the local copy is rolled back** and the error
  surfaces. Both copies registered under one id would shadow the live cloud
  document behind a stale offline fork (and duplicate the Explorer row), so the
  conversion is all-or-nothing in this direction too. Data-safe either way: the
  server still holds everything, and the user can retry. The rollback is
  best-effort, but a rollback that itself fails still reports the original
  delete failure rather than a success.
- **Take Offline bypasses the [Trash](../013-workspace/trash.md)** for the document's owner: it is a move, not a delete, so the server copy goes at once. A joined teammate taking a team document offline sends the team's copy to the team Trash instead, since from the team's side it is a deletion.
- **Deleting an offline document moves it to this browser's local Trash** ([Trash](../013-workspace/trash.md), "The local Trash"): the IndexedDB record gains `trashedAt` and keeps everything else, leaves the lists and stars, refuses writes, and is purged 30 days later the next time the app lists documents or opens the Trash. Sync Document removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ document offline
  first revokes those (a share/team document can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline document is browser-local regardless of
  account — a signed-in user's offline documents do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** document ([Auth + guest access](../014-identity/auth-and-guest-access.md)): a guest's cloud document is
  anonymous but still on the server (keyed by the browser's participant id);
  an offline document never touches the server at all.
- Sign-in / sign-out never migrates offline documents by itself (the migrate flow, [Auth + guest access](../014-identity/auth-and-guest-access.md),
  only moves guest _cloud_ documents to the account). After signing in, a prompt
  **offers** to move them ([Moving Local only documents after signing in](../014-identity/auth-and-guest-access.md#moving-local-only-documents-after-signing-in));
  a document the person leaves stays put.
- The "Local only" badge and pill read the same for a guest as for anyone: the
  sentence about clearing site data is the one a guest most needs to see.

## Persistence architecture

The editor already has a **single persistence boundary**: `apps/live/lib/api-client.ts`
(a barrel over `lib/api/*`); nothing in the editor calls `fetch` directly. Offline
Mode is implemented **behind that boundary** so the editor is unaware of the
target:

- **Dispatch per call, not a backend pair.** This was first drafted as two
  implementations of one interface, an `ApiBackend` and a `LocalBackend`. What
  shipped is smaller: each load / save / delete in `lib/api/*` opens with
  `if (await isOfflineId(id))` and hands off to `lib/offline/offline-store.ts`,
  otherwise it does what it always did. There is no second class to keep in
  step with the first, and an endpoint that offline has no answer for simply
  never grows the branch.
- Offline ids are client-generated (`crypto.randomUUID`) and registered in a
  local index; `isOfflineId` reads it. The `beforeunload` beacon flush cannot
  await, so it uses the synchronous `isOfflineIdSync` off the loaded cache.
- **Listing is the exception that is not a dispatch.** The Explorer shows both
  sets at once, so it MERGES the api list with the local one, and still returns
  the offline rows when the cloud fetch fails.
- **Create is the one caller-decided branch**, because there is no registered id
  to dispatch on yet: the New Document wizard calls `offlineCreateDocument`
  directly when the location is Local Browser (picked, or a guest's default), and
  that call is what registers the id every later operation routes on.
- Only the document/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  document (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page — no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Flip on Offline Mode when you create a document and it is saved only in
> your browser: no account, no server, no sync. Yours alone. Move it to the cloud (or pull one
> back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a document
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([Help app](../018-help/help-app.md))

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and — per the help-registry rule — **register it in
`apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Document wizard's Save
  location chooser, [Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data — the durability warning, stated plainly.
- **Converting**: "Sync Document" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration, teams, and AI.

Also add the standard contextual help link ([Contextual help links](../018-help/contextual-help-links.md)) from the New Document
wizard's data-loss warning to this article.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Track adoption without content, reusing the closed vocabulary:

- On create, distinguish the mode via the `type` on the existing
  `Document`/`Created` event (e.g. `Offline` vs `Cloud`).
- The move prompt after signing in: `UI`/`Opened`/`LocalMovePrompt` when it
  shows, `UI`/`Selected`/`LocalMovePrompt` on Move, `UI`/`Closed`/`LocalMovePrompt`
  on Not Now. Each document it moves also sends the conversion event below.
- On conversion, a coarse event for each direction, so uptake and the
  destructive take-offline path are visible: `Document`/`Moved` with type
  `SavedToCloud` or `TakenOffline`, emitted after the conversion succeeds: from
  the shared `useOfflineConversion` handlers before their reload (the telemetry
  engine's pagehide beacon carries it through), from `useSyncInPlace` for the
  Share dialog, and per document from the move prompt.
- No document content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline documents** — that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing** — offline is single-user by nature.
- **Not** offline-resilience for cloud documents (editing a cloud document through
  a network blip) — that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion** — a document never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action (pressing Share,
  Sync Document, or Move on the prompt after signing in).

## Implementation map

- `apps/live/lib/api-client.ts` + `lib/api/*` — the persistence-backend seam;
  new `LocalBackend` (IndexedDB) beside the existing API calls; per-document
  dispatch via a local index.
- New Document wizard (`TemplatePicker` / `template-picker-settings.tsx`,
  [Dedicated route for new-document creation](../007-editor/new-document-route.md)): the **Settings** step's Save location chooser ([Save Locations](save-locations.md), the
  Local Browser tile) + data-loss warning + contextual help link.
- `EditorHeader` (`SharedBadge`) — the **Local only** badge state.
- Explorer (row + card components, `LocalOnlyPill`): merge the local index,
  show the **Local only** pill wherever an offline document is listed plus a
  fixed offline thumbnail everywhere, and skip server fetches for offline rows.
- Guest default + instant open: `lib/save-locations.ts` (`defaultSaveLocationFor`),
  `lib/signed-in-hint.ts`, `app/new/useNewDocumentLocation.ts`, the early open in
  `app/document/[id]/useIdentityBootstrap.ts` with `app/document/[id]/resolve-participant.ts`.
- Share's offline gate and syncing in place: `components/dialogs/ShareOfflineGate.tsx`,
  `app/document/[id]/useSyncInPlace.ts`, `subscribeOfflineIds` in `lib/offline/offline-store.ts`.
- The move prompt after signing in: `components/dialogs/LocalMovePrompt.tsx`,
  `hooks/persistence/useLocalMovePrompt.ts`, `lib/offline/local-move-dismissal.ts`.
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Document" and "Take Offline" (with confirmation + image re-homing).
- Image handling ([Image element + per-owner gallery](../009-elements/images.md)) — embed `data:` URIs offline; upload-on-save,
  download-on-take-offline.
- `apps/marketing` — the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `apps/help` — the "Offline Mode" article + its `articles.ts` registry entry
  ([Help app](../018-help/help-app.md)).
- Telemetry — the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Open source + distribution](../002-project-scope/open-source-and-business-model.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Document structure](document-structure.md) (document model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[Dedicated route for new-document creation](../007-editor/new-document-route.md) (New Document),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Image element + per-owner gallery](../009-elements/images.md) (images),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime — the separate concern),
[Save Locations](save-locations.md) (the Save location chooser).
