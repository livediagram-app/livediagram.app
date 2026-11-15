# Offline Mode

**Offline Mode** lets you create a document that is saved **only in the current
browser**, never to the API, never to the server. It is the default for a guest's
new document ([Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local))
and an opt-in choice for everyone else. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a document that physically never leaves
their machine. It also reinforces the OSS promise ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a document**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ document is
a separate concern, see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), and out of scope here.)

Tab bodies are stamped with their **tab kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire`: the two stores must agree about what a tab IS ([Document structure](document-structure.md)).

## Turning it on

Offline Mode is **on by default for a guest and off by default for a signed-in person**
([Save Locations → The default depends on who is creating](save-locations.md#the-default-depends-on-who-is-creating)).
Nobody is asked when creating a document; the default decides:

- A **new Space** ([Dedicated route for new-document creation](../007-editor/new-document-route.md#no-welcome-screen))
  asks only for a mode and creates the document in the default location for who is creating
  ([Save Locations](save-locations.md)): **This Browser** for a guest, **livehuddle** for a signed-in person.
  Either moves later: **Take Offline** moves a cloud document into This Browser, **Sync Space** puts one in This Browser on
  livehuddle.
- Every `/new` link (`/new?template=`, `/new?blank=1`,
  [Dedicated route for new-document creation → What a /new link can ask for](../007-editor/new-document-route.md#what-a-new-link-can-ask-for))
  takes the same default, so a guest following a template from the landing page
  gets a document in This Browser.
- The location only changes _where the document is stored_; the mode, templates and theme work identically.

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
  (`apps/editor/lib/offline/offline-ids.ts`), and every id registered or removed is told
  to the other tabs on the `livehuddle-offline` BroadcastChannel (`{ kind: 'add' |
'remove', id }`), which apply it at once. Without it, a tab that missed a Take
  Offline would keep saving that document to the server, and a tab
  that missed a Sync Space or purge would keep "saving" into a record that is gone.
- **A write to a record that is gone fails out loud.** When an edit (a tab, the name,
  the order, the folder) finds its record missing while the tab still
  lists the id, the id is forgotten (and the other tabs told) and the write fails with
  `OfflineDocumentMissingError`, logged `[offline-store] write-to-missing-record`: the
  autosave shows the failure instead of "Saved", and its retry routes to wherever the
  document now is. A missing record whose id the tab has already forgotten (its own
  Sync Space, with a save still queued) stays a quiet no-op.
- **Each read-modify-write is one transaction.** A write reads the whole record and
  writes it back; the two happen in one IndexedDB `readwrite` transaction
  (`OfflineBackend.update`), so another tab's write cannot land between them and be
  overwritten. Writes from the same tab are also queued one after another.

<!-- legacy-names -->

- **Store rename (version 2).** Offline documents were kept in the `diagrams` object store until
  the container became a document ([Document](document.md#renaming-from-diagram)). Opening
  version 2 of `livehuddle-offline` moves every record into `documents` inside the upgrade
  transaction, then drops the old store, logging how many moved
  (`apps/editor/lib/offline/legacy-offline-store.ts`). A tab still running the code from before the upgrade
  asks for version 1, which the browser refuses once another tab has opened version 2; its offline
  documents are out of reach in that tab until it reloads.
- **Version 3 changes nothing.** livehuddle's copy of the editor came from livediagram's, whose version 3 set
  aside documents holding Pages and Plan content in a second store, `retired-parts`, and offered to move them to
  livedocuments, liveplanner and livedesign. livehuddle never held such content, so the set-aside, its offer and its
  Settings row are gone (2026-11-08). The version number stays at 3, so no browser that already opened it is asked
  to go back a version; a browser that made the empty `retired-parts` store keeps it, and nothing reads it.
- **Other tabs during an upgrade.** Every connection this editor opens closes itself on `versionchange`, and
  connections only live for one operation, so a new-editor tab never holds an upgrade up for long. An open that is
  `blocked` (by a tab of the old editor still open from before the switch) gives up at once, as above, but the
  browser keeps the upgrade waiting and runs it the moment the old tab lets go. That old tab's next open asks for
  version 2 and is refused; its documents are out of reach in that tab until it reloads, as with version 2.
- **Durability honesty (important).** An offline document has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly: on the document (see the badge, and its legend), in the Share dialog before a Sync, and in
  the help article. "Offline" means _yours only_, with the responsibility that
  implies.

<!-- /legacy-names -->

## What's different in an offline document

The document model (`Tab[]` + meta, per [Document structure](document-structure.md)) is **identical**: an offline
document is a normal document whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline document:

| Feature                                                                   | Offline behaviour                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds                                                      | The header **Share** button stays visible, but for an offline document it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Editor app](../007-editor/editor-app.md), /54). |
| Live presence / realtime                                                  | N/A: a private document never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                         |
| Teams / shared library                                                    | Hidden: a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                                    |
| Comments                                                                  | Local-only (just you), stored in the document; no cross-user.                                                                                                                                                                                                                       |
| Duplicate                                                                 | Makes **another offline document**: a copy never uploads what the user chose to keep local.                                                                                                                                                                                         |
| Folders                                                                   | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                        |
| Tab linking ([Tab ↔ document many-to-many](tab-document-many-to-many.md)) | Unavailable in either direction: the server keeps a shared tab's copies in step, and an offline document is not on the server.                                                                                                                                                      |
| Thumbnails                                                                | The **browser it lives in**, on a wash of the accent of the app that owns it (the Explorer's `LocalPreview`), never the pill's teal: there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                                    |
| Images                                                                    | **Embedded locally**; see below.                                                                                                                                                                                                                                                    |

**Images embed locally ([Image element + per-owner gallery](../009-elements/images.md)).** In a cloud document, an added image uploads
to R2 and is referenced by URL. In an offline document it can't, so an image is
stored **inline as a `data:` URI** inside the document. Rendering is unchanged
(`<img>` reads a data URI fine). This costs local storage, which is the accepted
trade for staying fully offline. (Conversion re-homes images; see below.)

Autosave still runs for an offline document ([Per-tab storage](per-tab-storage.md)): it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## Instant open

A document in This Browser lives in this browser, so opening it waits on nothing the
server says. The editor bootstrap ([Dedicated route for new-document creation → In-place handoff](../007-editor/new-document-route.md#in-place-handoff-to-the-editor),
`app/document/[id]/useIdentityBootstrap.ts`) takes an **early open** when, before
auth has settled, the path names a document registered in the local index
(`isOfflineId`). Share links and embeds always wait for auth.

- The early open does **not wait for auth to settle**, mint a guest id or fetch
  the participant. It reads the document from IndexedDB and paints it under the
  `'self'` placeholder participant.
- **Owner-scoped work waits for the real reader.** Under `'self'`, nothing is
  read or written as an owner: the participant record is not saved, preferences
  stay local (`writeUserPreferences`), and the shape libraries,
  recent images and Explorer lists load only once the reader is known. Sync
  Document from the Share dialog waits too (the gate's `ready`).
- **The reader resolves in the background** once auth answers, exactly as a
  cloud open resolves it (`resolveParticipant` in
  `app/document/[id]/resolve-participant.ts`: the account id or the guest token's id,
  then the participant row), followed by the Explorer lists and the guest naming
  nudge. The document is not reloaded: an offline document is the reader's own
  whoever they turn out to be.
- **`/new` does not wait either.** For a guest ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers))
  creating This Browser, the create writes to IndexedDB and hands off without
  waiting on auth, the guest id or the participant, which resolve in the
  background (`commitNewDocument` in `app/new/page.tsx`).
- The editor reads back the record `/new` has just written rather than taking
  the tabs across in memory: the read is one IndexedDB get, small beside the
  waits removed, and keeps one load path.

**Measured** against production builds of `main` and of this change, served the
same way with the local api (headless Chromium, 10 runs each, interleaved; a
fresh browser profile per first visit), guest create to first canvas paint:

| Link                   | Before (cloud) first / return | After (This Browser) first / return | API requests |
| ---------------------- | ----------------------------- | ----------------------------------- | ------------ |
| `/new?template=kanban` | 2,956 / 1,775 ms              | 955 / 819 ms                        | 24 → 1       |
| `/new?blank=1`         | 3,076 / 1,803 ms              | 1,053 / 834 ms                      | 20 → 1       |

The one request left is `GET /api/capabilities`; the guest id, participant and
Explorer lists follow after the paint.

## Warm open of a cloud document

A cloud document waits on three things in a row before it paints: auth settling, the
participant ([`resolveParticipant`](#instant-open)) and the tab fetch. In livediagram about a
third of opens took over 4 s (telemetry, `DocumentLoad.*`, October 2026), and every
editor loads the same way. A cloud document this
browser has opened before can paint at once from **the last copy seen**, the way Linear,
Figma and Notion show their last synced copy and catch up in the background
(Work Tracker 890).

**The last copy seen.** Each time a cloud document opens by its own address or by a share
link, the editor keeps what that load answered in this browser: the document's meta (name,
tab list, owner fields), the first tab's body and revision, and how the reader came in (the
role, the owner's chrome, the share code the address carried and the tab a tab-scoped link
opens). It lives in its own IndexedDB database (`livehuddle-last-seen`), never on the
server.

- **Per reader.** A copy is keyed by who read it: the account id, or the guest's id. It is
  read back only for that reader, and every load drops the copies any other reader left,
  so a browser holds one reader's copies at most (a sign-out in another app, or a second
  account, empties the rest on the next load).
- **Cleared on sign-out.** Signing out, and deleting the account, empties the store before
  the sign-out hop.
- **Lost access forgets.** A load that ends on not found, on the deleted card or behind a
  share password removes that document's copy. A load that cannot reach the server keeps
  it.
- **Follows the document.** While the document is open its copy keeps up with what the reader
  sees: the name and the tab list each time they change (a rename, a tab added, moved or
  deleted, by the reader or by a peer), and the first tab's body each time one of the
  reader's own saves of it lands, with the revision that save wrote. A Viewer's or a
  Participant's copy keeps the first tab it opened with (their changes are not tab saves);
  the catch-up brings the rest. Refreshes are gathered into at most one write every 2
  seconds, made off the editing path, so they never hold up a save or a keystroke; a
  waiting one is written at once when the page is hidden or closed. Only a copy the open
  kept is followed, for the same reader: an embed, a Community post or a This Browser document
  never gains one, and a document taken offline to This Browser drops its copy.
- **Bounded.** At most 20 copies, the oldest seen dropped first; a copy over 1,000,000
  characters of JSON is not kept (a bigger document opens as it does today); a copy older
  than 30 days is never read. Embeds, Community posts, workbenches and This Browser
  documents keep none.

**The warm open.** Before auth settles, an address naming a cloud document with a copy for
the reader this browser expects paints that copy under the `'self'` placeholder, read-only.
The reader expected is the guest token's id, or, when the signed-in hint says this browser
is signed in, the account whose copies the store holds (it holds one reader's at most). A
signed-out browser, or one whose guest is someone else, never reads an account's copy. A
share link warm-opens only when its share code is the one the copy was kept under: by an address that names the document, or by the link's own address (`/document/shared?s=<code>`, as the Share dialog gives it), which names no document and finds the reader's newest copy kept under that code, for the same reader rules. The address is left as it is. Embeds, workbenches and This Browser documents never
warm-open, and a copy whose first tab is not the tab this open would show first (no first
tab kept, or the address's `#t=` names another tab) is not painted: the document opens as it
always did.

