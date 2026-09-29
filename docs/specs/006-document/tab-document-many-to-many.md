# Tab ↔ diagram many-to-many

## Why

Originally every `tabs` row carried a single `diagram_id` FK — one tab belonged to one diagram. That worked for the editor's "tabs are folders inside a diagram" mental model, but it forecloses a category of features the user has flagged for the next phase:

- **Copy a tab between diagrams** without duplicating the content (so an edit in one tab propagates to the other).
- **A reference tab** that lives in several diagrams at once — e.g. a glossary, a shared timeline, an architecture diagram that's part of two product lines' workspaces.
- **Change log without per-diagram scoping** ([Activity and audit log](../012-collaboration/activity-and-audit.md) — paired with item #14): once a tab can live in multiple diagrams, attributing a change to a single `(diagram_id, tab_id)` pair stops being meaningful. The change should be on the tab; consumers join through the link table when they care which diagrams it surfaces in.

The migration sequences as items #13 → #14 → #15 → #16 in the post-prototype haul. #13 adds the link table; #14 drops the now-redundant `change_log.diagram_id`; #15 denormalises participant metadata out of `change_log`; #16 ages out old `change_log` rows on a cron.

## Data model

New table:

```sql
CREATE TABLE diagram_tabs (
  diagram_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (diagram_id, tab_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id)     REFERENCES tabs(id)     ON DELETE CASCADE
);

CREATE INDEX diagram_tabs_by_diagram ON diagram_tabs(diagram_id, order_index);
CREATE INDEX diagram_tabs_by_tab     ON diagram_tabs(tab_id);
```

`order_index` lives on the link, not on the tab — two diagrams that share a tab can order it independently. `added_at` lets us surface "added to this diagram on date X" later. A later migration (0018, [Tab folders](tab-folders.md)) adds a nullable `folder` column to this table for the same reason: tab-folder membership is per-diagram, so a shared tab can be foldered in one diagram and loose in another.

The link is the only place a tab meets a diagram. `tabs` holds the body (`id, name, data, updated_at`, [Per-tab storage](per-tab-storage.md)) and no pointer to any diagram: migration 0049 dropped the original `tabs.diagram_id` and `tabs.order_index`, which 0011 had backfilled `diagram_tabs` from. That column's `ON DELETE CASCADE` meant deleting the diagram a tab was created in destroyed the tab in every other diagram, even after it had been removed from that first diagram.

### Tab lifecycle

- **Create tab** — insert one row into `tabs`, one row into `diagram_tabs` pointing it at the owning diagram.
- **Add tab to another diagram** — `INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)`. No change to `tabs`. Edits to the tab propagate to every diagram referencing it.
- **Remove tab from a diagram** — `DELETE FROM diagram_tabs WHERE diagram_id = ? AND tab_id = ?`. If no rows remain referencing the tab, the `tabs` row AND every `change_log` entry and `image_refs` row keyed by that tab id are dropped in the same call (atomic on the server). When other diagrams still link the tab, both the body and the change_log entries stay: the activity log lives on the tab, so any diagram that still surfaces the tab still surfaces its history. Client-side cascades for tab delete (`apiDeleteChangeLogForTab`) are no longer fired in this path; the server handles it correctly with full knowledge of the link-count.
- **Delete a diagram** — the diagram-scoped form of removing a tab, in one atomic batch (`diagramRemovalStatements`, `apps/api/src/db/document-removal.ts`): every tab linked into the diagram that no other diagram links is dropped with its `change_log`, collaboration-index and `image_refs` rows, then the diagram row goes and `ON DELETE CASCADE` from `diagrams` removes its link rows. A tab another diagram still links survives whole there: body, history, index rows, and its order and folder in that diagram. Every path that removes a diagram takes this route: the [Trash](../013-workspace/trash.md) purge (a delete first moves the diagram to the Trash, touching no tab, and removal happens 30 days later, or at once on Delete permanently / Empty Trash / `?permanent=true`), Take Offline ([Offline Mode](offline-mode.md)), and account deletion (which keeps a tab shared into a diagram another owner holds). While a diagram waits in the Trash its tabs stay where they are, so a tab it shares carries on in the other diagram as before.

### Shared-tab notice

A **shared tab** is a tab linked into more than one diagram. Removing a diagram is safe for its shared tabs, but the user cannot see that from the diagram alone, so every confirmation that removes a diagram from the server says it first. `GET /api/diagrams/:id/shared-tabs` answers `{ sharedTabs: { tabs, diagrams } }`: how many of the diagram's tabs are also linked elsewhere, and how many distinct other diagrams hold them. It answers exactly the callers who may delete the diagram (owner, or a joined member of its team; `mayDeleteDiagram`), in the DELETE's order: 400 with no caller, 404 when missing, 403 otherwise.

The confirmation reads the counts before it opens (`fetchSharedTabsNotice`, `apps/live/lib/shared-tabs-notice.ts`) and, when `tabs` is above zero, adds one sentence:

- **Delete** (the Explorer page and editor modal, the Explorer panel's inline confirm, the team-library modal): _"3 of its tabs are also used in 2 other diagrams; they stay there."_
- **Take Offline** ([Offline Mode](offline-mode.md)): _"2 of its tabs are also used in 1 other diagram; they stay there, and the copies in this browser no longer share edits with them."_

Singular forms read _"1 of its tabs is ... it stays there"_ and _"1 other diagram"_. An offline diagram has no shared tabs and makes no request. The read waits at most `SHARED_TABS_NOTICE_TIMEOUT_MS` (1500 ms); when it fails or runs out of time the confirmation opens without the sentence (the api client reports the failure), since the server keeps shared tabs either way and the notice is information, not the safeguard. The counts are read before the dialog renders so its content never changes under the pointer.

## API impact

`GET /api/diagrams/:id` returns the diagram with its tab summaries — the join now goes through `diagram_tabs`:

```sql
SELECT t.id, t.name, dt.order_index
  FROM diagram_tabs dt
  JOIN tabs t ON t.id = dt.tab_id
 WHERE dt.diagram_id = ?
 ORDER BY dt.order_index ASC
```

`PUT /api/diagrams/:id/tabs/:tabId` (tab body write) is unchanged on the surface but the implementation no longer scopes by `diagram_id` to find the row — the tab id is globally unique. The caller's permission to edit the tab is still gated by their permission on at least one diagram that contains it (owner of any containing diagram, OR an edit-role share code for any containing diagram).

`POST /api/diagrams/:id/tabs/:tabId/link` adds an existing tab into the target diagram. Idempotent: same `(diagram_id, tab_id)` pair returns 200 without duplicating the link row (`ON CONFLICT DO NOTHING`). Auth: caller must own the target diagram AND own at least one diagram that already contains the tab (so a stranger can't graft a tab they have no read access to). Returns the resulting tab summary. The TabBar's "Add to Diagram" action (Organise category) opens a centred modal (`AddTabToDiagramDialog`): a filterable tile grid of the caller's other diagrams, replacing the old in-menu list; each tile shows the destination diagram's cached snapshot preview ([Diagram SVG snapshots](document-snapshots.md), the same `DiagramThumbnail` the Explorer rows use, versioned by `savedAt`) over its name, so the user picks by recognising the canvas rather than parsing a list of near-identical names; picking one calls this endpoint. Subsequent edits on either side write to the same `tabs.data` row, so changes propagate.

`DELETE /api/diagrams/:id/tabs/:tabId` now removes the link row first, then drops the underlying `tabs` row only when no other `diagram_tabs` entries reference it. Unlinking a shared tab from one diagram leaves the body intact for the others.

`POST /api/diagrams/:id/copy` (item #9) copies tab bodies into freshly minted tab rows — that doesn't change. The new tab rows get fresh ids and their own `diagram_tabs` entries pointing at the new diagram, and any tab / element link in a copied body is re-pointed from the source tab id to its copy's (`remapTabLinks`, `@livediagram/document`). Cloning vs linking is a deliberate distinction: copy = independent content, link = shared content.

## Phasing

This spec describes the destination. The implementation lands in stages so each can be tested in isolation:

1. **Migration 0011** — add `diagram_tabs`, backfill from `tabs.diagram_id` / `tabs.order_index`. Reads go through the link table; writes update both the link table AND the legacy columns. No surface change.
2. **Item #14 — drop `change_log.diagram_id`** — change_log entries already key by `tab_id`; the `diagram_id` was just denormalisation. Migration drops the column, queries that filtered by `diagram_id` now derive the diagram set via `diagram_tabs`.
3. **Item #15 — drop denormalised participant metadata from `change_log`** — `participant_name` and `participant_color` columns were copy-on-write snapshots for offline-friendly reads. Drop and join through `participants` on read instead.
4. **Item #16 — 90-day `change_log` cron** — daily worker cron deletes `change_log` rows older than 90 days. Capacity guard against unbounded growth as collab traffic ramps up.
5. **Migration 0049 — drop `tabs.diagram_id` + `tabs.order_index`.** A table rebuild; `tabs` is a parent table, so the migration parks and restores every `diagram_tabs`, `change_log` and collaboration-index row across the drop. Diagram deletion became link-aware first ("Delete a diagram" above), since with the column gone nothing else removes a tab its last diagram leaves behind.

## Cross-references

- [API app](../015-api/api.md) — endpoint dispatch + the underlying schema overview. Updated alongside the migration in #13.
- [Activity and audit log](../012-collaboration/activity-and-audit.md) — change_log shape. Updated in #14 + #15.
- [Per-tab storage](per-tab-storage.md) — the per-tab storage rationale. Still applies; the link table is orthogonal to where the tab body lives.
