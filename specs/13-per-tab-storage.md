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
- Foundation for future "this tab is shared across diagrams" reuse
  (out of scope here — see "Non-goals").

## Non-goals (V1)

- Sharing a tab across diagrams (the data model permits it; the UX
  and bookkeeping for it are a separate spec).
- Per-element rows / CRDT. Each tab still serialises its `elements`
  array as JSON within its row; the granularity stops at the tab.
- Online migration. The cutover is one D1 migration; the live app
  hydrates the new schema on the next save.

## Data model

Migration `0005_tabs.sql`:

```sql
-- One row per tab. Tabs belong to exactly one diagram in V1; the FK
-- + cascade keeps cleanup automatic. `order_index` is the position
-- within the diagram so the API can return tabs in a deterministic
-- order without a separate join.
CREATE TABLE tabs (
  id           TEXT PRIMARY KEY,
  diagram_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  order_index  INTEGER NOT NULL,
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

## Cutover (historical)

How this rolled out, recorded here so future schema changes can repeat the pattern:

1. Migration 0005 created the `tabs` table + a same-migration backfill SQL step that split every existing `diagrams.data` JSON into N rows of `tabs` (one per array element), assigning `order_index` from the array position.
2. `diagrams.data` was kept in place for one release window so a deployed-but-not-yet-shipped client didn't 500.
3. Migration 0006 dropped `diagrams.data`.

## Audit log

The `change_log` table has `tab_id` (nullable for diagram-level entries) and cascades on `diagram_id`. There's intentionally no hard FK from `change_log.tab_id` to `tabs.id` — log entries should outlive the row they reference so historical events still read after a tab is deleted. The client's `deleteTab` flow still calls `DELETE /log/tab/:tabId` to drop the dangling entries — see [12-activity-and-audit.md](12-activity-and-audit.md).

## Risk

- D1 doesn't currently support cross-row transactions cleanly, so the
  backfill is per-diagram in its own statement set. If the backfill
  step partially fails, the migration tracker re-runs it.
- Tab reorder is a `UPDATE tabs SET order_index = ? WHERE id = ?` per
  tab. Acceptable for the small tab counts (< 20) we see in practice.

## What this does NOT change

- The owner-only audit log gate (still applies).
- Realtime presence (still room-level).
- Sharing (per-diagram share codes; no per-tab sharing yet).
- The frontend `Tab` type shape (just where it's persisted).
