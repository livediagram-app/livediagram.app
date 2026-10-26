# Per-tab storage

Each tab of a design is its own row in the design's own SQLite, in its Durable Object `DesignRoom`
([API app](../015-api/api.md) "Storage"), so the autosave path ships only the tab that changed, and opening a design
reads one tab rather than every tab. A tab shared with other designs is a copy in each, kept in step
([Tab ↔ design many-to-many](tab-design-many-to-many.md)).

## Goals

- One write per editorial commit, scoped to the changed tab.
- Per-tab snapshot fetch (open one tab, hydrate one row) so the initial view of a many-tab design is fast.
- Reuse of one tab across designs, through the `design_tabs` link ([Tab ↔ design many-to-many](tab-design-many-to-many.md)).

## Non-goals

- Per-element rows / CRDT. Each tab serialises its `elements` array as JSON within its row; the granularity stops at
  the tab.

## Data model

```sql
CREATE TABLE tabs (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  -- The Tab type minus { id, name } (which live on the row): elements and per-tab metadata
  -- (theme, background, pattern, locked, kind, layers, ...). `templateChosen` is ephemeral
  -- client state, stripped before persistence, never stored here.
  data          TEXT    NOT NULL,
  updated_at    INTEGER NOT NULL,
  element_count INTEGER NULL,
  -- Advances by exactly one on every body write (the `tabs_rev_advances` trigger aborts any
  -- other), so a write against a stale rev fails rather than overwriting.
  rev           INTEGER NOT NULL DEFAULT 0
);
```

The schema is `apps/api/src/design-room/design-schema.ts`, made by the object's code on first use.

A `tabs` row is the tab's body and nothing else. Which tabs the design contains, and their order and folder, live on the `design_tabs` link ([Tab ↔ design many-to-many](tab-design-many-to-many.md)), and `tab_stats` holds each tab's counts for the Explorer's Details view ([Explorer details view](../013-workspace/explorer-details-view.md)). Removing a tab from the design drops its row once no link remains. `image_refs` has no foreign key ([Images, Reference index](../009-elements/images.md#reference-index)), so each delete path prunes a dropped tab's image references in the same batch.

`design` holds the design's own row: its name, owner and team as the grants and renames that reach it say, `saved_at` and `created_at` ([API app](../015-api/api.md) "Storage").

## API surface

Owner / edit-role.

- `GET    /api/designs/:id`: design metadata + tab list
  (id, name, order; no `data`).
- `GET    /api/designs/:id/tabs/:tabId`: full tab payload (data + everything).
- `PUT    /api/designs/:id/tabs/:tabId`: upsert a single tab (active edit path).
- `DELETE /api/designs/:id/tabs/:tabId`: remove a tab.
- `PUT    /api/designs/:id`: design-level fields only, `{ name?, tabs?, tabIds? }`. `name` renames the design;
  `tabs` (`{ id, folder }` entries in the new order, [Tab folders](tab-folders.md)) reorders and sets each tab's
  folder, `tabIds` the same without folders; the API persists the order without touching tab content.

`GET /api/designs/:id` carries `tabs: TabSummary[]`, never whole
tabs, and no design-level PUT carries tab content.

Realtime room ops stay element-level for the cursor / select / log
broadcasts; a whole-tab op is `{ kind: 'tab', tabId, tab }`, so peers
only get the one that changed.

## Live app

1. On hydration: fetch the design + tab summaries. The active tab is
   lazily fetched (single `GET /tabs/:id`); other tabs hydrate
   on-demand when the user clicks them or when a peer's `tab` op
   targets them.
2. Autosave: debounced per tab, calls
   `PUT /api/designs/:id/tabs/:activeTabId` with the changed tab.
3. Tab rename / reorder go through the design-level PUT; element
   edits go through the tab-level PUT.

### Loading & failure UX for the lazy fetch

A tab summary carries no `elements`, so before its `GET /tabs/:id`
lands the tab is an empty placeholder. The canvas MUST NOT render its
normal "Empty canvas" prompt over that placeholder; it reads as "your
canvas is gone", and worse, if the user starts adding elements to the
blank canvas the autosave persists the empty-plus-new tab and **wipes
the real server row**. So while the active tab's content is outstanding:

