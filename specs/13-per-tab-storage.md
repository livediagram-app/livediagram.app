# Per-tab storage

Move from the single-row `diagrams.data` JSON blob (which serialises every
tab on every save) to a normalised `diagrams` + `tabs` split where each
tab is its own row. The autosave path then only ships the tab that
actually changed.

Driven by the observation that today, every keystroke broadcasts a
`tabs` op AND PUTs the whole diagram — including unchanged tabs — to
D1. Cost grows linearly with the diagram's tab count.

## Goals

- One DB write per editorial commit, scoped to the changed tab.
- Per-tab snapshot fetch (open one tab, hydrate one row) so the
  initial view of a many-tab diagram is fast.
- Foundation for "this tab is shared across diagrams" reuse — landed in [spec/17](17-tab-diagram-many-to-many.md) (migration 0011 / item #13). The link table sits over the same tab body rows described here.

## Non-goals (V1)

- ~~Sharing a tab across diagrams~~ — landed in [spec/17](17-tab-diagram-many-to-many.md) (migration 0011). The link table lives next to `tabs`; `tabs` itself is unchanged in this spec's terms.
- Per-element rows / CRDT. Each tab still serialises its `elements`
  array as JSON within its row; the granularity stops at the tab.
- Online migration. The cutover is one D1 migration; the live app
  hydrates the new schema on the next save.

## Data model

Migration `0005_tabs.sql`:

As originally shipped in `0005_tabs.sql`:

```sql
-- One row per tab. The diagram_id column + cascade kept cleanup
-- automatic when this migration landed; spec/17 since added the
-- diagram_tabs link table that makes the relationship many-to-many
-- and migrates the canonical "which diagram does this tab belong
-- to" pointer off this row. The legacy diagram_id + order_index
-- columns are kept in sync by writes during the dual-write phase
-- and will be dropped in a follow-up migration once every reader
-- has moved off them.
CREATE TABLE tabs (
  id           TEXT PRIMARY KEY,
  diagram_id   TEXT NOT NULL,       -- legacy, see spec/17
  name         TEXT NOT NULL,
  order_index  INTEGER NOT NULL,    -- legacy, see spec/17
  -- Same JSON shape as the Tab type minus { id, name } (which live
  -- on the row). Holds elements + per-tab metadata: theme,
  -- backgroundColor, backgroundPattern, backgroundOpacity,
  -- patternColor, locked. `templateChosen` is intentionally ephemeral
  -- client state (see migration 0009) — stripped before persistence,
  -- never stored here.
  data         TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX tabs_diagram_idx ON tabs(diagram_id, order_index);
```

Migration 0011 (spec/17) added `diagram_tabs (diagram_id, tab_id, order_index, added_at)`. Reads now go through the link table; writes touch both `tabs.diagram_id` / `tabs.order_index` (for compat) and `diagram_tabs` (canonical). The legacy two columns will be dropped once every reader is off them.

`diagrams` keeps `id`, `owner_id`, `name`, `shareable`, `folder_id`, `saved_at`, `created_at`. The `data` column was dropped in migration 0006 once the live app had been on the new schema for a release window.

## API surface

Owner / edit-role.

- `GET    /api/diagrams/:id` — returns diagram metadata + tab list
  (id, name, order; no `data`).
- `GET    /api/diagrams/:id/tabs/:tabId` — full tab payload (data + everything).
- `PUT    /api/diagrams/:id/tabs/:tabId` — upsert a single tab (active edit path).
- `DELETE /api/diagrams/:id/tabs/:tabId` — remove a tab.
- `PUT    /api/diagrams/:id` — diagram-level fields only (rename,
  tab order, shareable). Body
  carries `tabIds: string[]` in
  the new order; the API
  persists the order index
  without touching tab content.

The existing `GET /api/diagrams/:id` body grows a `tabs:
TabSummary[]` field instead of `tabs: Tab[]`. The whole-diagram
PUT goes away.

Realtime room op stays element-level for the cursor / select / log
broadcasts; the `tabs` op shrinks to `{ kind: 'tab', tabId, tab }`
so peers only get the one that changed.

## Live app

1. On hydration: fetch the diagram + tab summaries. The active tab is
   lazily fetched (single `GET /tabs/:id`); other tabs hydrate
   on-demand when the user clicks them or when a peer's `tab` op
   targets them.
2. Autosave: debounced per tab, calls
   `PUT /api/diagrams/:id/tabs/:activeTabId` with the changed tab.
3. Tab rename / reorder go through the diagram-level PUT; element
   edits go through the tab-level PUT.
4. The room op shrinks accordingly.

### Loading & failure UX for the lazy fetch

A tab summary carries no `elements`, so before its `GET /tabs/:id`
lands the tab is an empty placeholder. The canvas MUST NOT render its
normal "Empty canvas" prompt over that placeholder — it reads as "your
diagram is gone", and worse, if the user starts adding elements to the
blank canvas the autosave persists the empty-plus-new tab and **wipes
the real server row**. So while the active tab's content is outstanding:

- **Loading**: an opaque, pointer-capturing overlay covers the canvas
  (palette included) with a spinner. It blocks all canvas interaction so
  no edit can race the fetch. The header + TabBar stay live, so the user
  can still switch tabs or navigate away.
- **Error**: if the fetch _fails_ (network down / 5xx — distinct from a
  legitimate 404, which means the tab genuinely has no content) the same
  overlay shows a "couldn't load this tab" card with a **Retry** that
  re-issues the fetch. Editing stays blocked so the blank canvas can't
  overwrite the unfetched content.

Only tabs that originate on the server take part in this. A tab created
locally (add / duplicate / import) is treated as already-loaded — its
content is authoritative in memory and there is nothing to fetch — so it
never flashes a loader and drops straight into the per-tab template
picker. A tab whose elements a realtime peer already delivered likewise
renders immediately rather than showing a spinner over real content.

### Autosave guard: never persist an unloaded tab

The loading overlay above protects the **active** tab. A separate, subtler
wipe path hits **background** tabs and the overlay does nothing for it:

A many-tab diagram hydrates every non-active tab as an empty placeholder
(no `elements` until opened). The autosave diff (`computeTabSaveDiff`) is
identity-based — it persists any tab whose object reference changed since
the last save. So a **non-content** operation that re-maps the tab array —
filing tabs into a folder, reordering, a bulk tab edit — bumps the
reference of tabs the user never opened, the diff flags those empty
placeholders as "changed", and the per-tab `PUT` overwrites their real
server rows with `{ elements: [] }`. (Observed in production: filing four
tabs into a folder wiped the two that hadn't been opened that session.)

Invariant: **a tab is eligible for a content write only when its content
is authoritative in memory** — it is in the loaded set (`markTabLoaded`:
hydration's active tab, a fetched tab, or a locally-created one) OR it
already carries elements (peer-delivered). An unloaded, still-empty
placeholder is never persisted, no matter what bumped its reference.
Reorders and renames still flow through the diagram-level meta `PUT`
(which never touches tab bodies), so organising background tabs stays
safe. The guard lives in `computeTabSaveDiff`, the one autosave decision
kernel both the debounced save and the `beforeunload` flush share.

## Cutover (historical)

How this rolled out, recorded here so future schema changes can repeat the pattern:

1. Migration 0005 created the `tabs` table + a same-migration backfill SQL step that split every existing `diagrams.data` JSON into N rows of `tabs` (one per array element), assigning `order_index` from the array position.
2. `diagrams.data` was kept in place for one release window so a deployed-but-not-yet-shipped client didn't 500.
3. Migration 0006 dropped `diagrams.data`.

## Audit log

The `change_log` table is tab-scoped — its row carries a `tab_id` (every entry in practice; the column is nullable for historical reasons) and cascades on `tab_id` via the FK to `tabs(id)`. The legacy `diagram_id` column on `change_log` was dropped in migration 0012 (item #14 — see [spec/17](17-tab-diagram-many-to-many.md)); per-diagram log reads derive the set of contributing tabs via `diagram_tabs`. The client's `deleteTab` flow still calls `DELETE /log/tab/:tabId` to drop the entries up front — see [12-activity-and-audit.md](12-activity-and-audit.md).

## Risk

- D1 doesn't currently support cross-row transactions cleanly, so the
  backfill is per-diagram in its own statement set. If the backfill
  step partially fails, the migration tracker re-runs it.
- Tab reorder is a `UPDATE tabs SET order_index = ? WHERE id = ?` per
  tab. Acceptable for the small tab counts (< 20) we see in practice.

## What this does NOT change

- The owner-only audit log gate (still applies).
- Realtime presence (still room-level).
- Sharing (per-diagram share codes; no per-tab sharing yet). Tab-level reuse across diagrams is a server-side relationship under spec/17, not user-visible sharing.
- The frontend `Tab` type shape (just where it's persisted).
