# Offline Mode

**Offline Mode** lets you create a design that is saved **only in the current
browser**: never to the API, never to the server. It is the default for a guest's
new design ([Auth + guest access → Guest designs start local](../014-identity/auth-and-guest-access.md#guest-designs-start-local))
and an opt-in choice for everyone else. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a design that physically never leaves
their machine. It also reinforces the OSS promise ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a design**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ design is
a separate concern (see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)) and out of scope here.)

Tab bodies are stamped with their **tab kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire`: the two stores must agree about what a tab IS, or a Sync Design would hand the cloud a board that has forgotten itself.

## Turning it on

Offline Mode is **on by default for a guest and off by default for a signed-in person**
([Save Locations → The default depends on who is creating](save-locations.md#the-default-depends-on-who-is-creating)).
Nobody is asked when creating a design; the default decides:

- **`/new`** ([New design route](../007-editor/new-design-route.md#what-new-makes)) asks nothing and creates the
  design in the default location for who is creating ([Save Locations](save-locations.md)): **This Browser** for a
  guest, **livedesign** for a signed-in person. Its links (`/new?template=`, `/new?blank=1`,
  [Start Blank](../007-editor/new-design-route.md#start-blank)) take the same default, so a guest following a template
  from the landing page gets a design in This Browser. A placement param (`?folder=`, `?team=`) makes it a cloud one.
- Either moves later: **Take Offline** moves a cloud design into This Browser, **Sync Design** puts one in This
  Browser on livedesign.
- The location only changes _where the design is stored_; the templates and theme work identically.

No global "offline mode" switch: the choice is **per design**, so a person can
have cloud designs and offline designs side by side.

## Where offline designs live

- Stored in **IndexedDB** in the browser (roomy + async; `localStorage`'s ~5 MB
  synchronous cap is too small for image-bearing designs). One record per
  design holds its meta + tabs, keyed by the design id.
- The app keeps a small **local index** of offline design ids (also in
  IndexedDB) so the Explorer can list them and the persistence layer knows which
  ids resolve locally vs to the API.
- **Every tab of the browser agrees on the index.** Each tab mirrors it in memory
  (`apps/live/lib/offline/offline-ids.ts`), and every id registered or removed is told
  to the other tabs on the `livedesign-offline` BroadcastChannel (`{ kind: 'add' |
'remove', id }`), which apply it at once. Without it, a tab that missed a Take Offline would keep saving that design to the server, and a tab that missed a Sync Design or purge would keep "saving" into a record that is gone.
- **A write to a record that is gone fails out loud.** When an edit (a tab, the name,
  the order, the folder) finds its record missing while the tab still
  lists the id, the id is forgotten (and the other tabs told) and the write fails with
  `OfflineDesignMissingError`, logged `[offline-store] write-to-missing-record`: the
  autosave shows the failure instead of "Saved", and its retry routes to wherever the
  design now is. A missing record whose id the tab has already forgotten (its own
  Sync Design, with a save still queued) stays a quiet no-op.
- **Each read-modify-write is one transaction.** A write reads the whole record and
  writes it back; the two happen in one IndexedDB `readwrite` transaction
  (`OfflineBackend.update`), so another tab's write cannot land between them and be
  overwritten. Writes from the same tab are also queued one after another.

<!-- legacy-names -->

- **The `designs` store (version 2).** Offline designs live in the `designs` object store of `livedesign-offline`.
  Opening version 2 moves every record from an older `diagrams` store into `designs` inside the upgrade transaction,
  then drops the old store, logging how many moved (`apps/live/lib/offline/legacy-offline-store.ts`;
  [Design](design.md#older-names-it-reads)). A tab asking for version 1 is refused by the browser once another tab
  has opened version 2, and reaches its offline designs after a reload.
- **Durability honesty (important).** An offline design has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly: on the design (see the badge, and its legend), in the Share dialog before a Sync, and in
  the help article. "Offline" means _yours only_, with the responsibility that
  implies.

<!-- /legacy-names -->

## What's different in an offline design

The design model (`Tab[]` + meta, per [Design structure](design-structure.md)) is **identical**: an offline
design is a normal design whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline design:

| Feature                                                               | Offline behaviour                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds                                                  | The header **Share** button stays visible, but for an offline design it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Live app](../007-editor/live-app.md), /54). |
| Live presence / realtime                                              | N/A: a private design never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                     |
| Teams / shared library                                                | Hidden: a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                              |
| Comments                                                              | Local-only (just you), stored in the design; no cross-user.                                                                                                                                                                                                                   |
| Duplicate                                                             | Makes **another offline design**; a copy never uploads what the user chose to keep local.                                                                                                                                                                                     |
| Folders                                                               | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                  |
| Tab linking ([Tab ↔ design many-to-many](tab-design-many-to-many.md)) | Unavailable in either direction: linked tabs are one shared server row.                                                                                                                                                                                                       |
| Thumbnails                                                            | The **browser it lives in**, on a wash of the accent of the app that owns it (the Explorer's `LocalPreview`), never the pill's teal, since there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                        |
| Images                                                                | **Embedded locally**; see below.                                                                                                                                                                                                                                              |

**Images embed locally ([Image element + per-owner gallery](../009-elements/images.md)).** In a cloud design, an added image uploads
to R2 and is referenced by URL. In an offline design it can't, so an image is
stored **inline as a `data:` URI** inside the design. Rendering is unchanged
(`<img>` reads a data URI fine). This costs local storage, which is the accepted
trade for staying fully offline. (Conversion re-homes images; see below.)

Autosave still runs for an offline design ([Per-tab storage](per-tab-storage.md)): it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## Instant open

A design in This Browser lives in this browser, so opening it waits on nothing the
server says. The editor bootstrap ([Dedicated route for new-design creation → In-place handoff](../007-editor/new-design-route.md#in-place-handoff-to-the-editor),
`app/design/[id]/useIdentityBootstrap.ts`) takes an **early open** when, before
auth has settled, the path names a design registered in the local index
(`isOfflineId`). Share links, embeds and workbenches always wait for auth.

- The early open does **not wait for auth to settle**, mint a guest id or fetch
  the participant. It reads the design from IndexedDB and paints it under the
  `'self'` placeholder participant.
- **Owner-scoped work waits for the real reader.** Under `'self'`, nothing is
  read or written as an owner: the participant record is not saved, preferences
  stay local (`writeUserPreferences`), and the
  recent images and Explorer lists load only once the reader is known. Sync
  Design from the Share dialog waits too (the gate's `ready`).
- **The reader resolves in the background** once auth answers, exactly as a
  cloud open resolves it (`resolveParticipant` in
  `app/design/[id]/resolve-participant.ts`: the account id or the guest token's id,
  then the profile), followed by the Explorer lists and the guest naming
  nudge. The design is not reloaded: an offline design is the reader's own
  whoever they turn out to be.
- **`/new` does not wait either.** For a guest ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers))
  creating This Browser, the create writes to IndexedDB and hands off without
  waiting on auth, the guest id or the participant, which resolve in the
  background (`commitNewDesign` in `app/new/page.tsx`).
- The editor reads back the record `/new` has just written rather than taking
  the tabs across in memory: the read is one IndexedDB get, small beside the
  waits removed, and keeps one load path.

**Measured** against production builds of `main` and of this change, served the
same way with the local api (headless Chromium, 10 runs each, interleaved; a
fresh browser profile per first visit), guest create to first canvas paint:

| Link           | Before (cloud) first / return | After (This Browser) first / return | API requests |
| -------------- | ----------------------------- | ----------------------------------- | ------------ |
| `/new?blank=1` | 3,076 / 1,803 ms              | 1,053 / 834 ms                      | 20 → 1       |

The one request left is `GET /api/capabilities`; the guest id, participant and
Explorer lists follow after the paint.

## Warm open of a cloud design

A cloud design waits on three things in a row before it paints: auth settling, the
participant ([`resolveParticipant`](#instant-open)) and the tab fetch. In livediagram about a
third of opens took over 4 s (telemetry, its load timing, October 2026), and every
editor loads the same way. A cloud design this
browser has opened before can paint at once from **the last copy seen**, the way Linear,
Figma and Notion show their last synced copy and catch up in the background
(Work Tracker 890).

**The last copy seen.** Each time a cloud design opens by its own address or by a share
link, the editor keeps what that load answered in this browser: the design's meta (name,
tab list, owner fields), the first tab's body and revision, and how the reader came in (the
role, the owner's chrome, the share code the address carried and the tab a tab-scoped link
opens). It lives in its own IndexedDB database (`livedesign-last-seen`), never on the
server.

- **Per reader.** A copy is keyed by who read it: the account id, or the guest's id. It is
  read back only for that reader, and every load drops the copies any other reader left,
  so a browser holds one reader's copies at most (a sign-out in another app, or a second
  account, empties the rest on the next load).
- **Cleared on sign-out.** Signing out, and deleting the account, empties the store before
  the sign-out hop.
- **Lost access forgets.** A load that ends on not found, on the deleted card or behind a
  share password removes that design's copy. A load that cannot reach the server keeps
  it.
- **Follows the design.** While the design is open its copy keeps up with what the reader
  sees: the name and the tab list each time they change (a rename, a tab added, moved or
  deleted, by the reader or by a peer), and the first tab's body each time one of the
  reader's own saves of it lands, with the revision that save wrote. A Viewer's or a
  Participant's copy keeps the first tab it opened with (their changes are not tab saves);
  the catch-up brings the rest. Refreshes are gathered into at most one write every 2
  seconds, made off the editing path, so they never hold up a save or a keystroke; a
  waiting one is written at once when the page is hidden or closed. Only a copy the open
  kept is followed, for the same reader: an embed, a Community post or a This Browser design
  never gains one, and a design taken offline to This Browser drops its copy.
- **Bounded.** At most 20 copies, the oldest seen dropped first; a copy over 1,000,000
  characters of JSON is not kept (a bigger design opens as it does today); a copy older
  than 30 days is never read. Embeds, Community posts, workbenches and This Browser
  designs keep none.

**The warm open.** Before auth settles, an address naming a cloud design with a copy for
the reader this browser expects paints that copy under the `'self'` placeholder, read-only.
The reader expected is the guest token's id, or, when the signed-in hint says this browser
is signed in, the account whose copies the store holds (it holds one reader's at most). A
signed-out browser, or one whose guest is someone else, never reads an account's copy. A
share link warm-opens only when its share code is the one the copy was kept under: by an address that names the design, or by the link's own address (`/design/shared?s=<code>`, as the Share dialog gives it), which names no design and finds the reader's newest copy kept under that code, for the same reader rules. The warm open leaves the address as it is (the load that catches up names the design in the bar, as it always has). Embeds, workbenches and This Browser designs never
warm-open, and a copy whose first tab is not the tab this open would show first (no first
tab kept, or the address's `#t=` names another tab) is not painted: the design opens as it
always did.

