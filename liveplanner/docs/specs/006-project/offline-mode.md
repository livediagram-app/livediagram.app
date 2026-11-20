# Offline Mode

**Offline Mode** lets you create a project that is saved **only in the current
browser**, never to the API, never to the server. It is the default for a guest's
new project ([Auth + guest access → Guest projects start local](../014-identity/auth-and-guest-access.md#guest-projects-start-local))
and an opt-in choice for everyone else. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a project that physically never leaves
their machine. It also keeps the editor's degrade-never-break rule ([Business model + licence](../002-project-scope/business-model-and-licence.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a project**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ project is
a separate concern; see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), and out of scope here.)

Tab bodies are stamped with their **tab kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire`: the two stores must agree about what a tab IS, or a Sync Project would hand the cloud a board that has forgotten itself.

## Turning it on

Offline Mode is **on by default for a guest and off by default for a signed-in person**
([Save Locations → The default depends on who is creating](save-locations.md#the-default-depends-on-who-is-creating)).
Nobody is asked when creating a project; the default decides:

- The **New Project** wizard ([Dedicated route for new-project creation](../007-editor/new-project-route.md#one-step-wizard))
  asks only for a mode and creates the project in the default location for who is creating
  ([Save Locations](save-locations.md)): **Offline** for a guest, **liveplanner** for a signed-in person.
  Either moves later: **Take Offline** moves a cloud project Offline, **Sync Project** puts one kept Offline on
  liveplanner.
- The links that create without the wizard (`/new?template=`, `/new?blank=1`,
  [Dedicated route for new-project creation → Start Blank](../007-editor/new-project-route.md#start-blank-skip-the-wizard))
  take the same default, so a guest following a template from the landing page
  gets a project kept Offline.
- A `/new?folder=` / `?team=` context names a server place, so it is liveplanner whoever is creating.
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
  Offline would keep saving that project to the server (where it no longer is), and a tab
  that missed a Sync Project or purge would keep "saving" into a record that is gone.
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

- **Durability honesty (important).** An offline project has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly: on the project (see the badge, and its legend), in the Share dialog before a Sync, and in
  the help article. "Offline" means _yours only_, with the responsibility that
  implies.

## What's different in an offline project

The project model (`Tab[]` + meta, per [Project structure](project-structure.md)) is **identical**: an offline
project is a normal project whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline project:

| Feature                  | Offline behaviour                                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds     | The header **Share** button stays visible, but for an offline project it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Editor app](../007-editor/editor-app.md), /54). |
| Live presence / realtime | N/A: a private project never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                         |
| Teams / shared library   | Hidden: a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                                   |
| Comments                 | Local-only (just you), stored in the project; no cross-user.                                                                                                                                                                                                                       |
| Duplicate                | Makes **another offline project**; a copy never uploads what the user chose to keep local.                                                                                                                                                                                         |
| Folders                  | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                       |
| Thumbnails               | The **browser it lives in**, on a wash of the accent of the app that owns it (the Explorer's `LocalPreview`), never the pill's teal, as there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                                |

Autosave still runs for an offline project ([Per-tab storage](per-tab-storage.md)): it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## Instant open

A project kept Offline lives in this browser, so opening it waits on nothing the
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
- **`/new` does not wait either.** For a guest ([Who is a guest, before sign-in answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-sign-in-answers))
  creating Offline, the create writes to IndexedDB and hands off without
  waiting on auth, the guest id or the participant, which resolve in the
  background (`commitNewProject` in `app/new/page.tsx`).
- **Except a first visit's guest token.** A browser with no guest token yet (or one near its end) fetches one before
  the create: the handoff ([Auth + guest access → Guests](../014-identity/auth-and-guest-access.md#guests)) leaves
  the page and comes back to the same `/new` address, so a create begun first would run again on the way back and
  make the project twice, or the handoff would leave the editor moments after it opened. `commitNewProject` awaits
  `ensureGuestToken` first; a returning guest's token is already in `localStorage`, so it answers at once and
  nothing waits. With no accounts site the handoff comes straight back failed, and the create goes ahead.
- The editor reads back the record `/new` has just written rather than taking
  the tabs across in memory: the read is one IndexedDB get, small beside the
  waits removed, and keeps one load path.

**Measured** against production builds of `main` and of this change, served the
same way with the local api (headless Chromium, 10 runs each, interleaved; a
fresh browser profile per first visit), guest create to first canvas paint:

| Link                   | Before (cloud) first / return | After (Offline) first / return | API requests |
| ---------------------- | ----------------------------- | ------------------------------ | ------------ |
| `/new?template=kanban` | 2,956 / 1,775 ms              | 955 / 819 ms                   | 24 → 1       |
| `/new?blank=1`         | 3,076 / 1,803 ms              | 1,053 / 834 ms                 | 20 → 1       |

The one request left is `GET /api/capabilities`; the guest id, participant and
Explorer lists follow after the paint.

## Warm open of a cloud project

A cloud plan waits on three things in a row before it paints: auth settling, the participant
([`resolveParticipant`](#instant-open)) and the first tab's fetch, then its cards. In liveplanner 181 of 410
opens took over 2 seconds (telemetry, `ProjectLoad.*`, the 30 days to November 2026), while the live room
connected in under a second for 290 of 331. A plan this browser has opened before paints at once from **the last
copy seen**, the way Linear, Figma and Notion show their last synced copy and catch up in the background. It is
the same warm open the four other editors have (livediagram's
[Offline Mode, its warm open](../../../../livediagram/docs/specs/006-document/offline-mode.md),
Work Tracker 890), bound to liveplanner (Work Tracker 927); what differs is that a plan's first tab may be a
Board, a Sheet, a Dashboard or a Form, and what a Board, a Sheet or a Dashboard shows lives beside the tab.

**The last copy seen.** Each time a cloud plan opens by its own address or by a share link, the editor keeps
what that load answered in this browser: the plan's meta (name, tab list, owner fields), the first tab's body and
revision, and how the reader came in (the role, the owner's chrome, the share code the address carried and the
tab a tab-scoped link opens). It also keeps what the first tab draws from:

- **The cards** the reader's board read (the item store as it stood), once they have loaded, so a Board or a
  Dashboard first tab paints its cards. A plan with more than **1,000 cards** keeps none (about 670 KB of cards
  at a typical card's size; a bigger plan's write would be slow and its copy past the store's limit), and its
  Board or Dashboard first tab opens as it always did.
- **The first tab's sheets**, when it is a Sheet tab, as its last read of them answered, so a Sheet first tab
  paints its cells. Sheets holding more than **10,000 cells** together keep none, and the tab opens as it always
  did.
- **The tabs a Dashboard shows**, when the first tab is a Dashboard: the body of each tab its tiles draw, once
  each has loaded, and each such Sheet tab's sheets as their last read answered, so the Dashboard's tiles paint
  their boards and cells rather than an empty page. Their cells together have the same **10,000 cell** cap; past
  it, or before every shown tab has loaded once, none are kept and the Dashboard opens as it always did.

It lives in its own IndexedDB database (`liveplanner-last-seen`), never on the server, under the same rules as
every editor's copy:

- **Per reader.** A copy is keyed by who read it: the account id, or the guest's id. It is read back only for that
  reader, and every load drops the copies any other reader left.
- **Cleared on sign-out.** Signing out, and deleting the account, empties the store before the sign-out hop. A
  sign-out in another app, which cannot reach this store, empties it at this app's next load, the moment its first
  token answer finds the signed-in hint outlived its session (liveworkspace's accounts.md "A hint that outlived its
  session").
- **Lost access forgets.** A load that ends on not found (a revoked share link, a plan no longer shared with the
  reader), on the deleted card or behind a share password removes that plan's copy, and a share link's copies go
  by its code too. A load that cannot reach the server keeps it.
- **Follows the plan.** While the plan is open its copy keeps up with what the reader sees: the name and the tab
  list each time they change, the first tab's body each time one of the reader's own saves of it lands, and the
  cards each time the board's store changes (a card added, moved or edited, by the reader, a teammate or a rule).
  The first tab's sheets, and a Dashboard's shown tabs, follow each read of them (the open's, a reconnect's, a
  shown tab's load); a cell typed since shows its older
  value for a moment at the next warm open, until the catch-up. Refreshes are gathered into at most one write
  every 2 seconds, off the editing path, and a waiting one is written when the page is hidden or closed. While the
  Plan tour's practice cards are on the board the cards are not followed (they are never anyone's real cards).
- **Bounded.** At most 20 copies, the oldest seen dropped first; a copy over 1,000,000 characters of JSON is not
  kept; a copy older than 30 days is never read. Embeds, Community posts, workbenches and Offline plans keep
  none.

**The warm open.** An address naming a cloud plan with a copy for the reader paints that copy under the `'self'`
placeholder, read-only, before the ordinary load lands, exactly as the other editors do: signed out by the signed-in
hint, the reader is the guest token's id and the copy is read at once, before auth settles; signed in, the warm open
waits for the session's first token answer and reads only the copies of the account it names (the hint says whether,
never who), so a stale hint paints nothing and its answer empties the store. A share link warm-opens only by the code the copy was kept under, by an address that names
the plan or by the link's own address (`/project/shared?s=<code>`). Embeds, workbenches and Offline plans never
warm-open, and neither does a copy whose first tab is not the tab this open would show first (no first tab kept, or
`#t=` naming another tab).