- **Loading**: an opaque, pointer-capturing overlay covers the canvas
  (palette included) with a spinner. The header + TabBar stay live, so the
  user can still switch tabs or navigate away.
- **Error**: if the fetch _fails_ the same overlay shows a "couldn't load
  this tab" card with a **Retry** that re-issues the fetch. Both network /
  5xx **and a 404** take this path: a legitimately-empty tab returns 200
  with `{ elements: [] }` (the row exists), and the tab being fetched is
  the active tab, which is always in the hydrated summary, so a 404 means
  the row is unexpectedly missing (a transient / mis-routed 404, a
  share-code edge, a row deleted under a stale summary), NOT that the tab
  is empty. Treating a 404 as authoritative-empty would mark the tab
  loaded and arm the autosave to overwrite the real row; routing it to
  Retry instead means a wrong 404 can never wipe content.

The overlay is **pointer-only**: it cannot block `window` keydown or
`design` paste, so the spinner alone is not the edit lock. The actual
guard is that the active tab's load state feeds the editor's single
`editsBlocked` gate (alongside locked-tab and view-only), so EVERY
commit-based mutator (shape shortcuts, paste, AI apply, import,
clear-canvas, drag) is refused until the tab is `ready`. The overlay and
the edit lock derive from the same `deriveTabLoadState`, so they can't
disagree.

Only tabs that originate on the server take part in this. A tab created
locally (add / duplicate / import) is treated as already-loaded: its
content is authoritative in memory and there is nothing to fetch, so it
never flashes a loader and drops straight into the per-tab template
picker. A tab whose elements a realtime peer already delivered likewise
renders immediately rather than showing a spinner over real content.

### Saving

- Changes save 600 ms after the last edit (the debounce). A page going to the background saves at once, since a
  phone may discard it there without another event.
- What the debounce still holds goes out when the editor goes: on `beforeunload`, on `pagehide` (iOS, a discarded
  tab, the back-forward cache) and when the editor unmounts for another page of the app. Those writes stay alive
  past the page while they fit the browser's keepalive budget (64 KB in all, 60 KB used); the rest are sent as
  plain requests, which land when the page lives on. Two events on the same way out send the content once.
- A text edit still open when the page goes (a label, an arrow label, a table cell, a one-line field) is part of
  what goes. It commits on blur, and a reload or a closed tab fires none, so on `beforeunload` and `pagehide` the
  flush first commits the open edit (`../packages/workbench/src/lib/open-edit.ts`, `useCommitOnLeave`), so a label typed and left open never
  comes back as its first letter.