- **Edits wait for the participant.** The warm paint runs as a Viewer: every edit control is
  disabled with the usual read-only look, and nothing is saved, the room does not connect and
  no request goes out under the placeholder, until the reader resolves and the fresh copy
  lands. A stored role never widens what the reader may do.
- **A load that starts first still lets it paint.** A guest's sign-in answers from this browser almost
  at once, so the load often starts before the copy is read. The copy still paints until the load
  begins to show what it fetched (or finds someone else reading), and the load then replaces it.
- **The ordinary load catches up** behind it, unchanged: auth, the participant, the
  design and the first tab. Its answer replaces the copy in place (the same tabs by id,
  no opening screen between, nothing typed to lose because editing waited) and its role
  applies: a Viewer stays read-only, a Participant gets a Participant's tools, an Editor
  can edit. A first tab whose revision is the one the copy holds keeps the painted tab as it
  is, so an unchanged canvas is not drawn again.
- **Someone else after all.** When the reader resolves to someone other than the copy's
  (a hint that outlived its session), the copy goes from the screen at once for the opening
  screen, and the load opens the design for whoever is reading.
- **Lost access on catch-up** swaps the copy for the screen the load ends on (not found,
  the deleted card, the password gate) and forgets the copy; a share link's copies go by its code
  too, as its own address names no design. A load that cannot reach the
  server ends on its error screen and keeps the copy.