What the first tab is decides whether the copy paints:

| First tab | Paints from the copy                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Board     | Its body and the cards kept; no cards kept (past the cap, or before they first loaded): opens as always |
| Dashboard | Its body, the cards kept and the tabs its tiles show (below); otherwise opens as always                 |
| Sheet     | Its body and its sheets kept; no sheets kept for this tab: opens as always                              |
| Form      | Never: a form's link, its state and its responses are the server's, so a Form tab waits for the load    |

A Dashboard first tab paints only when every slot can draw from the copy: each Board or Sheet tab a tile shows is
kept (a Sheet with its sheets), and no slot reads what the copy never holds. A tile naming a Form tab, a figure or
chart from a sheet (Sheet Metrics, a chart from a Sheet's cells) or a figure from a form (Form Metrics) keeps it
waiting, and so does a shown tab not kept (it had not loaded, or its cells were past the cap). A tile whose tab was
deleted paints as it says so. Until a shown tab's own load answers, its tile draws the kept body as it was seen,
not worked on, and then the tab as loaded.
| Any other | Its body, with what it draws as a Board or a Sheet would (a board or card needs cards, a Sheet sheets) |

- **Edits wait for the participant.** The warm paint runs as a Viewer: every edit control is disabled with the
  usual read-only look, card moves and edits, the board's shared filter (its words, chips, Only Mine and saved
  filters) and the Automations screen stay closed, nothing is saved, no card or cell write is sent, the room does
  not connect and no request goes out under the placeholder, until the reader resolves and the fresh copy lands.
  A stored role never widens what the reader may do.
