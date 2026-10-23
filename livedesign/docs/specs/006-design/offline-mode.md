# Offline Mode

**Offline Mode** lets you create a design that is saved **only in the current
browser** — never to the API, never to the server. It is the default for a guest's
new design ([Auth + guest access → Guest designs start local](../014-identity/auth-and-guest-access.md#guest-designs-start-local))
and an opt-in choice for everyone else. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a design that physically never leaves
their machine. It also reinforces the OSS promise ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a design**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ design is
a separate concern — see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) — and out of scope here.)

Tab bodies are stamped with their **tab kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire` — the two stores must agree about what a tab IS, or a Sync Design would hand the cloud a board that has forgotten itself.

## Turning it on

Offline Mode is **on by default for a guest and off by default for a signed-in person**
([Save Locations → The default depends on who is creating](save-locations.md#the-default-depends-on-who-is-creating)).
Nobody is asked when creating a design; the default decides:

- The **New Design** wizard ([Dedicated route for new-design creation](../007-editor/new-design-route.md#one-step-wizard))
  asks only for a mode and creates the design in the default location for who is creating
  ([Save Locations](save-locations.md)): **This Browser** for a guest, **livedesign** for a signed-in person.
  Either moves later: **Take Offline** moves a cloud design into This Browser, **Sync Design** puts one in This Browser on
  livedesign.
- The links that create without the wizard (`/new?template=`, `/new?blank=1`,
  [Dedicated route for new-design creation → Start Blank](../007-editor/new-design-route.md#start-blank-skip-the-wizard))
  take the same default, so a guest following a template from the landing page
  gets a design in This Browser.
- The location only changes _where the design is stored_; the mode, templates and theme work identically.

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
'remove', id }`), which apply it at once. Without it, a tab that missed a Take
  Offline kept saving that design to the server (where it no longer is), and a tab
  that missed a Sync Design or purge kept "saving" into a record that was gone.
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

- **Store rename (version 2).** Offline designs were kept in the `diagrams` object store until
  the container became a design ([Design](design.md#renaming-from-diagram)). Opening
  version 2 of `livedesign-offline` moves every record into `designs` inside the upgrade
  transaction, then drops the old store, logging how many moved
  (`apps/live/lib/offline/legacy-offline-store.ts`). A tab still running the code from before the upgrade
  asks for version 1, which the browser refuses once another tab has opened version 2; its offline
  designs are out of reach in that tab until it reloads.
- **Durability honesty (important).** An offline design has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly — on the design (see the badge, and its legend), in the Share dialog before a Sync, and in
  the help article. "Offline" means _yours only_, with the responsibility that
  implies.

<!-- /legacy-names -->

## What's different in an offline design

The design model (`Tab[]` + meta, per [Design structure](design-structure.md)) is **identical** — an offline
design is a normal design whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline design:

| Feature                                                                   | Offline behaviour                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds                                                      | The header **Share** button stays visible, but for an offline design it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Live app](../007-editor/live-app.md), /54). |
| Live presence / realtime                                                  | N/A — a private design never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                    |
| Teams / shared library                                                    | Hidden — a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                               |
| Comments                                                                  | Local-only (just you), stored in the design; no cross-user.                                                                                                                                                                                                                   |
| AI assistance                                                             | Works online — it reads the current canvas, not the stored design ([AI Assistance](../007-editor/ai-assistance.md)); only a lost connection stops it.                                                                                                                         |
| Duplicate                                                                 | Makes **another offline design** — a copy never uploads what the user chose to keep local.                                                                                                                                                                                    |
| Folders                                                                   | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                    |
| Tab linking ([Tab ↔ design many-to-many](tab-design-many-to-many.md)) | Unavailable in either direction — linked tabs are one shared server row.                                                                                                                                                                                                        |
| Thumbnails                                                                | A fixed **offline illustration** in the Explorer — there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                                                                                                                  |
| Images                                                                    | **Embedded locally** — see below.                                                                                                                                                                                                                                               |

**Images embed locally ([Image element + per-owner gallery](../009-elements/images.md)).** In a cloud design, an added image uploads
to R2 and is referenced by URL. In an offline design it can't — so an image is
stored **inline as a `data:` URI** inside the design. Rendering is unchanged
(`<img>` reads a data URI fine). This costs local storage, which is the accepted
trade for staying fully offline. (Conversion re-homes images — see below.)