- **Edits wait for the participant.** The warm paint runs as a Viewer: every edit control is
  disabled with the usual read-only look, and nothing is saved, the room does not connect and
  no request goes out under the placeholder, until the reader resolves and the fresh copy
  lands. A stored role never widens what the reader may do.
- **A load that starts first still lets it paint.** A guest's sign-in answers from this browser almost
  at once, so the load often starts before the copy is read. The copy still paints until the load
  begins to show what it fetched (or finds someone else reading), and the load then replaces it.
- **The ordinary load catches up** behind it, unchanged: auth, the participant, the
  document and the first tab. Its answer replaces the copy in place (the same tabs by id,
  no opening screen between, nothing typed to lose because editing waited) and its role
  applies: a Viewer stays read-only, a Participant gets a Participant's tools, an Editor
  can edit. A first tab whose revision is the one the copy holds keeps the painted tab as it
  is, so an unchanged canvas is not drawn again.
- **Someone else after all.** When the reader resolves to someone other than the copy's
  (a hint that outlived its session), the copy goes from the screen at once for the opening
  screen, and the load opens the document for whoever is reading.
- **Lost access on catch-up** swaps the copy for the screen the load ends on (not found,
  the deleted card, the password gate) and forgets the copy; a share link's copies go by its code
  too, as its own address names no document. A load that cannot reach the
  server ends on its error screen and keeps the copy.