- A tab's writes land in the order made: a save or delete of a tab waits for that tab's previous one to settle
  ([Collaboration race hardening](../012-collaboration/collab-race-hardening.md#saves)); other tabs never wait.

### New tabs and the tab order

The design's tab order (`PUT /api/designs/<id>`) only places tab rows that exist; a new tab's row is made by its
own tab save, which places it after the tabs the design had when that save read it. So a save that adds tabs (a
template's several tabs, an import, a duplicate) writes the order only once those new tabs' saves have settled. Sent
beside them, the order could land first and the new tabs, each taking the same place, came back after a reload
sorted by id rather than as made (Project Planner's Overview before its Daily Standup). A new tab whose save failed
does not hold the order back: the retried save writes the order again. The unload flush cannot wait and sends both
at once, as before.

### A refused save stops; a failed save doesn't

A failed save (a blip, a 5xx, a dropped connection) sets the status to `error`, toasts "Couldn't save your
changes. Check your connection." and retries, since the next attempt may well work (see Retrying a failed save).

A **403** is different. The server isn't failing, it's refusing: the share link was revoked, we were removed from
the team, or the role changed under us. No retry can succeed, and retrying on every keystroke would fire doomed PUTs
while blaming a connection that is fine, so someone could edit for an hour against a design that would never take a
single write.

So a 403 sets `writesForbiddenRef` and a distinct `forbidden` save status:

- The debounced save and the `beforeunload` beacon both bail while it's set,
  so the doomed retries stop.
- The toast fires **once** and says what actually happened, naming the likely
  cause and the way out (export a copy) rather than a connection to check.
- Opening a different design clears it; the block is about this one.

The user still loses the unsaved work, and no client-side design can prevent
that once the server has withdrawn write access. What it can do is say so
immediately and clearly, instead of an hour later.

### Retrying a failed save

A failed save (a network error or a 5xx; never a 403 or a sign-in problem) is retried on its own,
not only on the next edit: during an outage or a deploy, the last edit before someone stops typing
would otherwise wait for an edit that may never come. The retry waits 5 seconds, then doubles (10,
20, 40) up to a minute between attempts, and resets after a save succeeds. Each attempt re-sends
whatever still differs from the last saved state, so nothing is sent twice
(`apps/live/app/design/[id]/useAutosave.ts`, `saveRetryDelayMs`).

A save that never answers counts as failed too. Each tab's saves run one after another, so a request
left hanging on a stalled connection (a laptop switching networks can hold one open for minutes)
would hold back every later save of that tab. A tab save and a design meta save give up
after 20 seconds plus the time to upload their body at 16 KB/s (`saveTimeoutMs` in
`apps/live/lib/api/core.ts`: just over two and a half minutes for the largest tab), and the retry
above sends the newest content on a fresh connection.

### An unauthenticated save names the sign-in

A **401**, or a signed-in client with no session token to send
(`SessionTokenUnavailableError`, see [Auth + guest access](../014-identity/auth-and-guest-access.md)), is neither a
connection problem nor a refusal: the server couldn't tie the save to the
signed-in account. Production showed it as `Http401.SaveTab` bursts, each
toasting "Check your connection" on a wired fibre line.

So it gets its own `unauthenticated` save status (`saveFailureStatus` in
`save-failure.ts` maps every failure to exactly one status):

- The toast reads "Your sign-in has lapsed, so changes aren't saving. Sign in
  again."
- The autosave keeps retrying on the next edit, unlike `forbidden`: the
  session can come back, and when it does the next save lands.

Every failed save also reaches error telemetry exactly once
(`reportSaveFailure`): a failure the api client already reported
(`Http*`, `Network.*`, `Auth.NoSessionToken`) isn't counted again, and
anything else thrown on the save path reports as `SaveFailed.<Kind>`.

### A tab too big to save says so

A **413** (`payload_too_large`) is the server refusing a tab over its row cap
([Tab size](../015-api/api.md#tab-size), `MAX_TAB_BYTES`, just under 2 MB: about 5,000 labelled shapes). It is
neither a connection problem nor a refusal of the person: the same tab, made smaller, saves. Toasting "Couldn't save your changes. Check your connection." and retrying would be a save that could never
land.

So it gets its own `tooLarge` save status (`saveFailureStatus` in `save-failure.ts`):

- The toast reads "This tab is too big to save. Move some of it to another tab." It fires on the transition into
  `tooLarge`, as the others do.
- No retry timer: only an edit can change the size, and the next edit's save tries again (and lands once the tab
  is back under the cap, clearing the status).
- The last-chance flush on the way out still runs; it is refused the same way and changes nothing.
- Leaving the page asks first, as while saves fail ([Load recovery](../007-editor/load-recovery.md) "Leaving with
  unsaved changes asks first"): the changes are unsaved. The "Retrying" banner does not show, since nothing is retried.

### Autosave guard: never persist an unloaded tab

The loading overlay above protects the **active** tab. A separate, subtler
wipe path hits **background** tabs and the overlay does nothing for it:

A many-tab design hydrates every non-active tab as an empty placeholder
(no `elements` until opened). The autosave diff (`computeTabSaveDiff`) is
identity-based: it persists any tab whose object reference changed since
the last save. So a **non-content** operation that re-maps the tab array
(filing tabs into a folder, reordering, a bulk tab edit) bumps the
reference of tabs the user never opened, the diff flags those empty
placeholders as "changed", and the per-tab `PUT` overwrites their real
server rows with `{ elements: [] }`. (Observed in production: filing four
tabs into a folder wiped the two that hadn't been opened that session.)

Invariant: **a tab is eligible for a content write only when its content
is authoritative in memory**: it is in the loaded set (`markTabLoaded`:
hydration's active tab, a fetched tab, or a locally-created one) OR it
already carries elements (peer-delivered). An unloaded, still-empty
placeholder is never persisted, no matter what bumped its reference.
Reorders and renames still flow through the design-level meta `PUT`
(which never touches tab bodies), so organising background tabs stays
safe. The guard lives in `computeTabSaveDiff`, the one autosave decision
kernel both the debounced save and the `beforeunload` flush share.

A tab joins the loaded set only **once its content is in place**, never when
its fetch starts. A fetch in flight (the visit-time load, the background
sweep that search runs over every tab) is held in a separate
fetching set, which de-duplicates fetches but grants no write. Claiming the
loaded set up front once let any commit during a sweep save the empty
placeholders of every tab still loading, with `X-Allow-Empty`, past both
guards (tabs found wiped on reload). For the same reason the commit choke
point stamps a tab's `kind` only on tabs that commit changed or added: an
untouched placeholder keeps its object.

A fetched tab's content replaces what is on screen unless that already holds
elements (the user drew on it first). An empty placeholder never keeps the
fetched content out, whatever else it carries (a dismissed Quick Start's
`templateChosen` once did, and the tab then counted as loaded while still the
empty placeholder, so the autosave saved it over the stored tab). A fetch whose
content did not land does not make its tab loaded.

Landing fetched content never clears the undo history: it goes into the present
and into every undo and redo snapshot, under the same rule (a snapshot whose copy
of the tab is still the empty placeholder takes the content), the way a peer's
change does. Opening a tab for the first time, or the search sweep
loading the rest, once reset the history, so an undo after them had nothing to
undo; and a snapshot left holding the placeholder would let an undo put it back
over the loaded tab.

### Server backstop: refuse to blank a tab that has content

The client guards above are necessary but live in the editor; a future
client regression, or an older deployed client, could still `PUT` an
empty body over a populated row. So `PUT /api/designs/:id/tabs/:tabId`
enforces the invariant server-side too: if the incoming `elements` is
empty AND the stored row currently has elements, the write is **rejected
with 409** unless the request carries `X-Allow-Empty: 1`.

A legitimate **reset-canvas / delete-all** is performed on the active tab,
which is necessarily loaded (editing an unloaded tab is blocked), so the
editor sets `X-Allow-Empty: 1` for any tab in the loaded set; those
clears pass. The lazy-load wipe (a never-opened placeholder) is not in the
loaded set, so it carries no header and the backstop preserves the stored
row. An empty write over an already-empty / brand-new row, and any
non-empty write, are unaffected. This is intentionally independent of the
client guard: belt and suspenders against the most destructive failure.

### A save only ever reaches its own design's tab

The save upserts by tab id, against the design's own store: another design's tabs are in another design's object, so a
tab id seen elsewhere (a share link) can name only a new tab here, shared with nothing. A tab shared with other
designs ([Tab ↔ design many-to-many](tab-design-many-to-many.md)) is this design's own copy under the same id: the save writes that
copy, and this design's object sends it on to the others. Putting an existing tab into another design is the `link`
route, never a save.

## Risk

- Tab reorder rewrites every link's `order_index` (and folder) in one batch (`reorderTabs`). Acceptable for the
  small tab counts (< 20) seen in practice.

## What this does NOT change

- Realtime presence (still room-level).
- Sharing: share links are the index's, for a whole design or one tab ([Tab-scoped share links](../013-workspace/tab-scoped-share-links.md)). Tab reuse across designs is a relationship under [Tab ↔ design many-to-many](tab-design-many-to-many.md), not a share.
- The frontend `Tab` type shape (just where it's persisted).

## Import carries identity, not just content

When an exported tab lands in a receiving tab (`mergeImportedTab`), the **tab kind** and the **layers** travel with the elements and styling.

Without the kind, a tab could come back as something it was not. Without the layers, every imported element’s `layerId` dangles and the bands the author organised the tab into are lost ([Layers](layers.md)).

The merge rule lives in its own module so it is testable as a rule: what the import brings, what the receiving tab keeps (its id and name), and what must travel or the round trip loses meaning.