- **Never a wrong not found.** A load that ends on not found after a warm paint is checked once by an
  ordinary open: the copy is forgotten and the page reloads, cold. A session that answered late or settled
  as a guest (so the design's owner read as someone else) gets a fresh start, and only that cold open's not
  found ever shows. Once per design per browser tab session, so a design that really is gone costs one
  reload, never a loop; the console says why (`[load] warm-open-fallback <reason>`).
- **The tab title** names the design from the warm paint on, and comes back if the framework rewrites the
  page's title after it (the static export's not-found route sets its own).
- **Other tabs wait for the load.** The copy holds the first tab's body only: moving to
  another tab during the warm paint shows the tab loader, never a blank canvas, and the
  catch-up keeps the tab the reader moved to (when the design still has it and the link's
  tab scope allows it) instead of going back to the first.
- **The view lands once.** The painted tab is fitted as it paints, so a catch-up that keeps its
  body does not fit it again and the view does not jump. A copy older than the server's (a save
  that landed after the copy was last written) is replaced by the catch-up, and the tab is fitted
  again on what it now holds, so content the copy did not have is never left off screen.
- **Another browser tab** of the same design warm-opens from the same copy; its room connects
  once its own load lands, as always.
- `DesignLoad` keeps timing the fresh copy's first frame; the warm paint is timed on its own, as
  the performance measures `warm-paint` and `warm-catch-up` (from the same start as
  `DesignLoad`), and in the field as the `WarmPaint` timing (from the same start, to the warm paint's
  first frame).