- **The code it draws is in first.** Before it paints, the warm paint waits for the code of what it mounts with a
  Board first tab (the board, the card panel's host and the Plan tour's host: `WARM_PAINT_CODE` in
  `apps/editor/lib/editor-deferred-code.ts`), at most 200 ms (`WARM_PAINT_CODE_WAIT_MS`, as in livediagram), so they
  draw in the paint's own commit: the cards are on screen in the paint's first frame rather than a beat later, and no
  waiting content's reveal holds back the next. A returning open has that code in its HTTP cache. The sign-in bridge
  mounts as its code lands (the shared `AuthProvider`), so nothing the paint shows holds back auth, and a warm open
  is editable no later than a cold one.
- **The board holds its place.** The paint draws, inert, the strips the reader's kept role will show once the
  catch-up gives it back: an Editor's example cards notice and an Editor's or Participant's card type chips. The
  catch-up then makes them work without moving the columns under the reader. A Viewer's copy draws neither, so no
  gap is left; a role lowered since the copy was kept takes them away at the catch-up, the one case the board moves.
- **The ordinary load catches up** behind it, unchanged: auth, the participant, the plan, the first tab and then
  the cards and sheets. Its answer replaces the copy in place (the same tabs by id, no opening screen between) and
  its role applies. The fresh cards replace the kept ones whole, and the fresh sheets the kept ones. A first tab
  whose revision is the one the copy holds keeps the painted tab as it is.
