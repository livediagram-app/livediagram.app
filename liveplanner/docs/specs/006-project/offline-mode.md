# Offline Mode

**Offline Mode** lets you create a project that is saved **only in the current
browser** — never to the API, never to the server. It is an opt-in choice for
everyone, guests included: every new project starts on liveplanner ([Save Locations](save-locations.md#the-default)). It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a project that physically never leaves
their machine. It also keeps the editor's degrade-never-break rule ([Business model + licence](../002-project-scope/business-model-and-licence.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a project**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ project is
a separate concern — see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) — and out of scope here.)

Tab bodies are stamped with their **tab kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire` — the two stores must agree about what a tab IS, or a Sync Project would hand the cloud a board that has forgotten itself.

## Turning it on

Offline Mode is **off by default for everyone**, guests included
([Save Locations → The default](save-locations.md#the-default)).
Nobody is asked when creating a project; the default decides:

- The **New Project** wizard ([Dedicated route for new-project creation](../007-editor/new-project-route.md#one-step-wizard))
  asks only for a mode and creates the project in the default location for who is creating
  ([Save Locations](save-locations.md)): **liveplanner**, whoever is creating.
  Either moves later: **Take Offline** moves a cloud project into This Browser, **Sync Project** puts one in This Browser on
  liveplanner.
- The links that create without the wizard (`/new?template=`, `/new?blank=1`,
  [Dedicated route for new-project creation → Start Blank](../007-editor/new-project-route.md#start-blank-skip-the-wizard))
  take the same default.
- The location only changes _where the project is stored_; the mode, templates and theme work identically.

No global "offline mode" switch: the choice is **per project**, so a person can
have cloud projects and offline projects side by side.

## Where offline projects live

- Stored in **IndexedDB** in the browser (roomy + async; `localStorage`'s ~5 MB
  synchronous cap is too small for large projects). One record per
  project holds its meta + tabs, keyed by the project id.
- The app keeps a small **local index** of offline project ids (also in
  IndexedDB) so the Explorer can list them and the persistence layer knows which
  ids resolve locally vs to the API.
- **Every tab of the browser agrees on the index.** Each tab mirrors it in memory
  (`apps/editor/lib/offline/offline-ids.ts`), and every id registered or removed is told
  to the other tabs on the `liveplanner-offline` BroadcastChannel (`{ kind: 'add' |
'remove', id }`), which apply it at once. Without it, a tab that missed a Take
  Offline kept saving that project to the server (where it no longer is), and a tab
  that missed a Sync Project or purge kept "saving" into a record that was gone.
- **A write to a record that is gone fails out loud.** When an edit (a tab, the name,
  the order, the folder, the card types) finds its record missing while the tab still
  lists the id, the id is forgotten (and the other tabs told) and the write fails with
  `OfflineProjectMissingError`, logged `[offline-store] write-to-missing-record`: the
  autosave shows the failure instead of "Saved", and its retry routes to wherever the
  project now is. A missing record whose id the tab has already forgotten (its own
  Sync Project, with a save still queued) stays a quiet no-op.
- **Each read-modify-write is one transaction.** A write reads the whole record and
  writes it back; the two happen in one IndexedDB `readwrite` transaction
  (`OfflineBackend.update`), so another tab's write cannot land between them and be
  overwritten. Writes from the same tab are also queued one after another.

<!-- legacy-names -->

- **Store rename (version 2).** Offline projects were kept in the `diagrams` object store until
  the container became a project ([Project](project.md#renaming-from-diagram)). Opening
  version 2 of `liveplanner-offline` moves every record into `projects` inside the upgrade
  transaction, then drops the old store, logging how many moved
  (`apps/editor/lib/offline/legacy-offline-store.ts`). A tab still running the code from before the upgrade
  asks for version 1, which the browser refuses once another tab has opened version 2; its offline
  projects are out of reach in that tab until it reloads.
- **Durability honesty (important).** An offline project has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly — on the project (see the badge, and its legend), in the Share dialog before a Sync, and in
  the help article. "Offline" means _yours only_, with the responsibility that
  implies.

<!-- /legacy-names -->

## What's different in an offline project

The project model (`Tab[]` + meta, per [Project structure](project-structure.md)) is **identical** — an offline
project is a normal project whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline project:

| Feature                                                     | Offline behaviour                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds                                        | The header **Share** button stays visible, but for an offline project it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Editor app](../007-editor/editor-app.md), /54). |
| Live presence / realtime                                    | N/A — a private project never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                        |
| Teams / shared library                                      | Hidden — a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                                  |
| Comments                                                    | Local-only (just you), stored in the project; no cross-user.                                                                                                                                                                                                                       |
| Duplicate                                                   | Makes **another offline project** — a copy never uploads what the user chose to keep local.                                                                                                                                                                                        |
| Folders                                                     | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                       |
| Add to Plan ([Tabs and plans](tab-project-many-to-many.md)) | Unavailable in either direction: the copy is saved through the server, and offline plans are never destinations.                                                                                                                                                                   |
| Thumbnails                                                  | A fixed **offline illustration** in the Explorer — there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                                                                                                                     |

Autosave still runs for an offline project ([Per-tab storage](per-tab-storage.md)) — it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## Instant open

A project in This Browser lives in this browser, so opening it waits on nothing the
server says. The editor bootstrap ([Dedicated route for new-project creation → In-place handoff](../007-editor/new-project-route.md#in-place-handoff-to-the-editor),
`app/project/[id]/useIdentityBootstrap.ts`) takes an **early open** when, before
auth has settled, the path names a project registered in the local index
(`isOfflineId`). Share links, embeds and workbenches always wait for auth.

- The early open does **not wait for auth to settle**, mint a guest id or fetch
  the participant. It reads the project from IndexedDB and paints it under the
  `'self'` placeholder participant.
- **Owner-scoped work waits for the real reader.** Under `'self'`, nothing is
  read or written as an owner: the participant record is not saved, preferences
  stay local (`writeUserPreferences`), and the Explorer lists load only once the reader is known. Sync
  Project from the Share dialog waits too (the gate's `ready`).
- **The reader resolves in the background** once auth answers, exactly as a
  cloud open resolves it (`resolveParticipant` in
  `app/project/[id]/resolve-participant.ts`: the account id or the guest token's id,
  then the profile), followed by the Explorer lists and the guest naming
  nudge. The project is not reloaded: an offline project is the reader's own
  whoever they turn out to be.
- **`/new` does not wait either.** For a project created in This Browser, the create writes to IndexedDB and hands off without
  waiting on auth, the guest id or the participant, which resolve in the
  background (`commitNewProject` in `app/new/page.tsx`).
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
  (the `SharedBadge` in `EditorHeader`). For an offline project it reads
  **"This Browser"** (a state that supersedes "Private" for these projects),
  matching the [This Browser pill](#this-browser-pill): the same words, the same
  browser-window icon, the same amber tone and contrast, and the same sentence,
  "Lives only in this browser. Clearing this browser's site data deletes it.",
  shown in the badge's visibility legend on hover and focus and given to
  assistive technology as the badge's description. It stays a status, not a
  link: the legend explains it in place.
- **The visibility legend** (`VisibilityLegend`, on the badge's hover and focus, closing 120 ms after the
  pointer leaves): a hero in the current state's tone, eyebrow **Who Can See This**, the state's icon and
  name, its sentence, and its **reach** drawn as rings around you, lit out to how far the project goes
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
- **Explorer.** Offline projects appear in Recent (and the other lists)
  alongside cloud projects, each with the **This Browser** pill (below) and the
  fixed offline thumbnail, so a project in This Browser is recognisable at a glance.
  The Explorer view merges the API-fetched cloud list with the local index of
  offline projects; offline rows never trigger a server fetch (list, thumbnail,
  or otherwise).
- **The reader's own.** An offline project counts as one of the reader's own
  projects: Space `mine` and owner "You", like a project in My Work
  ([Explorer structure: projects in This Browser](../013-workspace/explorer-structure.md)).
- **Sidebar.** The full-page Explorer's **This Browser** row (the More group,
  [Explorer structure](../013-workspace/explorer-structure.md)) opens
  `/explorer/offline`, the list of every offline project, titled **This
  browser**; the row shows while this browser holds at least one.
- **Home.** An offline project's opens are counted in its own local record, never
  sent anywhere, so Home's Jump Back In places it among the reader's other
  projects by the same rule, with the **This Browser** pill on its thumbnail
  ([Explorer Home](../013-workspace/explorer-home.md)).
- **Inbox.** The Inbox reads offline projects in the browser and lists their open actions, Plan cards and comment
  threads among the cloud ones, each row with the **This Browser** pill
  ([Inbox §2.6](../013-workspace/inbox.md)).

### This Browser pill

Every row and card of an offline project carries a **This Browser** pill,
wherever the project is listed: the list and card views (folders, Search results,
This Browser, Recent, Favourites), Home's Jump Back In, the Inbox's rows, the folder previews' tiles excepted (they
are pictures, not rows), the search panel's results, the editor's Explorer
rows and its Current Project card, and the Trash.

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
  Current Project row, an Inbox row), the pill is a plain label inside it, carrying the same
  description: a link cannot sit inside a button. In a tree (the editor's
  Explorer), the pill is a link out of the tab order, since the tree owns
  the one tab stop, and the row itself carries the description. The Trash row's
  pill is a link like any other.
- **It replaces the "Offline" visibility badge** in the Explorer's lists: an
  offline project shows the pill beside its name at every width, and its
  visibility column stays empty. Minimal chrome keeps the words: the pill is a
  warning, not a teaching hint.

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog (below), and after signing in by
the move prompt ([Auth + guest access → Moving projects in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-projects-in-this-browser-after-signing-in)).

### Sharing a project in This Browser

Share is how most people find out a project needs the server. Pressing it never
uploads anything by itself; the dialog explains and asks, for a guest and a
signed-in person alike:

- **The gate.** Share on a project in This Browser opens the Share dialog on its
  offline gate (`ShareOfflineGate`): **This Project Is in This Browser**, "It is saved only
  in this browser, so there is nothing to share yet. Sync it to liveplanner to
  share it: share links, real-time collaboration and the live image all need it
  on our servers. You can take it offline again any time.", with **Sync Project**
  and Cancel.
- **Sync Project** syncs the open project **in place** (below): the button shows
  **Syncing…** with a spinner, then a toast confirms "Synced. Your project is on
  liveplanner now." and the same dialog shows the share options. No reload, no
  second press of Share. A guest's upload is owned by the guest id like any guest
  cloud project.
- The button waits for the reader to be known (an early open runs under the
  `'self'` placeholder, [Instant open](#instant-open)).
- A failed sync keeps the project This Browser, says why in a toast
  (`syncFailureMessage`) and leaves the button to try again; nothing is
  half-uploaded (see below).
- **Share Form** on a Form tab offers the same prompt (`SyncProjectPrompt`, which
  the gate draws too) with a form's wording, and carries on to publishing the form
  once the project is synced ([Forms](../030-forms/forms.md#publishing-and-the-form-link)).

### Syncing in place

Sync Project from inside the editor (`useSyncInPlace` in
`app/project/[id]/useSyncInPlace.ts`) converts the open project without a
reload:

1. **It waits for this browser's last save** to land (`hasUnsavedChanges`), up to
   `SYNC_SAVE_WAIT_MS` (5 s), so the record it uploads is what is on screen and no
   save lands in a record about to be deleted. Past that it refuses with
   `SyncStillSavingError` ("Still saving this project. Try again in a moment.").
2. **It uploads** with `saveOfflineToCloud`.
3. **The offline index announces the move** (`subscribeOfflineIds` in
   `lib/offline/offline-store.ts`, told on every create, sync and Take Offline).
   What reads offline-ness follows it: the header badge and every
   `useIsOfflineProject` (so the Share dialog swaps the gate for its options), the
   Plan board's items (`usePlanItems` loads the server's store and revision) and
   the sheets (`SheetStore.resync`, so confirmed revisions are the server's).
4. **The room opens** (`projectServerStored` turns true) and the Explorer list
   refreshes.

The Explorer's row menu and the move prompt after signing in still reload after a
sync: the project there is not the one on screen, or several move at once.

### Save to server (Offline → Cloud)

Action: **"Sync Project"** (one name everywhere: the Explorer row menu, the
Share dialog gate, Share Form's, and the move prompt after signing in).

- Uploads the project's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud project owned by the current identity (signed-in account, or the guest's
  liveworkspace guest token if not signed in — [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Everything on the record travels**, not just tabs: the created date, the folder (kept only when it is one of the
  caller's own personal folders, else the root of My Work) and the star ([Favourite projects](../013-workspace/favourites.md)). The
  local copy is deleted next, so anything the create leaves behind is gone.
- **A refused folder lands at the root, on the sync's say-so.** The create carries the folder as
  its placement ([Folders → Placement on create](../013-workspace/folders.md)),
  and the server refuses a folder deleted since, or not the caller's, by name rather than
  filing it elsewhere. On `folder_not_found` or `folder_scope_mismatch` the sync creates the
  project again at the root of My Work and logs `[offline-sync] placement refused reason=<code>, filed at root`;
  any other failure fails the sync and keeps the local copy.
- **A forked tab comes back as its own tab.** The create never writes into a tab
  another project holds: a seeded tab whose id is already taken outside this
  project is created under a fresh id, and the project's tab / element links and
  deck slides follow it. So a tab that forked on Take Offline returns as a new
  tab beside the original rather than overwriting it; joining them again is an
  explicit "Add to Project". A retried create (the tab already in this project)
  keeps its ids.
- **What went up is what is removed.** The upload takes seconds and the project
  stays editable meanwhile (here or in another tab). The local copy is removed only if
  it still matches what was uploaded (its save time, card store revision and each
  sheet's revision), checked and deleted in one transaction. If it changed, the cloud
  copy is taken back (a raw delete declared as a move into this browser, so it skips
  the Trash) and the newer record is uploaded again, logged
  `[offline-sync] changed-during-upload attempt=<n>`; after three uploads that each
  went stale the sync stops, keeps the local copy and says the project kept changing.
- **The cloud copy must hold every card and sheet.** A create that resolves to an
  existing row (a retry after a half-finished sync) never re-seeds the card or sheet
  stores, so before the local copy goes the sync reads the cloud copy's cards and
  sheets back and compares their counts with the record's (skipped when the record
  has none). Short, the cloud copy is taken back, the local copy kept, and the sync
  fails, logged `[offline-sync] stores-short`.
- **One conversion per project at a time.** A second Sync Project or Take Offline
  of a project while one runs (a second menu, or the Share gate) does nothing; the
  guard lives with the conversion, not with the menu that started it, which closes.
- On success the **local copy is removed** from IndexedDB so there's one source
  of truth; the project is now a cloud project (Share / AI / Teams reappear). The
  id is unchanged, so the route stays the same: from the Share dialog the editor
  turns into the cloud project in place ([Syncing in place](#syncing-in-place));
  from the Explorer it reloads.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**, in the editor and in the Explorer on liveplanner's address, which hands it to This
Browser's page (`/offline?convert=take-offline&item=<id>`, `apps/editor/hooks/persistence/useConversionHandoff.ts`,
over the shared `@liveworkspace/explorer/conversion-handoff`): the page checks the plan is the person's to move, then
asks the same confirmation. The Explorer offers it on a plan the person can edit in their library or a team's, never
on one reached through a link. Its This Browser rows' **Sync Plan** hands over the same way
(`/offline?convert=sync&item=<id>`), and the page asks before it moves the plan. This is **destructive on the server**
and gated by a confirmation:

- **Confirmation** warns clearly: _"This removes it from your account and every
  other device. It will exist only in this browser, with no backup."_ (Each tab
  belongs to this plan alone, [Tabs and plans](tab-project-many-to-many.md), so
  no other plan loses anything.)
- On confirm: download the project's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **This Browser**.
- **The deck, star and personal folder come along** for the same reason: the
  server row they live on is about to be deleted. The star is read from the account's
  favourites; if that read fails the conversion aborts before anything is written,
  rather than taking the project as unstarred and losing the star with the row. A team project's folder is a
  team folder, which has no place in the personal tree, so it lands at the root of My Work.
- **Every tab, or nothing.** If any tab fails to download the conversion aborts
  before anything is written locally and before the server delete, so the cloud
  copy stays authoritative. This is the one failure in this direction that
  nothing could undo: a partial download followed by the server delete leaves
  the missing tab's elements nowhere at all, while reporting success. A tab read
  can come back empty from two directions — a failed request, or a 404 that the
  api client maps to `null` rather than an error — and both count as failure
  here. (The best-effort "keep what loaded" shape is right for _duplicating_ a
  project, where the source survives; it inverts once the source is destroyed.)
- **If that server delete fails, the local copy is rolled back** and the error
  surfaces. Both copies registered under one id would shadow the live cloud
  project behind a stale offline fork (and duplicate the Explorer row), so the
  conversion is all-or-nothing in this direction too. Data-safe either way: the
  server still holds everything, and the user can retry. The rollback is
  best-effort, but a rollback that itself fails still reports the original
  delete failure rather than a success.
- **Take Offline bypasses the [Trash](../013-workspace/trash.md)** for the project's owner: it is a move, not a delete, so the server copy goes at once. A joined teammate taking a team project offline sends the team's copy to the team Trash instead, since from the team's side it is a deletion.
- **Deleting an offline project moves it to this browser's local Trash** ([Trash](../013-workspace/trash.md), "The local Trash"): the IndexedDB record gains `trashedAt` and keeps everything else, leaves the lists and stars, refuses writes, and is purged 30 days later the next time the app lists projects or opens the Trash. Sync Project removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ project offline
  first revokes those (a share/team project can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline project is browser-local regardless of
  account — a signed-in user's offline projects do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** project ([Auth + guest access](../014-identity/auth-and-guest-access.md)): a guest's cloud project is
  on the server and in liveworkspace's index under the guest's liveworkspace identity, and moves to the account at sign-in;
  an offline project never touches the server at all.
- Sign-in / sign-out never migrates offline projects by itself (the index's guest-to-account move, [Auth + guest access](../014-identity/auth-and-guest-access.md#guest--account),
  only moves a guest's _cloud_ projects). After signing in, a prompt
  **offers** to move them ([Moving projects in This Browser after signing in](../014-identity/auth-and-guest-access.md#moving-projects-in-this-browser-after-signing-in));
  a project the person leaves stays put.
- The "This Browser" badge and pill read the same for a guest as for anyone: the
  sentence about clearing site data is the one a guest most needs to see.

## Persistence architecture

The editor already has a **single persistence boundary**: `apps/editor/lib/api-client.ts`
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
  to dispatch on yet: the New Project wizard calls `offlineCreateProject`
  directly when the location is This Browser (picked on purpose), and
  that call is what registers the id every later operation routes on.
- Only the project/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  project (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page — no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Flip on Offline Mode when you create a project and it is saved only in
> your browser: no account, no server, no sync. Yours alone. Move it to the cloud (or pull one
> back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a project
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([Help app](../018-help/help-app.md))

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and — per the help-registry rule — **register it in
`apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Project wizard's Save
  location chooser, [Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data — the durability warning, stated plainly.
- **Converting**: "Sync Project" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration, teams, and AI.

Also add the standard contextual help link ([Contextual help links](../018-help/contextual-help-links.md)) from the New Project
wizard's data-loss warning to this article.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Track adoption without content, reusing the closed vocabulary:

- On create, distinguish the mode via the `type` on the existing
  `Project`/`Created` event (e.g. `Offline` vs `Cloud`).
- The move prompt after signing in: `UI`/`Opened`/`LocalMovePrompt` when it
  shows, `UI`/`Selected`/`LocalMovePrompt` on Move, `UI`/`Closed`/`LocalMovePrompt`
  on Not Now. Each project it moves also sends the conversion event below.
- On conversion, a coarse event for each direction, so uptake and the
  destructive take-offline path are visible: `Project`/`Moved` with type
  `SavedToCloud` or `TakenOffline`, emitted after the conversion succeeds: from
  the shared `useOfflineConversion` handlers before their reload (the telemetry
  engine's pagehide beacon carries it through), from `useSyncInPlace` for the
  Share dialog, and per project from the move prompt.
- No project content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline projects** — that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing** — offline is single-user by nature.
- **Not** offline-resilience for cloud projects (editing a cloud project through
  a network blip) — that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion** — a project never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action (pressing Share,
  Sync Project, or Move on the prompt after signing in).

## Implementation map

- `apps/editor/lib/api-client.ts` + `lib/api/*` — the persistence-backend seam;
  new `LocalBackend` (IndexedDB) beside the existing API calls; per-project
  dispatch via a local index.
- New Project wizard (`TemplatePicker` / `template-picker-settings.tsx`,
  [Dedicated route for new-project creation](../007-editor/new-project-route.md)): the **Settings** step's Save location chooser ([Save Locations](save-locations.md), the
  This Browser tile) + data-loss warning + contextual help link.
- `EditorHeader` (`SharedBadge`) — the **This Browser** badge state.
- Explorer (row + card components, `ThisBrowserPill`): merge the local index,
  show the **This Browser** pill wherever an offline project is listed plus a
  fixed offline thumbnail everywhere, and skip server fetches for offline rows.
- Guest default + instant open: `lib/save-locations.ts` (`defaultSaveLocationFor`),
  `lib/signed-in-hint.ts`, `app/new/useNewProjectLocation.ts`, the early open in
  `app/project/[id]/useIdentityBootstrap.ts` with `app/project/[id]/resolve-participant.ts`.
- Share's offline gate and syncing in place: `components/dialogs/ShareOfflineGate.tsx`,
  `app/project/[id]/useSyncInPlace.ts`, `subscribeOfflineIds` in `lib/offline/offline-store.ts`.
- The move prompt after signing in: `components/dialogs/LocalMovePrompt.tsx`,
  `hooks/persistence/useLocalMovePrompt.ts`, `lib/offline/local-move-dismissal.ts`.
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Project" and "Take Offline" (with confirmation).
- `apps/marketing` — the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `apps/help` — the "Offline Mode" article + its `articles.ts` registry entry
  ([Help app](../018-help/help-app.md)).
- Telemetry — the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Business model + licence](../002-project-scope/business-model-and-licence.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Project structure](project-structure.md) (project model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[Dedicated route for new-project creation](../007-editor/new-project-route.md) (New Project),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime — the separate concern),
[Save Locations](save-locations.md) (the Save location chooser).