**Built so far.** Part 1 keeps, bounds and clears the copies (`createLastSeenCopies` in
`@liveworkspace/workbench/lib/api/last-seen-copies`), part 2 keeps each one following the
open design (`createLastSeenFollower`, `useLastSeenFollow`), and part 3 paints it
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
is the same. `WarmPaint` (timing telemetry) now times the warm paint in the field, beside `DesignLoad`.

**Measured** (headless Chromium, 25 runs each, median / p95): keeping a copy and reading it
back cost about a millisecond against the seconds the warm open saves.

| First tab      | Copy size | Stringify    | Write        | Open and read | Parse        |
| -------------- | --------- | ------------ | ------------ | ------------- | ------------ |
| 50 elements    | 12 KB     | 0.0 / 0.1 ms | 0.3 / 3.4 ms | 0.2 / 1.2 ms  | 0.0 / 0.1 ms |
| 500 elements   | 120 KB    | 0.2 / 0.3 ms | 0.3 / 1.5 ms | 0.2 / 0.8 ms  | 0.1 / 0.2 ms |
| 2,000 elements | 480 KB    | 0.7 / 0.7 ms | 0.7 / 3.4 ms | 0.5 / 2.2 ms  | 0.5 / 0.6 ms |

## Archived in This Browser

A design in This Browser can be moved to Archived from the Explorer's menu, like an account's. Nothing leaves the
browser: the mark (`archivedAt`) lives only in This Browser's shared list (`@liveworkspace/explorer/this-browser`),
and every rewrite of the list carries the marks it held. Before the editor opens a design it reads the mark once
(`isThisBrowserArchived`), and an archived one shows the **Design Archived** card in place of the design
([Archived](../007-editor/new-design-route.md#archived)), whether or not the early open would have taken it. Change Folder moves it out,
back into This Browser's list.

## "This Browser" badge + Explorer

- **Editor header badge.** The status pill reads Private / Shared / Team
  (the `SharedBadge` in `EditorHeader`). For an offline design it reads
  **"This Browser"** (a state that supersedes "Private" for these designs),
  matching the [This Browser pill](#this-browser-pill): the same words, the same
  browser-window icon, the same teal tone and contrast, and the same sentence,
  "Lives only in this browser. Clearing this browser's site data deletes it.",
  shown in the badge's visibility legend on hover and focus and given to
  assistive technology as the badge's description. It stays a status, not a
  link: the legend explains it in place.
- **The visibility legend** (`VisibilityLegend`, on the badge's hover and focus, closing 120 ms after the
  pointer leaves): a hero in the current state's tone, eyebrow **Who Can See This**, the state's icon and
  name, its sentence, and its **reach** drawn as rings around you, lit out to how far the design goes
  (Private: none; Shared: one, with people on it; Team: both); the words sit level with the
  rings, centred, and the hero keeps one height whichever audience it shows. Under it, the audiences on one
  scale, **Just you** (a lock), **Link** (a link), **Team** (people), the track filled to the current stop, which is larger, filled in its tone and
  bold. Hovering a stop shows that audience in the hero, eyebrow **If It Were**, and tints the stop;
  leaving the scale puts the current state back. **This Browser** (its browser-window icon, teal) stands
  apart below as "Or This Browser: never leaves this browser." (when current: "This Browser: saved only here,
  never on our servers.", tinted teal). For someone who may share, **Change Who Can See This** at the
  foot opens Share, and the badge itself is a button that opens Share; for anyone else it is a focusable
  pill and the legend has no button. For the eye only: the badge carries the current state's words for
  assistive technology.
- **Explorer.** The Explorer lists what liveworkspace's index holds, and offline designs never reach it. livedesign
  keeps a small list of them in this browser (id, title and dates, never their content,
  `@liveworkspace/explorer/this-browser`), which the Explorer on livedesign's own address reads: a **This Browser**
  sidebar row with their count, a view of its own (`/explorer/offline`), a This Browser group in the Trash and a
  place in Home's Most Used and Recent, each with the **This Browser** pill (below), opening in the editor. Each live row has
  **Sync Design** for a signed-in person. The editor's Explorer panel has This Browser on its rail too, with the count, shown while
  this browser holds at least one, opening its pane in place, **Sync Design** run there for a signed-in person
  (`hooks/persistence/useThisBrowserHost.ts`). `/offline`, the old This Browser page, only redirects to
  `/explorer/offline`, its query kept.
- **Home.** An offline design's opens are counted in its own local record, never
  sent anywhere, so Home's Most Used and Recent places it among the reader's other
  designs by the same rule, with the **This Browser** pill on its thumbnail
  ([Explorer Home](../013-workspace/explorer-home.md#opens)).
- **Inbox.** The Inbox reads offline designs in the browser and lists their open actions and comment
  threads among the cloud ones, each row with the **This Browser** pill
  ([Inbox](../013-workspace/inbox.md) "This Browser").

### This Browser pill

Every row and card of an offline design carries a **This Browser** pill,
wherever the design is listed: the list and card views (folders, Search results,
This Browser, Recent, Favourites), Home's Most Used and Recent, the Inbox's rows, the folder previews' tiles excepted (they
are pictures, not rows), the search panel's results, the editor's Explorer
rows and its Current Design card, and the Trash.

- **Not colour alone.** The pill shows an icon (a browser window) and the words
  "This Browser", in a teal tone whose text meets 4.5:1 on its fill in light and
  dark mode; the ring meets 3:1 against the row. Teal because it is no app's accent
  (livediagram sky, liveplanner violet, livedocuments amber, livedesign rose, liveworkspace
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
  Where the row is itself a single control (a search result, the panel's
  Current Design row, an Inbox row), the pill is a plain label inside it, carrying the same
  description: a link cannot sit inside a button. In a tree (the editor's
  Explorer), the pill is a link out of the tab order, since the tree owns
  the one tab stop, and the row itself carries the description. The Trash row's
  pill is a link like any other.
- **It replaces the "Offline" visibility badge** in the Explorer's lists: an
  offline design shows the pill beside its name at every width, and its
  visibility column stays empty.

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog (below), and after signing in by
the move prompt ([Auth + guest access → Moving designs in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-designs-in-this-browser-after-signing-in)).

On a fresh, unshared design's start screen the **Sync Design to Server** switch moves it either way, in place and with no confirmation ([Save Locations → On the start screen](save-locations.md#on-the-start-screen)).

### Sharing a design in This Browser

Share is how most people find out a design needs the server. Pressing it never
uploads anything by itself; the dialog explains and asks, for a guest and a
signed-in person alike:

- **The gate.** Share on a design in This Browser opens the Share dialog on its
  offline gate (`ShareOfflineGate`): **This Design Is in This Browser**, "It is saved only
  in this browser, so there is nothing to share yet. Sync it to livedesign to
  share it: share links, real-time collaboration and the live image all need it
  on our servers. You can take it offline again any time.", with **Sync Design**
  and Cancel.
- **Sync Design** syncs the open design **in place** (below): the button shows
  **Syncing…** with a spinner, then a toast confirms "Synced. Your design is on
  livedesign now." and the same dialog shows the share options. No reload, no
  second press of Share. A guest's upload is owned by the guest id like any guest
  cloud design.
- The button waits for the reader to be known (an early open runs under the
  `'self'` placeholder, [Instant open](#instant-open)).
- A failed sync keeps the design This Browser, says why in a toast
  (`syncFailureMessage`) and leaves the button to try again; nothing is
  half-uploaded (see below).

### Syncing in place

Sync Design from inside the editor (`useSyncInPlace` in
`app/design/[id]/useSyncInPlace.ts`) converts the open design without a
reload:

1. **It waits for this browser's last save** to land (`hasUnsavedChanges`), up to
   `SYNC_SAVE_WAIT_MS` (5 s), so the record it uploads is what is on screen and no
   save lands in a record about to be deleted. Past that it refuses with
   `SyncStillSavingError` ("Still saving this design. Try again in a moment.").
2. **It uploads** with `saveOfflineToCloud`, which returns the images it re-homed
   (data URI → gallery id).
3. **The offline index announces the move** (`subscribeOfflineIds` in
   `lib/offline/offline-store.ts`, told on every create, sync and Take Offline).
   What reads offline-ness follows it: the header badge and every
   `useIsOfflineDesign` (so the Share dialog swaps the gate for its options).
4. **The open tabs' images are re-pointed** at their gallery copies, in the editor
   and in its last-saved copy, so the next save does not write the data URIs back.
5. **The room opens** (`designServerStored` turns true) and the Explorer list
   refreshes.

The Explorer panel's Sync and Take Offline (an item's menu, This Browser's rows) never reload either: the
design open in the editor moves in place as above, any other moves on its own, and the Explorer loads its lists again
once the move settles. Only the move prompt after signing in still reloads, since several move at once.

### Taking offline in place

Take Offline from the start screen's **Sync Design to Server** switch
([Save Locations → On the start screen](save-locations.md#on-the-start-screen)), `useTakeOfflineInPlace` in
`app/design/[id]/useTakeOfflineInPlace.ts`, converts the open design without a reload and without the confirmation: the
switch only shows on a fresh design nobody else has, so there is nothing to lose.

1. **It waits for this browser's last save**, as a sync in place does (`SYNC_SAVE_WAIT_MS`, then
   `SyncStillSavingError`).
2. **It closes the room first** (`designServerStored` turns false), so the server delete's echo never reaches the open
   editor as a deletion. A failure opens it again and the design stays on the server.
3. **It takes the design offline** with `takeCloudOffline`, exactly as Take Offline below.
4. **The offline index announces the move**: the header badge and every `useIsOfflineDesign` follow, and every later save
   goes to IndexedDB by the design's id.
5. **The template-pick note is dropped** (a template picked now has no server folder to go to), the move prompt after
   signing in is told the design stays here, and the Explorer list refreshes.

### Save to server (Offline → Cloud)

Action: **"Sync Design"** (one name everywhere: the design menu and This Browser's rows in the editor's Explorer panel,
the Explorer's This Browser view, the Share dialog gate and the move prompt after signing in).

- Uploads the design's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud design owned by the current identity (signed-in account, or the liveworkspace
  guest if not signed in; [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Images re-home:** each embedded `data:` URI is uploaded to the gallery
  (SHA-256 dedupe server-side, [Image element + per-owner gallery](../009-elements/images.md)) and the element's reference swaps to
  the returned R2 id, so the cloud copy carries real gallery images instead of
  bloated tab JSON. A failed transfer keeps the data URI (it still renders
  anywhere); the per-tab byte cap surfaces a hard failure to the caller.
- **Everything on the record travels**, not just tabs: the created date, the folder (kept only when it is one of the
  caller's own personal folders, else the root of My Work) and the star ([Favourite designs](../013-workspace/favourites.md)). The
  local copy is deleted next, so anything the create leaves behind is gone.
- **A refused folder lands at the root, on the sync's say-so.** The create carries the folder as
  its placement ([Folders → Placement on create](../013-workspace/folders.md#placement-on-create)),
  and the server refuses a folder deleted since, or not the caller's, by name rather than
  filing it elsewhere. On `folder_not_found` or `folder_scope_mismatch` the sync creates the
  design again at the root of My Work and logs `[offline-sync] placement refused reason=<code>, filed at root`;
  any other failure fails the sync and keeps the local copy.
- **A forked tab comes back as its own tab.** The create never writes into a tab
  another design holds: a seeded tab whose id is already taken outside this
  design is created under a fresh id, and the design's tab / element links
  follow it. So a tab that forked on Take Offline returns as a new
  tab beside the original rather than overwriting it; joining them again is an
  explicit "Add to Design". A retried create (the tab already in this design)
  keeps its ids.
- **What went up is what is removed.** The upload takes seconds and the design
  stays editable meanwhile (here or in another tab). The local copy is removed only if
  it still matches what was uploaded (its save time), checked and deleted in one transaction. If it changed, the cloud
  copy is taken back (a raw delete declared as a move into this browser, so it skips
  the Trash) and the newer record is uploaded again, logged
  `[offline-sync] changed-during-upload attempt=<n>`; after three uploads that each
  went stale the sync stops, keeps the local copy and says the design kept changing.
- **One conversion per design at a time.** A second Sync Design or Take Offline
  of a design while one runs (a second menu, or the Share gate) does nothing; the
  guard lives with the conversion, not with the menu that started it, which closes.
- On success the **local copy is removed** from IndexedDB so there's one source
  of truth; the design is now a cloud design (Share / Teams reappear). The
  id is unchanged, so the route stays the same: from the Share dialog the editor
  turns into the cloud design in place ([Syncing in place](#syncing-in-place));
  from the Explorer panel it moves without a reload too.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**, on a design's menu in the editor's Explorer panel (the shared Explorer's
`itemMenu`, `hooks/persistence/useOfflineItemMenu.tsx`: only a page on this app's origin reaches the browser's
store) and in the Explorer on livedesign's address, which hands it to the editor at the design's own address
(`/design/<id>?convert=take-offline&item=<id>`, `components/dialogs/ConversionHandoff.tsx` over `hooks/persistence/useConversionHandoff.ts` and the shared `@liveworkspace/explorer/conversion-handoff`): the editor checks the design
is the person's to move, then asks the same confirmation. It is offered on a design the person can edit in their library or a team's, never on one reached
through a link. This is **destructive on the server** and gated by a
confirmation:

- **Confirmation** warns clearly: _"This removes it from your account and every
  other device. It will exist only in this browser, with no backup."_ When the
  design has shared tabs, the shared-tab notice follows (see below).
- On confirm: download the design's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **This Browser**. Referenced R2 images are downloaded and embedded
  as `data:` URIs BEFORE the server copy is deleted (the deletion would make
  them "unused" and the retention reaper would eventually take the bytes); an
  incomplete embed aborts the conversion and the design stays on the server.
- **The star and personal folder come along** for the same reason: the
  server row they live on is about to be deleted. The star is read from the account's
  favourites; if that read fails the conversion aborts before anything is written,
  rather than taking the design as unstarred and losing the star with the row. A team design's folder is a
  team folder, which has no place in the personal tree, so it lands at the root of My Work.
- **Shared tabs fork.** A tab also linked into other designs
  ([Tab ↔ design many-to-many](tab-design-many-to-many.md)) is not taken
  away from them: the server delete keeps it there whole, history included, and
  the offline copy holds its own copy of the content. From then on the two are
  independent; an edit on either side never reaches the other. The
  confirmation says so up front (see [Shared-tab notice](tab-design-many-to-many.md#shared-tab-notice)).
- **Every tab, or nothing.** If any tab fails to download the conversion aborts
  before anything is written locally and before the server delete, so the cloud
  copy stays authoritative. This is the one failure in this direction that
  nothing could undo: a partial download followed by the server delete leaves
  the missing tab's elements nowhere at all, while reporting success. A tab read
  can come back empty from two directions (a failed request, or a 404 that the
  api client maps to `null` rather than an error), and both count as failure
  here. (The best-effort "keep what loaded" shape is right for _duplicating_ a
  design, where the source survives; it inverts once the source is destroyed.)
- **If that server delete fails, the local copy is rolled back** and the error
  surfaces. Both copies registered under one id would shadow the live cloud
  design behind a stale offline fork (and duplicate the Explorer row), so the
  conversion is all-or-nothing in this direction too. Data-safe either way: the
  server still holds everything, and the user can retry. The rollback is
  best-effort, but a rollback that itself fails still reports the original
  delete failure rather than a success.
- **Take Offline bypasses the [Trash](../013-workspace/trash.md)** for the design's owner: it is a move, not a delete, so the server copy goes at once. A joined teammate taking a team design offline sends the team's copy to the team Trash instead, since from the team's side it is a deletion.
- **Deleting an offline design removes it for good** (the Explorer asks first; nothing else holds it, and the local Trash is gone). Deleting the design open in the editor tombstones it first (`lib/design-tombstones.ts`), so neither the autosave nor the unload flush writes it back, then removes the IndexedDB record and leaves for the Explorer, as deleting an open cloud design does (`@liveworkspace/workbench/lib/this-browser-remove`, shared by every editor). The confirmation says it deletes only this browser's copy, the only one, and that nothing in the account changes ("Delete this design from this browser?", `thisBrowserDeleteCopy` in `@liveworkspace/explorer/this-browser`). The panel deletes in place; the Explorer page asks the same on the page, then hands the delete to the editor at the design's own address (`/design/<id>?convert=delete&item=<id>`, `components/dialogs/ConversionHandoff.tsx`), which deletes it without asking again (the page's note in session storage) and goes back to `/explorer/offline`; the same link without that note asks first. Sync Design removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ design offline
  first revokes those (a share/team design can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline design is browser-local regardless of
  account: a signed-in user's offline designs do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** design ([Auth + guest access](../014-identity/auth-and-guest-access.md)): a guest's cloud design is
  anonymous but still on the server (keyed by the browser's participant id);
  an offline design never touches the server at all.
- Sign-in / sign-out never migrates offline designs by itself (the migrate flow, [Auth + guest access](../014-identity/auth-and-guest-access.md),
  only moves guest _cloud_ designs to the account). After signing in, a prompt
  **offers** to move them ([Moving designs in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-designs-in-this-browser-after-signing-in));
  a design the person leaves stays put.
- The "This Browser" badge and pill read the same for a guest as for anyone: the
  sentence about clearing site data is the one a guest most needs to see.

## Persistence architecture

The editor already has a **single persistence boundary**: `apps/live/lib/api-client.ts`
(a barrel over `lib/api/*`); nothing in the editor calls `fetch` directly. Offline
Mode is implemented **behind that boundary** so the editor is unaware of the
target:

- **One store, bound per editor.** The store's operations (the write chain, the one-transaction updates, the
  reads, the Trash and favourite rules, Sync Canvas's delete-if-unchanged) are one copy every editor shares
  (`@liveworkspace/workbench/lib/offline/offline-store-core`). `lib/offline/offline-store.ts` binds it with its
  IndexedDB backend, whose database and store names and versions stay this editor's own, and keeps its own
  extra writes.
- **Dispatch per call, not a backend pair.** Each load / save / delete in
  `lib/api/*` opens with `if (await isOfflineId(id))` and hands off to
  `lib/offline/offline-store.ts`, otherwise it calls the api. There is no second
  class to keep in step with the first, and an endpoint that offline has no
  answer for never grows the branch.
- Offline ids are client-generated (`crypto.randomUUID`) and registered in a
  local index; `isOfflineId` reads it. The `beforeunload` beacon flush cannot
  await, so it uses the synchronous `isOfflineIdSync` off the loaded cache.
- **Listing is the exception that is not a dispatch.** The Explorer shows both
  sets at once, so it MERGES the api list with the local one, and still returns
  the offline rows when the cloud fetch fails.
- **Create is the one caller-decided branch**, because there is no registered id
  to dispatch on yet: `/new` calls `offlineCreateDesign`
  directly when the location is This Browser (a guest's default), and
  that call is what registers the id every later operation routes on.
- Only the design/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  design (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page, with no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** A guest's design is saved only in your browser: no account, no server,
> no sync. Yours alone. Move it to the cloud (or pull one back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a design
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([Help app](../018-help/help-app.md))

The help centre has an **"Offline Mode"** article, registered in the help registry
([Register a help article](../../instructions/register-a-help-article.md)). It covers:

- What Offline Mode is and when a design is made in This Browser ([Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data: the durability warning, stated plainly.
- **Converting**: "Sync Design" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration and teams.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Adoption is tracked without content, in the closed vocabulary:

- On create, `Document`/`Created` with type `Offline` or `Cloud`.
- The move prompt after signing in: `UI`/`Opened`/`LocalMovePrompt` when it
  shows, `UI`/`Selected`/`LocalMovePrompt` on Move, `UI`/`Closed`/`LocalMovePrompt`
  on Not Now. Each design it moves also sends the conversion event below.
- On conversion, a coarse event for each direction, so uptake and the
  destructive take-offline path are visible: `Document`/`Moved` with type
  `SavedToCloud` or `TakenOffline`, emitted after the conversion succeeds: from
  the shared `useOfflineConversion` handlers, from `useSyncInPlace` for the
  Share dialog, and per design from the move prompt.
- No design content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline designs**: that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing**: offline is single-user by nature.
- **Not** offline-resilience for cloud designs (editing a cloud design through
  a network blip); that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion**: a design never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action (pressing Share,
  Sync Design, or Move on the prompt after signing in).

## Implementation map

- `apps/live/lib/api-client.ts` + `lib/api/*`: the persistence seam; per-design
  dispatch via the local index (`lib/offline/offline-ids.ts`) to `lib/offline/offline-store.ts`.
- `/new` (`app/new/page.tsx`, [New design route](../007-editor/new-design-route.md)): `offlineCreateDesign` for a
  This Browser create.
- `EditorHeader` (`SharedBadge`): the **This Browser** badge state.
- Explorer (row + card components, `ThisBrowserPill`): merge the local index,
  show the **This Browser** pill wherever an offline design is listed plus a
  fixed offline thumbnail everywhere, and skip server fetches for offline rows.
- Guest default + instant open: `lib/save-locations.ts` (`defaultSaveLocationFor`),
  `lib/signed-in-hint.ts`, `app/new/useNewDesignLocation.ts`, the early open in
  `app/design/[id]/useIdentityBootstrap.ts` with `app/design/[id]/resolve-participant.ts`.
- Share's offline gate and syncing in place: `components/dialogs/ShareOfflineGate.tsx`,
  `app/design/[id]/useSyncInPlace.ts`, `subscribeOfflineIds` in `lib/offline/offline-store.ts`.
- The move prompt after signing in: `components/dialogs/LocalMovePrompt.tsx`,
  `hooks/persistence/useLocalMovePrompt.ts`, `../packages/workbench/src/lib/offline/local-move-dismissal.ts`.
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Design" and "Take Offline" (with confirmation + image re-homing).
- Image handling ([Image element + per-owner gallery](../009-elements/images.md)): embed `data:` URIs offline; upload-on-save,
  download-on-take-offline.
- `apps/marketing`: the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `apps/help`: the "Offline Mode" article + its `articles.ts` registry entry
  ([Help app](../018-help/help-app.md)).
- Telemetry: the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Open source + distribution](../002-project-scope/open-source-and-business-model.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Design structure](design-structure.md) (design model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[New design route](../007-editor/new-design-route.md) (`/new`),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Image element + per-owner gallery](../009-elements/images.md) (images),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime, the separate concern),
[Save Locations](save-locations.md) (where a new design is stored).