- **Someone else after all**, **lost access on catch-up**, **never a wrong not found**, **other tabs wait for the
  load** and **another browser tab** behave as in the other editors (livediagram's spec above): a different reader
  takes the copy off the screen for the opening screen; a load ending on not found after a warm paint forgets the
  copy and reloads once, cold, before any not found shows; a tab switched to during the warm paint shows the tab
  loader and is kept through the catch-up.
- `ProjectLoad` keeps timing the fresh copy's first frame; the warm paint is timed on its own as the performance
  measures `warm-paint` and `warm-catch-up` and in the field as the `WarmPaint` timing, from the same start.

**Measured** on the production export (headless Chromium, the e2e stack, a guest's Kanban plan at its own address,
100 ms round trip at 10 Mbps, 12 cold and 12 warm opens interleaved, medians / p90 from navigation start): the cards
are on screen at **925 / 935 ms** cold (the open as it was before) and **405 / 419 ms** warm, about 520 ms (56%)
sooner, and the plan is editable at **775 / 787 ms** warm, about 150 ms before a cold open (Work Tracker 1111, on a
busier machine than the first measurement, which had cold at 829 ms and warm editable at 1,036 ms, about 200 ms
after cold, before the sign-in bridge mounted by state and the paint had its code in first). The cards' first row
stands at the same height before and after the catch-up.

The bindings are set out in the [Last seen copy blueprint](blueprints/last-seen-copy.md), which names its
measurements.

## Archived Offline

A plan kept Offline can be moved to Archived from the Explorer's menu, like an account's. Nothing leaves the
browser: the mark (`archivedAt`) lives only in Offline's shared list (`@liveworkspace/explorer/this-browser`),
and every rewrite of the list carries the marks it held. Before the editor opens a plan it reads the mark once
(`isThisBrowserArchived`), and an archived one shows the **Plan Archived** card in place of the plan
([Archived](../007-editor/new-project-route.md#archived)), whether or not the early open would have taken it. Change Folder moves it out,
back into Offline's list.

## "Offline" badge + Explorer

- **Visibility badge.** The open item's badge is the Explorer panel's Current card's (the open editor has no
  header bar, and its legend went with it): Private / Shared / Team from the index, and, for an item kept only
  here, the [Offline pill](#offline-pill) with its words, browser-window icon, teal tone and sentence
  (one-explorer.md "The Current card").
- **Explorer.** Offline projects appear in Recent (and the other lists)
  alongside cloud projects, each with the **Offline** pill (below) and the
  fixed offline thumbnail, so a project kept Offline is recognisable at a glance.
  The Explorer view merges the API-fetched cloud list with the local index of
  offline projects; offline rows never trigger a server fetch (list, thumbnail,
  or otherwise).
- **The reader's own.** An offline project counts as one of the reader's own
  projects: Space `mine` and owner "You", like a project in My Work
  ([Explorer structure: projects kept Offline](../013-workspace/explorer-structure.md)).
- **Sidebar.** The full-page Explorer's **Offline** row (the More group,
  [Explorer structure](../013-workspace/explorer-structure.md)) opens
  `/explorer/offline`, the list of every offline project, titled **This
  browser**; the row shows while this browser holds at least one.
- **Home.** An offline project's opens are counted in its own local record, never
  sent anywhere, so Home's Most Used and Recent places it among the reader's other
  projects by the same rule, with the **Offline** pill on its thumbnail
  ([Explorer Home](../013-workspace/explorer-home.md)).
- **Inbox.** The Inbox reads offline projects in the browser and lists their open actions, Plan cards and comment
  threads among the cloud ones, each row with the **Offline** pill
  ([Inbox §2.6](../013-workspace/inbox.md)).

### Offline pill

Every row and card of an offline project carries an **Offline** pill,
wherever the project is listed: the list and card views (folders, Search results,
Offline, Recent), Home's Most Used and Recent, the Inbox's rows, the folder previews' tiles excepted (they
are pictures, not rows), the search panel's results, the editor's Explorer
rows, and the Trash.

- **Not colour alone.** The pill shows an icon (a browser window) and the words
  "Offline", in a teal tone whose text meets 4.5:1 on its fill in light and
  dark mode; the ring meets 3:1 against the row. Teal because it is no app's accent
  (livediagram sky, liveplanner violet, livedocuments amber, livedesign rose, liveworkspace
  slate) and no status colour (green fine, amber warning, red failing), so the pill never reads
  as whose an item is, or as fine or failing. One pill for every editor and the Explorer
  (`ThisBrowserPill` in `@liveworkspace/workbench`, its tone `THIS_BROWSER_TONE` from
  `@liveworkspace/explorer/this-browser`).
- **What it means, on hover and focus.** Its hover card reads "Offline" over
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
  visibility column stays empty.

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog (below), and after signing in by
the move prompt ([Auth + guest access → Moving projects kept Offline after signing in](../014-identity/auth-and-guest-access.md#moving-offline-projects-after-signing-in)).

On a fresh, unshared plan's start screen the **Sync Plan to Server** switch moves it either way, in place and with no confirmation ([Save Locations → On the start screen](save-locations.md#on-the-start-screen)).

### Sharing an offline project

Share is how most people find out a project needs the server. Pressing it never
uploads anything by itself; the dialog explains and asks, for a guest and a
signed-in person alike:

- **The gate.** Share on a project kept Offline opens the Share dialog on its
  offline gate (`ShareOfflineGate`): **This Project Is Offline**, "It is saved only
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
- A failed sync keeps the project Offline, says why in a toast
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

The Explorer panel's Sync and Take Offline (an item's menu, Offline's rows) never reload either: the
project open in the editor moves in place as above, any other moves on its own, and the Explorer loads its lists again
once the move settles. Only the move prompt after signing in still reloads, since several move at once.

### Taking offline in place

Take Offline from the start screen's **Sync Plan to Server** switch
([Save Locations → On the start screen](save-locations.md#on-the-start-screen)), `useTakeOfflineInPlace` in
`app/project/[id]/useTakeOfflineInPlace.ts`, converts the open plan without a reload and without the confirmation: the
switch only shows on a fresh plan nobody else has, so there is nothing to lose.

1. **It waits for this browser's last save**, as a sync in place does (`SYNC_SAVE_WAIT_MS`, then
   `SyncStillSavingError`).
2. **It closes the room first** (`projectServerStored` turns false), so the server delete's echo never reaches the open
   editor as a deletion. A failure opens it again and the plan stays on the server.
3. **It takes the plan offline** with `takeCloudOffline`, exactly as Take Offline below.
4. **The offline index announces the move**: the header badge and every `useIsOfflineProject` follow, and every later save
   goes to IndexedDB by the plan's id.
5. **The template-pick note is dropped** (a template picked now has no server folder to go to), the move prompt after
   signing in is told the plan stays here, and the Explorer list refreshes.

### Save to server (Offline → Cloud)

Action: **"Sync Project"** (one name everywhere: the Explorer row menu, the
Share dialog gate, Share Form's, and the move prompt after signing in).

- Uploads the project's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud project owned by the current identity (signed-in account, or the guest's
  liveworkspace guest token if not signed in; [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Everything on the record travels**, not just tabs: the created date, the folder (kept only when it is one of the
  caller's own personal folders, else the root of My Work). (No star: Favourites were removed, [favourites.md](../013-workspace/favourites.md).) The
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
  from the Explorer panel it moves without a reload too.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**, in the editor and in the Explorer on liveplanner's address, which hands it to the editor
at the plan's own address (`/project/<id>?convert=take-offline&item=<id>`, `apps/editor/components/dialogs/ConversionHandoff.tsx`
over `apps/editor/hooks/persistence/useConversionHandoff.ts` and the shared `@liveworkspace/explorer/conversion-handoff`):
the editor checks the plan is the person's to move, then asks the same confirmation. The Explorer offers it on a plan
the person can edit in their library or a team's, never on one reached through a link. Its Offline rows' **Sync
Plan** hands over the same way (`/project/<id>?convert=sync&item=<id>`), and the editor asks before it moves the plan;
in the editor's Explorer panel Sync Plan runs in place. This is **destructive on the server**
and gated by a confirmation:

- **Confirmation** warns clearly: _"This removes it from your account and every
  other device. It will exist only in this browser, with no backup."_ When the
  plan has shared tabs, the shared-tab notice follows (see below).
- On confirm: download the project's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **Offline**.
- **The deck and personal folder come along** for the same reason: the
  server row they live on is about to be deleted. A team project's folder is a
  team folder, which has no place in the personal tree, so it lands at the root of My Work.
- **Shared tabs fork.** A tab also in other plans
  ([Tab ↔ project many-to-many](tab-project-many-to-many.md)) is not taken
  away from them: the purge tells them this plan left, and they keep their
  copies whole. The offline copy holds its own copy of the content. From then
  on the two are independent; an edit on either side never reaches the other.
  The confirmation says so up front (see [Shared-tab notice](tab-project-many-to-many.md#shared-tab-notice)).
- **Every tab, or nothing.** If any tab fails to download the conversion aborts
  before anything is written locally and before the server delete, so the cloud
  copy stays authoritative. This is the one failure in this direction that
  nothing could undo: a partial download followed by the server delete leaves
  the missing tab's elements nowhere at all, while reporting success. A tab read
  can come back empty from two directions: a failed request, or a 404 that the
  api client maps to `null` rather than an error, and both count as failure
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
- **Deleting an offline project removes it for good** (the Explorer asks first; nothing else holds it, and the local Trash is gone, see [Trash](../013-workspace/trash.md)). Deleting the plan open in the editor tombstones it first (`lib/project-tombstones.ts`), so neither the autosave nor the unload flush writes it back, then removes the IndexedDB record and leaves for the Explorer, as deleting an open cloud plan does (`@liveworkspace/workbench/lib/this-browser-remove`, shared by every editor). The confirmation says it deletes only this browser's copy, the only one, and that nothing in the account changes ("Delete this plan from this browser?", `thisBrowserDeleteCopy` in `@liveworkspace/explorer/this-browser`). The panel deletes in place; the Explorer page asks the same on the page, then hands the delete to the editor at the plan's own address (`/project/<id>?convert=delete&item=<id>`, `components/dialogs/ConversionHandoff.tsx`), which deletes it without asking again (the page's note in session storage) and goes back to `/explorer/offline`; the same link without that note asks first. Sync Project removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ project offline
  first revokes those (a share/team project can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline project is browser-local regardless of
  account: a signed-in user's offline projects do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** project ([Auth + guest access](../014-identity/auth-and-guest-access.md)): a guest's cloud project is
  on the server and in liveworkspace's index under the guest's liveworkspace identity, and moves to the account at sign-in;
  an offline project never touches the server at all.
- Sign-in / sign-out never migrates offline projects by itself (the index's guest-to-account move, [Auth + guest access](../014-identity/auth-and-guest-access.md#guest--account),
  only moves a guest's _cloud_ projects). After signing in, a prompt
  **offers** to move them ([Moving projects kept Offline after signing in](../014-identity/auth-and-guest-access.md#moving-offline-projects-after-signing-in));
  a project the person leaves stays put.
- The "Offline" badge and pill read the same for a guest as for anyone: the
  sentence about clearing site data is the one a guest most needs to see.

## Persistence architecture

The editor has a **single persistence boundary**: `apps/editor/lib/api-client.ts`
(a barrel over `lib/api/*`); nothing in the editor calls `fetch` directly. Offline
Mode is implemented **behind that boundary** so the editor is unaware of the
target:

- **One store, bound per editor.** The store's operations (the write chain, the one-transaction updates, the
  reads, the Trash rules, Sync Canvas's delete-if-unchanged) are one copy every editor shares
  (`@liveworkspace/workbench/lib/offline/offline-store-core`). `lib/offline/offline-store.ts` binds it with its
  IndexedDB backend, whose database and store names and versions stay this editor's own, and keeps its own
  extra writes.
- **Dispatch per call, not a backend pair.** Each load / save / delete in `lib/api/*` opens with
  `if (await isOfflineId(id))` and hands off to `lib/offline/offline-store.ts`, otherwise it calls the api. There is
  no second class to keep in step with the first, and an endpoint that offline has no answer for never grows the
  branch.
- Offline ids are client-generated (`crypto.randomUUID`) and registered in a
  local index; `isOfflineId` reads it. The `beforeunload` beacon flush cannot
  await, so it uses the synchronous `isOfflineIdSync` off the loaded cache.
- **Listing is the exception that is not a dispatch.** The Explorer shows both
  sets at once, so it MERGES the api list with the local one, and still returns
  the offline rows when the cloud fetch fails.
- **Create is the one caller-decided branch**, because there is no registered id
  to dispatch on yet: the New Project wizard calls `offlineCreateProject`
  directly when the location is Offline (a guest's default), and
  that call is what registers the id every later operation routes on.
- Only the project/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  project (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page, with no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Flip on Offline Mode when you create a project and it is saved only in
> your browser: no account, no server, no sync. Yours alone. Move it to the cloud (or pull one
> back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a project
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([One help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md))

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and (per the help-registry rule) **register it in
`liveworkspace/apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Project wizard's Save
  location chooser, [Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data: the durability warning, stated plainly.
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
  the shared `useOfflineConversion` handlers, from `useSyncInPlace` for the
  Share dialog, and per project from the move prompt.
- No project content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline projects**: that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing**: offline is single-user by nature.
- **Not** offline-resilience for cloud projects (editing a cloud project through
  a network blip): that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion**: a project never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action (pressing Share,
  Sync Project, or Move on the prompt after signing in).

## Implementation map

- `apps/editor/lib/api-client.ts` + `lib/api/*`: the persistence seam, each call dispatched per project through
  the local index (`isOfflineId`) to `lib/offline/offline-store.ts` (IndexedDB) or the api.
- `/new` ([Dedicated route for new-project creation](../007-editor/new-project-route.md)) asks nothing: the store
  follows who is creating ([Save Locations](save-locations.md)).
- Explorer (row + card components, `ThisBrowserPill`): merge the local index,
  show the **Offline** pill wherever an offline project is listed plus a
  fixed offline thumbnail everywhere, and skip server fetches for offline rows.
- Guest default + instant open: `lib/save-locations.ts` (`defaultSaveLocationFor`),
  `lib/signed-in-hint.ts`, `app/new/useNewProjectLocation.ts`, the early open in
  `app/project/[id]/useIdentityBootstrap.ts` with `app/project/[id]/resolve-participant.ts`.
- Share's offline gate and syncing in place: `components/dialogs/ShareOfflineGate.tsx`,
  `app/project/[id]/useSyncInPlace.ts`, `subscribeOfflineIds` in `lib/offline/offline-store.ts`.
- The move prompt after signing in: `components/dialogs/LocalMovePrompt.tsx`,
  `hooks/persistence/useLocalMovePrompt.ts`, `../packages/workbench/src/lib/offline/local-move-dismissal.ts`.
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Project" and "Take Offline" (with confirmation).
- `apps/marketing`: the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `liveworkspace/apps/help`: the "Offline Mode" article + its `articles.ts` registry entry
  ([One help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md)).
- Telemetry: the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Business model + licence](../002-project-scope/business-model-and-licence.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Project structure](project-structure.md) (project model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[Dedicated route for new-project creation](../007-editor/new-project-route.md) (New Project),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[One help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime, the separate concern),
[Save Locations](save-locations.md) (the Save location chooser).