- **Never a wrong not found.** A load that ends on not found after a warm paint is checked once by an
  ordinary open: the copy is forgotten and the page reloads, cold. A session that answered late or settled
  as a guest (so the document's owner read as someone else) gets a fresh start, and only that cold open's not
  found ever shows. Once per document per browser tab session, so a document that really is gone costs one
  reload, never a loop; the console says why (`[load] warm-open-fallback <reason>`).
- **The tab title** names the document from the warm paint on, and comes back if the framework rewrites the
  page's title after it (the static export's not-found route sets its own).
- **Other tabs wait for the load.** The copy holds the first tab's body only: moving to
  another tab during the warm paint shows the tab loader, never a blank canvas, and the
  catch-up keeps the tab the reader moved to (when the document still has it and the link's
  tab scope allows it) instead of going back to the first.
- **The view lands once.** The painted tab is fitted as it paints, so a catch-up that keeps its
  body does not fit it again and the view does not jump. A copy older than the server's (a save
  that landed after the copy was last written) is replaced by the catch-up, and the tab is fitted
  again on what it now holds, so content the copy did not have is never left off screen.
- **Another browser tab** of the same document warm-opens from the same copy; its room connects
  once its own load lands, as always.
- `DocumentLoad` keeps timing the fresh copy's first frame; the warm paint is timed on its own, as
  the performance measures `warm-paint` and `warm-catch-up` (from the same start as
  `DocumentLoad`), and in the field as the `WarmPaint` timing (from the same start, to the warm paint's
  first frame).