Autosave still runs for an offline design ([Per-tab storage](per-tab-storage.md)) — it writes to IndexedDB
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
  stay local (`writeUserPreferences`), and the custom themes,
  recent images and Explorer lists load only once the reader is known. Sync
  Design from the Share dialog waits too (the gate's `ready`).
- **The reader resolves in the background** once auth answers, exactly as a
  cloud open resolves it (`resolveParticipant` in
  `app/design/[id]/resolve-participant.ts`: the Clerk id or signed guest id,
  then the participant row), followed by the Explorer lists and the guest naming
  nudge. The design is not reloaded: an offline design is the reader's own
  whoever they turn out to be.
- **`/new` does not wait either.** For a guest ([Who is a guest, before Clerk answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-clerk-answers))
  creating This Browser, the create writes to IndexedDB and hands off without
  waiting on auth, the guest id or the participant, which resolve in the
  background (`commitNewDesign` in `app/new/page.tsx`).
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

## "This Browser" badge + Explorer

- **Editor header badge.** The status pill reads Private / Shared / Team
  (the `SharedBadge` in `EditorHeader`). For an offline design it reads
  **"This Browser"** (a state that supersedes "Private" for these designs),
  matching the [This Browser pill](#this-browser-pill): the same words, the same
  browser-window icon, the same amber tone and contrast, and the same sentence,
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
  leaving the scale puts the current state back. **This Browser** (its browser-window icon, amber) stands
  apart below as "Or This Browser: never leaves this browser." (when current: "This Browser: saved only here,
  never on our servers.", tinted amber). For someone who may share, **Change Who Can See This** at the
  foot opens Share, and the badge itself is a button that opens Share; for anyone else it is a focusable
  pill and the legend has no button. For the eye only: the badge carries the current state's words for
  assistive technology.
- **Explorer.** Offline designs appear in Recent (and the other lists)
  alongside cloud designs, each with the **This Browser** pill (below) and the
  fixed offline thumbnail, so a design in This Browser is recognisable at a glance.
  The Explorer view merges the API-fetched cloud list with the local index of
  offline designs; offline rows never trigger a server fetch (list, thumbnail,
  or otherwise).
- **The reader's own.** An offline design counts as one of the reader's own
  designs: Space `mine` and owner "You", like a design in My Work
  ([Explorer structure: designs in This Browser](../013-workspace/explorer-structure.md#designs-in-this-browser)).
- **Sidebar.** The full-page Explorer's **This Browser** row (the More group,
  [Explorer structure](../013-workspace/explorer-structure.md)) opens
  `/explorer/offline`, the list of every offline design, titled **This
  browser**; the row shows while this browser holds at least one.
- **Home.** An offline design's opens are counted in its own local record, never
  sent anywhere, so Home's Jump Back In places it among the reader's other
  designs by the same rule, with the **This Browser** pill on its thumbnail
  ([Explorer Home](../013-workspace/explorer-home.md#opens)).
- **Inbox.** The Inbox reads offline designs in the browser and lists their open actions and comment
  threads among the cloud ones, each row with the **This Browser** pill
  ([Inbox §2.6](../013-workspace/inbox.md#26-designs-in-this-browser)).

### This Browser pill

Every row and card of an offline design carries a **This Browser** pill,
wherever the design is listed: the list and card views (folders, Search results,
This Browser, Recent, Favourites), Home's Jump Back In, the Inbox's rows, the folder previews' tiles excepted (they
are pictures, not rows), the search panel's results, the editor's Explorer
rows and its Current Design card, and the Trash.

- **Not colour alone.** The pill shows an icon (a browser window) and the words
  "This Browser", in an amber tone whose text meets 4.5:1 on its fill in light and
  dark mode; the ring meets 3:1 against the row.
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
  visibility column stays empty. Minimal chrome keeps the words: the pill is a
  warning, not a teaching hint.

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog (below), and after signing in by
the move prompt ([Auth + guest access → Moving designs in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-designs-in-this-browser-after-signing-in)).

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

The Explorer's row menu and the move prompt after signing in still reload after a
sync: the design there is not the one on screen, or several move at once.

### Save to server (Offline → Cloud)

Action: **"Sync Design"** (one name everywhere: the Explorer row menu, the
Share dialog gate and the move prompt after signing in).

- Uploads the design's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud design owned by the current identity (signed-in account, or the guest
  `X-Owner-Id` if not signed in — [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Images re-home:** each embedded `data:` URI is uploaded to the gallery
  (SHA-256 dedupe server-side, [Image element + per-owner gallery](../009-elements/images.md)) and the element's reference swaps to
  the returned R2 id, so the cloud copy carries real gallery images instead of
  bloated tab JSON. A failed transfer keeps the data URI (it still renders
  anywhere); the per-tab byte cap surfaces a hard failure to the caller.
- **Everything on the record travels**, not just tabs: the slide deck
  ([Presentation mode](../012-collaboration/presentation-mode.md)), the created date, the folder (kept only when it is one of the
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
  design is created under a fresh id, and the design's tab / element links and
  deck slides follow it. So a tab that forked on Take Offline returns as a new
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
  of truth; the design is now a cloud design (Share / AI / Teams reappear). The
  id is unchanged, so the route stays the same: from the Share dialog the editor
  turns into the cloud design in place ([Syncing in place](#syncing-in-place));
  from the Explorer it reloads.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**. This is **destructive on the server** and gated by a
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
- **The deck, star and personal folder come along** for the same reason: the
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
  can come back empty from two directions — a failed request, or a 404 that the
  api client maps to `null` rather than an error — and both count as failure
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
- **Deleting an offline design moves it to this browser's local Trash** ([Trash](../013-workspace/trash.md), "The local Trash"): the IndexedDB record gains `trashedAt` and keeps everything else, leaves the lists and stars, refuses writes, and is purged 30 days later the next time the app lists designs or opens the Trash. Sync Design removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ design offline
  first revokes those (a share/team design can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline design is browser-local regardless of
  account — a signed-in user's offline designs do **not** appear on their other
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
  to dispatch on yet: the New Design wizard calls `offlineCreateDesign`
  directly when the location is This Browser (picked, or a guest's default), and
  that call is what registers the id every later operation routes on.
- Only the design/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  design (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page — no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Flip on Offline Mode when you create a design and it is saved only in
> your browser: no account, no server, no sync. Yours alone. Move it to the cloud (or pull one
> back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a design
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([Help app](../018-help/help-app.md))

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and — per the help-registry rule — **register it in
`apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Design wizard's Save
  location chooser, [Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data — the durability warning, stated plainly.
- **Converting**: "Sync Design" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration, teams, and AI.

Also add the standard contextual help link ([Contextual help links](../018-help/contextual-help-links.md)) from the New Design
wizard's data-loss warning to this article.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Track adoption without content, reusing the closed vocabulary:

- On create, distinguish the mode via the `type` on the existing
  `Design`/`Created` event (e.g. `Offline` vs `Cloud`).
- The move prompt after signing in: `UI`/`Opened`/`LocalMovePrompt` when it
  shows, `UI`/`Selected`/`LocalMovePrompt` on Move, `UI`/`Closed`/`LocalMovePrompt`
  on Not Now. Each design it moves also sends the conversion event below.
- On conversion, a coarse event for each direction, so uptake and the
  destructive take-offline path are visible: `Design`/`Moved` with type
  `SavedToCloud` or `TakenOffline`, emitted after the conversion succeeds: from
  the shared `useOfflineConversion` handlers before their reload (the telemetry
  engine's pagehide beacon carries it through), from `useSyncInPlace` for the
  Share dialog, and per design from the move prompt.
- No design content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline designs** — that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing** — offline is single-user by nature.
- **Not** offline-resilience for cloud designs (editing a cloud design through
  a network blip) — that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion** — a design never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action (pressing Share,
  Sync Design, or Move on the prompt after signing in).

## Implementation map

- `apps/live/lib/api-client.ts` + `lib/api/*` — the persistence-backend seam;
  new `LocalBackend` (IndexedDB) beside the existing API calls; per-design
  dispatch via a local index.
- New Design wizard (`TemplatePicker` / `template-picker-settings.tsx`,
  [Dedicated route for new-design creation](../007-editor/new-design-route.md)): the **Settings** step's Save location chooser ([Save Locations](save-locations.md), the
  This Browser tile) + data-loss warning + contextual help link.
- `EditorHeader` (`SharedBadge`) — the **This Browser** badge state.
- Explorer (row + card components, `ThisBrowserPill`): merge the local index,
  show the **This Browser** pill wherever an offline design is listed plus a
  fixed offline thumbnail everywhere, and skip server fetches for offline rows.
- Guest default + instant open: `lib/save-locations.ts` (`defaultSaveLocationFor`),
  `lib/signed-in-hint.ts`, `app/new/useNewDesignLocation.ts`, the early open in
  `app/design/[id]/useIdentityBootstrap.ts` with `app/design/[id]/resolve-participant.ts`.
- Share's offline gate and syncing in place: `components/dialogs/ShareOfflineGate.tsx`,
  `app/design/[id]/useSyncInPlace.ts`, `subscribeOfflineIds` in `lib/offline/offline-store.ts`.
- The move prompt after signing in: `components/dialogs/LocalMovePrompt.tsx`,
  `hooks/persistence/useLocalMovePrompt.ts`, `lib/offline/local-move-dismissal.ts`.
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Design" and "Take Offline" (with confirmation + image re-homing).
- Image handling ([Image element + per-owner gallery](../009-elements/images.md)) — embed `data:` URIs offline; upload-on-save,
  download-on-take-offline.
- `apps/marketing` — the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `apps/help` — the "Offline Mode" article + its `articles.ts` registry entry
  ([Help app](../018-help/help-app.md)).
- Telemetry — the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Open source + distribution](../002-project-scope/open-source-and-business-model.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Design structure](design-structure.md) (design model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[Dedicated route for new-design creation](../007-editor/new-design-route.md) (New Design),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Image element + per-owner gallery](../009-elements/images.md) (images),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime — the separate concern),
[Save Locations](save-locations.md) (the Save location chooser).