**Built so far.** Part 1 keeps, bounds and clears the copies (`createLastSeenCopies` in
`@liveworkspace/workbench/lib/api/last-seen-copies`), part 2 keeps each one following the
open document (`createLastSeenFollower`, `useLastSeenFollow`), and part 3 paints it
(`readWarmCopy` in `@liveworkspace/workbench/lib/warm-open`, each editor's bootstrap). Part 4
measures warm opens against cold ones on production builds
([Last seen copy blueprint](blueprints/last-seen-copy.md)).

**Measured on production builds** (part 4, livediagram's signed-in export, headless Chromium, a 200-element first
tab, 100 ms round trip at 10 / 5 Mbps on every request, 12 cold and 12 warm opens interleaved, each a fresh
navigation with the app's files cached, median / p90 from navigation start):

| Way in                | Cold: content and editable | Warm: content | Warm: editable   |
| --------------------- | -------------------------- | ------------- | ---------------- |
| Signed in             | 827 / 829 ms               | 360 / 369 ms  | 1,191 / 1,209 ms |
| A guest by share link | 835 / 843 ms               | 369 / 376 ms  | 1,190 / 1,196 ms |

The content shows about 470 ms (56%) sooner. Becoming editable comes about 360 ms later than a cold open today: the
ordinary load's first request starts later behind the warm paint's commit (see the blueprint's "Measured on production
builds" and its follow-up). The other editors bind the same shared modules and the same bootstrap, so their shape
is the same. `WarmPaint` (timing telemetry) now times the warm paint in the field, beside `DocumentLoad`.

**Measured** (headless Chromium, 25 runs each, median / p95): keeping a copy and reading it
back cost about a millisecond against the seconds the warm open saves.

| First tab      | Copy size | Stringify    | Write        | Open and read | Parse        |
| -------------- | --------- | ------------ | ------------ | ------------- | ------------ |
| 50 elements    | 12 KB     | 0.0 / 0.1 ms | 0.3 / 3.4 ms | 0.2 / 1.2 ms  | 0.0 / 0.1 ms |
| 500 elements   | 120 KB    | 0.2 / 0.3 ms | 0.3 / 1.5 ms | 0.2 / 0.8 ms  | 0.1 / 0.2 ms |
| 2,000 elements | 480 KB    | 0.7 / 0.7 ms | 0.7 / 3.4 ms | 0.5 / 2.2 ms  | 0.5 / 0.6 ms |

## Archived in This Browser

A space in This Browser can be moved to Archived from the Explorer's menu, like an account's. Nothing leaves the
browser: the mark (`archivedAt`) lives only in This Browser's shared list (`@liveworkspace/explorer/this-browser`),
and every rewrite of the list carries the marks it held. Before the editor opens a space it reads the mark once
(`isThisBrowserArchived`), and an archived one shows the **Space Archived** card in place of the space
([Archived](../007-editor/new-document-route.md#archived)), whether or not the early open would have taken it. Change Folder moves it out,
back into This Browser's list.

## "This Browser" badge + Explorer

- **Editor header badge.** The status pill reads Private / Shared / Team
  (the `SharedBadge` in `EditorHeader`). For an offline document it reads
  **"This Browser"** (a state that supersedes "Private" for these documents),
  matching the [This Browser pill](#this-browser-pill): the same words, the same
  browser-window icon, the same teal tone and contrast, and the same sentence,
  "Lives only in this browser. Clearing this browser's site data deletes it.",
  shown in the badge's visibility legend on hover and focus and given to
  assistive technology as the badge's description. It stays a status, not a
  link: the legend explains it in place.
- **The visibility legend** (`VisibilityLegend`, on the badge's hover and focus, closing 120 ms after the
  pointer leaves): a hero in the current state's tone, eyebrow **Who Can See This**, the state's icon and
  name, its sentence, and its **reach** drawn as rings around you, lit out to how far the document goes
  (Private: none; Shared: one, with people on it; Team: two; Public: all three); the words sit level with the
  rings, centred, and the hero keeps one height whichever audience it shows. Under it, **From Just You
  to Everyone**: the audiences on one scale, **Just you** (a lock), **Link** (a link), **Team** (people),
  **Everyone** (a globe), the track filled to the current stop, which is larger, filled in its tone and
  bold. Hovering a stop shows that audience in the hero, eyebrow **If It Were**, and tints the stop;
  leaving the scale puts the current state back. **This Browser** (its browser-window icon, teal) stands
  apart below as "Or This Browser: never leaves this browser." (when current: "This Browser: saved only here,
  never on our servers.", tinted teal). For someone who may share, **Change Who Can See This** at the
  foot opens Share, and the badge itself is a button that opens Share; for anyone else it is a focusable
  pill and the legend has no button. For the eye only: the badge carries the current state's words for
  assistive technology.
- **Explorer.** Offline documents never reach liveworkspace's index, so none of the index's lists holds them. They are
  the Explorer's **This Browser** view, in the page (`/explorer/offline`) and the editor's Explorer panel alike: every
  one, newest first, read from this browser alone, each opening in the editor, with **Sync Space** for a signed-in
  person and **Delete**, which removes it for good after a confirmation ("Delete this space from this browser?",
  "“Roadmap” is kept only in this browser. Deleting it removes this browser’s copy, the only one, for good. Nothing in
  your account changes."): nothing else holds it, so there is no Trash for it
  ([Explorer structure: This Browser](../013-workspace/explorer-structure.md#this-browser)).
- **Sidebar.** The Explorer on livehuddle's address reads the small list the offline store keeps for it (id, title
  and dates, never content) in the shared `localStorage` key (`lib/offline/this-browser.ts`,
  `@liveworkspace/explorer/this-browser`): its **This Browser** row, with the count, opens the Explorer's own This
  Browser view (`/explorer/offline`). On liveworkspace.app, which cannot read it, the row links to that view here. The
  editor's Explorer panel has the same entry on its rail, with the count, opening its pane in place, shown only while
  this browser holds at least one (`hooks/persistence/useThisBrowserHost.ts`). `/offline`, the old This Browser page,
  only redirects to `/explorer/offline`, its query kept.
- **Home.** An offline document's opens are counted in this browser only (`lib/offline/offline-opens.ts`), never
  sent anywhere, and carried in that list, so Home's Most Used and Recent can place it among the reader's other documents
  ([Explorer Home](../013-workspace/explorer-home.md#opens)).

### This Browser pill

Every row and card of an offline document carries a **This Browser** pill,
wherever the document is listed: This Browser's page and Home's Most Used and Recent.

- **Not colour alone.** The pill shows an icon (a browser window) and the words
  "This Browser", in a teal tone whose text meets 4.5:1 on its fill in light and
  dark mode; the ring meets 3:1 against the row. Teal because it is no app's accent
  (livehuddle sky, liveplanner violet, livedocuments amber, livedesign rose, liveworkspace
  slate) and no status colour (green fine, amber warning, red failing), so the pill never reads
  as whose an item is, or as fine or failing. One pill for every editor and the Explorer
  (`ThisBrowserPill` in `@liveworkspace/workbench`, its tone `THIS_BROWSER_TONE` from
  `@liveworkspace/explorer/this-browser`).
- **What it means, on hover and focus.** Its hover card reads "This Browser" over
  "Lives only in this browser. Clearing this browser's site data deletes it."
  The same sentence is the pill's accessible description (`aria-describedby`),
  so a screen reader hears it without hovering.
- **The guide is one click away.** The pill is a link to the Offline Mode help
  article (new tab, the editor's help-link telemetry), with its own focus ring.
  Where the row is itself a single control, the pill is a plain label inside it, carrying the same
  description: a link cannot sit inside a button.

## Converting between Offline and Cloud

Conversion works **both directions**, from a canvas's menu in the editor's Explorer panel:
**Take Offline** on a canvas in the person's library or a team's, **Sync Space** on one this browser holds
(`hooks/persistence/useOfflineItemMenu.tsx`, the shared Explorer's `itemMenu`), and Sync Space on the panel's This
Browser rows. The Explorer page at livehuddle.app/explorer offers both too: it cannot reach this browser's
store, so it hands each to the editor at the canvas's own address (`/document/<id>?convert=take-offline|sync|delete&item=<id>`, `components/dialogs/ConversionHandoff.tsx` over `hooks/persistence/useConversionHandoff.ts`), over the shared
`@liveworkspace/explorer/conversion-handoff`, which checks the canvas is the person's to move and asks the same
confirmation (Sync with its own). A canvas taken offline on purpose is never offered back by the move prompt after
signing in. In the editor, the offline to cloud
direction is also offered by the Share dialog (below), and after signing in by
the move prompt ([Auth + guest access → Moving documents in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-documents-in-this-browser-after-signing-in)).

On a fresh, unshared canvas's start screen the **Sync Space to Server** switch moves it either way, in place and with no confirmation ([Save Locations → On the start screen](save-locations.md#on-the-start-screen)).

### Sharing a document in This Browser

Share is how most people find out a document needs the server. Pressing it never
uploads anything by itself; the dialog explains and asks, for a guest and a
signed-in person alike:

- **The gate.** Share on a document in This Browser opens the Share dialog on its
  offline gate (`ShareOfflineGate`): **This Space Is in This Browser**, "It is saved only
  in this browser, so there is nothing to share yet. Sync it to livehuddle to
  share it: share links, real-time collaboration and the live image all need it
  on our servers. You can take it offline again any time.", with **Sync Space**
  and Cancel.
- **Sync Space** syncs the open document **in place** (below): the button shows
  **Syncing…** with a spinner, then a toast confirms "Synced. Your document is on
  livehuddle now." and the same dialog shows the share options. No reload, no
  second press of Share. A guest's upload is owned by the guest id like any guest
  cloud document.
- The button waits for the reader to be known (an early open runs under the
  `'self'` placeholder, [Instant open](#instant-open)).
- A failed sync keeps the document This Browser, says why in a toast
  (`syncFailureMessage`) and leaves the button to try again; nothing is
  half-uploaded (see below).

### Syncing in place

Sync Space from inside the editor (`useSyncInPlace` in
`app/document/[id]/useSyncInPlace.ts`) converts the open document without a
reload:

1. **It waits for this browser's last save** to land (`hasUnsavedChanges`), up to
   `SYNC_SAVE_WAIT_MS` (5 s), so the record it uploads is what is on screen and no
   save lands in a record about to be deleted. Past that it refuses with
   `SyncStillSavingError` ("Still saving this canvas. Try again in a moment.").
2. **It uploads** with `saveOfflineToCloud`, which returns the images it re-homed
   (data URI → gallery id).
3. **The offline index announces the move** (`subscribeOfflineIds` in
   `lib/offline/offline-store.ts`, told on every create, sync and Take Offline).
   What reads offline-ness follows it: the header badge and every
   `useIsOfflineDocument` (so the Share dialog swaps the gate for its options).
4. **The open tabs' images are re-pointed** at their gallery copies, in the editor
   and in its last-saved copy, so the next save does not write the data URIs back.
5. **The room opens** (`documentServerStored` turns true) and the Explorer list
   refreshes.

The Explorer panel's Sync and Take Offline (an item's menu, This Browser's rows) never reload either: the
document open in the editor moves in place as above, any other moves on its own, and the Explorer loads its lists again
once the move settles. Only the move prompt after signing in still reloads, since several move at once.

### Taking offline in place

Take Offline from the start screen's **Sync Space to Server** switch
([Save Locations → On the start screen](save-locations.md#on-the-start-screen)), `useTakeOfflineInPlace` in
`app/document/[id]/useTakeOfflineInPlace.ts`, converts the open canvas without a reload and without the confirmation: the
switch only shows on a fresh canvas nobody else has, so there is nothing to lose.

1. **It waits for this browser's last save**, as a sync in place does (`SYNC_SAVE_WAIT_MS`, then
   `SyncStillSavingError`).
2. **It closes the room first** (`documentServerStored` turns false), so the server delete's echo never reaches the open
   editor as a deletion. A failure opens it again and the canvas stays on the server.
3. **It takes the canvas offline** with `takeCloudOffline`, exactly as Take Offline below.
4. **The offline index announces the move**: the header badge and every `useIsOfflineDocument` follow, and every later save
   goes to IndexedDB by the canvas's id.
5. **The template-pick note is dropped** (a template picked now has no server folder to go to), the move prompt after
   signing in is told the canvas stays here, and the Explorer list refreshes.

### Save to server (Offline → Cloud)

Action: **"Sync Space"**, on a canvas's menu in the editor's Explorer panel, on This Browser's page, in the Share
dialog's gate and in the move prompt after signing in.

- Uploads the document's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud document owned by the current identity (signed-in account, or the guest
  token's guest if not signed in, [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Images re-home:** each embedded `data:` URI is uploaded to the gallery
  (SHA-256 dedupe server-side, [Image element + per-owner gallery](../009-elements/images.md)) and the element's reference swaps to
  the returned R2 id, so the cloud copy carries real gallery images instead of
  bloated tab JSON. A failed transfer keeps the data URI (it still renders
  anywhere); the per-tab byte cap surfaces a hard failure to the caller.
- **Everything on the record travels**, not just tabs: the slide deck
  ([Presentation mode](../012-collaboration/presentation-mode.md)), the created date, the folder (kept only when it is one of the
  caller's own personal folders, else the root of My Work) and the star ([Favourite documents](../013-workspace/favourites.md)). The
  local copy is deleted next, so anything the create leaves behind is gone.
- **A refused folder lands at the root, on the sync's say-so.** The create carries the folder as
  its placement ([Folders → Placement on create](../013-workspace/folders.md)),
  and the server refuses a folder deleted since, or not the caller's, by name rather than
  filing it elsewhere. On `folder_not_found` or `folder_scope_mismatch` the sync creates the
  document again at the root of My Work and logs `[offline-sync] placement refused reason=<code>, filed at root`;
  any other failure fails the sync and keeps the local copy.
- **A forked tab comes back as its own tab.** The create never writes into a tab
  another document holds: a seeded tab whose id is already taken outside this
  document is created under a fresh id, and the document's tab / element links and
  deck slides follow it. So a tab that forked on Take Offline returns as a new
  tab beside the original rather than overwriting it; joining them again is an
  explicit "Add to Another Space". A retried create (the tab already in this document)
  keeps its ids.
- **What went up is what is removed.** The upload takes seconds and the document
  stays editable meanwhile (here or in another tab). The local copy is removed only if
  it still matches what was uploaded (its save time), checked and deleted in one transaction. If it changed, the cloud
  copy is taken back (a raw delete declared as a move into this browser, so it skips
  the Trash) and the newer record is uploaded again, logged
  `[offline-sync] changed-during-upload attempt=<n>`; after three uploads that each
  went stale the sync stops, keeps the local copy and says the document kept changing.
- **One conversion per document at a time.** A second Sync Space or Take Offline
  of a document while one runs (a second menu, or the Share gate) does nothing; the
  guard lives with the conversion, not with the menu that started it, which closes.
- On success the **local copy is removed** from IndexedDB so there's one source
  of truth; the document is now a cloud document (Share / Teams reappear). The
  id is unchanged, so the route stays the same: from the Share dialog the editor
  turns into the cloud document in place ([Syncing in place](#syncing-in-place));
  from the Explorer panel it moves without a reload too.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**. This is **destructive on the server** and gated by a
confirmation:

- **Confirmation** warns clearly: _"This removes it from your account and every
  other device. It will exist only in this browser, with no backup."_ When the
  document has shared tabs, the shared-tab notice follows (see below).
- On confirm: download the document's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **This Browser**. Referenced R2 images are downloaded and embedded
  as `data:` URIs BEFORE the server copy is deleted (the deletion would make
  them "unused" and the retention reaper would eventually take the bytes); an
  incomplete embed aborts the conversion and the document stays on the server.
- **The deck, star and personal folder come along** for the same reason: the
  server row they live on is about to be deleted. The star is read from the account's
  favourites; if that read fails the conversion aborts before anything is written,
  rather than taking the document as unstarred and losing the star with the row. A team document's folder is a
  team folder, which has no place in the personal tree, so it lands at the root of My Work.
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
  can come back empty from two directions: a failed request, or a 404 that the
  api client maps to `null` rather than an error, and both count as failure
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
- **Deleting an offline document removes it for good**, from the Explorer after a confirmation: the index never held it, so there is no Trash for it. Deleting the canvas open in the editor tombstones it first (`../packages/workbench/src/lib/document-tombstones.ts`), so neither the autosave nor the unload flush writes it back, then removes the IndexedDB record and leaves for the Explorer, as deleting an open cloud canvas does (`@liveworkspace/workbench/lib/this-browser-remove`, shared by every editor). The confirmation says it deletes only this browser's copy, the only one, and that nothing in the account changes ("Delete this space from this browser?", `thisBrowserDeleteCopy` in `@liveworkspace/explorer/this-browser`). The panel deletes in place; the Explorer page asks the same on the page, then hands the delete to the editor at the canvas's own address (`/document/<id>?convert=delete&item=<id>`, `components/dialogs/ConversionHandoff.tsx`), which deletes it without asking again (the page's note in session storage) and goes back to `/explorer/offline`; the same link without that note asks first. Sync Space removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ document offline
  first revokes those (a share/team document can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline document is browser-local regardless of
  account: a signed-in user's offline documents do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** document ([Auth + guest access](../014-identity/auth-and-guest-access.md)): a guest's cloud document is
  anonymous but still on the server (keyed by the browser's participant id);
  an offline document never touches the server at all.
- Sign-in / sign-out never migrates offline documents by itself (the migrate flow, [Auth + guest access](../014-identity/auth-and-guest-access.md),
  only moves guest _cloud_ documents to the account). After signing in, a prompt
  **offers** to move them ([Moving documents in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-documents-in-this-browser-after-signing-in));
  a document the person leaves stays put.
- The "This Browser" badge and pill read the same for a guest as for anyone: the
  sentence about clearing site data is the one a guest most needs to see.

## Persistence architecture

The editor already has a **single persistence boundary**: `apps/editor/lib/api-client.ts`
(a barrel over `lib/api/*`); nothing in the editor calls `fetch` directly. Offline
Mode is implemented **behind that boundary** so the editor is unaware of the
target:

- **One store, bound per editor.** The store's operations (the write chain, the one-transaction updates, the
  reads, the Trash and favourite rules, Sync Canvas's delete-if-unchanged) are one copy every editor shares
  (`@liveworkspace/workbench/lib/offline/offline-store-core`). `lib/offline/offline-store.ts` binds it with its
  IndexedDB backend, whose database and store names and versions stay this editor's own, and keeps its own
  extra writes.
- **Dispatch per call, not a backend pair.** Each load / save / delete in `lib/api/*` opens with
  `if (await isOfflineId(id))` and hands off to `lib/offline/offline-store.ts`,
  otherwise it calls the api. There is no second class to keep in
  step with the first, and an endpoint that offline has no answer for simply
  never grows the branch.
- Offline ids are client-generated (`crypto.randomUUID`) and registered in a
  local index; `isOfflineId` reads it. The `beforeunload` beacon flush cannot
  await, so it uses the synchronous `isOfflineIdSync` off the loaded cache.
- **Listing is the exception that is not a dispatch.** The Explorer shows both
  sets at once, so it MERGES the api list with the local one, and still returns
  the offline rows when the cloud fetch fails.
- **Create is the one caller-decided branch**, because there is no registered id
  to dispatch on yet: the New Space wizard calls `offlineCreateDocument`
  directly when the location is This Browser (picked, or a guest's default), and
  that call is what registers the id every later operation routes on.
- Only the document/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  document (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page, no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Flip on Offline Mode when you create a document and it is saved only in
> your browser: no account, no server, no sync. Yours alone. Move it to the cloud (or pull one
> back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a document
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([Help app](../018-help/help-app.md))

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and, per the help-registry rule, **register it in
`apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Space wizard's Save
  location chooser, [Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data: the durability warning, stated plainly.
- **Converting**: "Sync Space" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration and teams.

Also add the standard contextual help link ([Contextual help links](../018-help/contextual-help-links.md)) from the New Space
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
  the shared `useOfflineConversion` handlers, from `useSyncInPlace` for the
  Share dialog, and per document from the move prompt.
- No document content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline documents**: that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing**: offline is single-user by nature.
- **Not** offline-resilience for cloud documents (editing a cloud document through
  a network blip): that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion**: a document never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action (pressing Share,
  Sync Space, or Move on the prompt after signing in).

## Implementation map

- `apps/editor/lib/api-client.ts` + `lib/api/*`: the persistence-backend seam;
  `lib/offline/offline-store.ts` (IndexedDB, `OfflineBackend` in `offline-backend.ts`) beside the API calls;
  per-document dispatch via a local index.
- New Space wizard (`TemplatePicker` / `template-picker-settings.tsx`,
  [Dedicated route for new-document creation](../007-editor/new-document-route.md)): the **Settings** step's Save location chooser ([Save Locations](save-locations.md), the
  This Browser tile) + data-loss warning + contextual help link.
- `EditorHeader` (`SharedBadge`): the **This Browser** badge state.
- Explorer (row + card components, `ThisBrowserPill`): merge the local index,
  show the **This Browser** pill wherever an offline document is listed plus a
  fixed offline thumbnail everywhere, and skip server fetches for offline rows.
- Guest default + instant open: `lib/save-locations.ts` (`defaultSaveLocationFor`),
  `lib/signed-in-hint.ts`, `app/new/useNewDocumentLocation.ts`, the early open in
  `app/document/[id]/useIdentityBootstrap.ts` with `app/document/[id]/resolve-participant.ts`.
- Share's offline gate and syncing in place: `components/dialogs/ShareOfflineGate.tsx`,
  `app/document/[id]/useSyncInPlace.ts`, `subscribeOfflineIds` in `lib/offline/offline-store.ts`.
- The move prompt after signing in: `components/dialogs/LocalMovePrompt.tsx`,
  `hooks/persistence/useLocalMovePrompt.ts`, `../packages/workbench/src/lib/offline/local-move-dismissal.ts`.
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Space" and "Take Offline" (with confirmation + image re-homing).
- Image handling ([Image element + per-owner gallery](../009-elements/images.md)): embed `data:` URIs offline; upload-on-save,
  download-on-take-offline.
- `apps/marketing`: the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `apps/help`: the "Offline Mode" article + its `articles.ts` registry entry
  ([Help app](../018-help/help-app.md)).
- Telemetry: the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Open source + distribution](../002-project-scope/open-source-and-business-model.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Document structure](document-structure.md) (document model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[Dedicated route for new-document creation](../007-editor/new-document-route.md) (New Space),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Image element + per-owner gallery](../009-elements/images.md) (images),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime, the separate concern),
[Save Locations](save-locations.md) (the Save location chooser).
