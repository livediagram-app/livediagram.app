# Tab ↔ design many-to-many

> **No longer how tabs work.** Each design keeps its own content in its own Durable Object
> ([API app](../015-api/api.md) "Storage"), so a tab belongs to exactly one design and cannot be shared between
> two. **Add to Design** copies the tab into the other design as a new tab (`apiCopyTabTo`,
> `apps/live/lib/api/tabs.ts`); there is no link route. The `design_tabs` table survives inside each design's
> SQLite as its tab order. What follows records the shared-tab design and its migrations, which are gone.

## Why

Originally every `tabs` row carried a single `design_id` FK — one tab belonged to one design. That worked for the editor's "tabs are folders inside a design" mental model, but it forecloses a category of features the user has flagged for the next phase:

- **Copy a tab between designs** without duplicating the content (so an edit in one tab propagates to the other).
- **A reference tab** that lives in several designs at once — e.g. a glossary, a shared timeline, a brand's logo pages that are part of two product lines' workspaces.
- **Change log without per-design scoping** (paired with item #14; the change log itself was removed on 2026-10-03, see [Collaboration](../012-collaboration/README.md)): once a tab can live in multiple designs, attributing a change to a single `(design_id, tab_id)` pair stops being meaningful. The change should be on the tab; consumers join through the link table when they care which designs it surfaces in.

The migration sequences as items #13 → #14 → #15 → #16 in the post-prototype haul. #13 adds the link table; #14 drops the now-redundant `change_log.design_id`; #15 denormalises participant metadata out of `change_log`; #16 ages out old `change_log` rows on a cron. (Migration 0064 later dropped `change_log` outright along with the Activity panel.)

## Data model

New table:

```sql
CREATE TABLE design_tabs (
  design_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (design_id, tab_id),
  FOREIGN KEY (design_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id)     REFERENCES tabs(id)     ON DELETE CASCADE
);

CREATE INDEX design_tabs_by_design ON design_tabs(design_id, order_index);
CREATE INDEX design_tabs_by_tab     ON design_tabs(tab_id);
```

`order_index` lives on the link, not on the tab — two designs that share a tab can order it independently. `added_at` lets us surface "added to this design on date X" later. A later migration (0018, [Tab folders](tab-folders.md)) adds a nullable `folder` column to this table for the same reason: tab-folder membership is per-design, so a shared tab can be foldered in one design and loose in another.

The link is the only place a tab meets a design. `tabs` holds the body (`id, name, data, updated_at`, [Per-tab storage](per-tab-storage.md)) and no pointer to any design: migration 0049 dropped the original `tabs.design_id` and `tabs.order_index`, which 0011 had backfilled `design_tabs` from. That column's `ON DELETE CASCADE` meant deleting the design a tab was created in destroyed the tab in every other design, even after it had been removed from that first design.

### Tab lifecycle

- **Create tab** — insert one row into `tabs`, one row into `design_tabs` pointing it at the owning design.
- **Add tab to another design** — `INSERT INTO design_tabs (design_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)`. No change to `tabs`. Edits to the tab propagate to every design referencing it.
- **Remove tab from a design** — `DELETE FROM design_tabs WHERE design_id = ? AND tab_id = ?`. If no rows remain referencing the tab, the `tabs` row AND every collaboration-index and `image_refs` row keyed by that tab id are dropped in the same call (atomic on the server). When other designs still link the tab, the body stays, so any design that still surfaces the tab still surfaces its content. The server handles it with full knowledge of the link-count.
- **Delete a design** — everything the design stored goes with it: its Durable Object drops its tabs, their collaboration and `image_refs` rows and its link rows at once (the room's `/purge`, `apps/api/src/room-internal.ts`). A tab is held by exactly one design now (each design's content is its own Durable Object, [API](../015-api/api.md) "Storage"), so no other design keeps one. Every path that removes a design takes this route: the [Trash](../013-workspace/trash.md) purge (a delete first moves the design to the Trash, touching no tab, and removal happens 30 days later, or at once on Delete permanently / Empty Trash / `?permanent=true`), Take Offline ([Offline Mode](offline-mode.md)), and account deletion. While a design waits in the Trash its tabs stay where they are.

### Shared-tab notice

A **shared tab** is a tab linked into more than one design. Removing a design is safe for its shared tabs, but the user cannot see that from the design alone, so the Take Offline confirmation says it first. (A delete asks nothing: it goes to the Trash with an Undo, and a restore brings back the design's links to its tabs.) `GET /api/designs/:id/shared-tabs` answers `{ sharedTabs: { tabs, designs } }`: how many of the design's tabs are also linked elsewhere, and how many distinct other designs hold them. It answers exactly the callers who may delete the design (owner, or a joined member of its team; `mayDeleteDesign`), in the DELETE's order: 400 with no caller, 404 when missing, 403 otherwise.

The confirmation reads the counts before it opens (`fetchSharedTabsNotice`, `apps/live/lib/shared-tabs-notice.ts`) and, when `tabs` is above zero, adds one sentence:

- **Take Offline** ([Offline Mode](offline-mode.md)): _"2 of its tabs are also used in 1 other design; they stay there, and the copies in this browser no longer share edits with them."_

Singular forms read _"1 of its tabs is ... it stays there"_ and _"1 other design"_. An offline design has no shared tabs and makes no request. The read waits at most `SHARED_TABS_NOTICE_TIMEOUT_MS` (1500 ms); when it fails or runs out of time the confirmation opens without the sentence (the api client reports the failure), since the server keeps shared tabs either way and the notice is information, not the safeguard. The counts are read before the dialog renders so its content never changes under the pointer.

## API impact

`GET /api/designs/:id` returns the design with its tab summaries — the join now goes through `design_tabs`:

```sql
SELECT t.id, t.name, dt.order_index
  FROM design_tabs dt
  JOIN tabs t ON t.id = dt.tab_id
 WHERE dt.design_id = ?
 ORDER BY dt.order_index ASC
```

`PUT /api/designs/:id/tabs/:tabId` (tab body write) is unchanged on the surface but the implementation no longer scopes by `design_id` to find the row — the tab id is globally unique. The caller's permission to edit the tab is still gated by their permission on at least one design that contains it (owner of any containing design, OR an edit-role share code for any containing design).

`POST /api/designs/:id/tabs/:tabId/link` adds an existing tab into the target design. Idempotent: same `(design_id, tab_id)` pair returns 200 without duplicating the link row (`ON CONFLICT DO NOTHING`). Auth: caller must own the target design AND own at least one design that already contains the tab (so a stranger can't graft a tab they have no read access to). Returns the resulting tab summary. The tab menu's **Add to Design** row opens a centred modal (`AddTabToDesignDialog`): a filterable tile grid of the caller's other designs, replacing the old in-menu list; each tile shows the destination design's cached snapshot preview ([Design SVG snapshots](design-snapshots.md), the same `DesignThumbnail` the Explorer rows use, versioned by `savedAt`) over its name, so the user picks by recognising the canvas rather than parsing a list of near-identical names; picking one calls this endpoint. Because only the design's owner can make the link, the row offers no destinations, and so is disabled, on a design the caller doesn't own (an Editor on someone else's link), in an offline design and in a workbench (`addToDesignTargets`, `apps/live/lib/add-to-design-targets.ts`); it never offers a call that can only fail. Subsequent edits on either side write to the same `tabs.data` row, so changes propagate.

`DELETE /api/designs/:id/tabs/:tabId` now removes the link row first, then drops the underlying `tabs` row only when no other `design_tabs` entries reference it. Unlinking a shared tab from one design leaves the body intact for the others.

`POST /api/designs/:id/copy` (item #9) copies tab bodies into freshly minted tab rows — that doesn't change. The new tab rows get fresh ids and their own `design_tabs` entries pointing at the new design, and any tab / element link, and any Tab Window's tab, in a copied body is re-pointed from the source tab id to its copy's (`remapTabLinks`, `@livedesign/design`). Cloning vs linking is a deliberate distinction: copy = independent content, link = shared content.

## Phasing

This spec describes the destination. The implementation lands in stages so each can be tested in isolation:

1. **Migration 0011** — add `design_tabs`, backfill from `tabs.design_id` / `tabs.order_index`. Reads go through the link table; writes update both the link table AND the legacy columns. No surface change.
2. **Item #14 — drop `change_log.design_id`** — change_log entries already key by `tab_id`; the `design_id` was just denormalisation. Migration drops the column, queries that filtered by `design_id` now derive the design set via `design_tabs`.
3. **Item #15 — drop denormalised participant metadata from `change_log`** — `participant_name` and `participant_color` columns were copy-on-write snapshots for offline-friendly reads. Drop and join through `participants` on read instead.
4. **Item #16 — 90-day `change_log` cron** — daily worker cron deletes `change_log` rows older than 90 days. Capacity guard against unbounded growth as collab traffic ramps up.
5. **Migration 0049 — drop `tabs.design_id` + `tabs.order_index`.** A table rebuild; `tabs` is a parent table, so the migration parks and restores every `design_tabs`, `change_log` and collaboration-index row across the drop. Design deletion became link-aware first ("Delete a design" above), since with the column gone nothing else removes a tab its last design leaves behind.

## Cross-references

- [API app](../015-api/api.md) — endpoint dispatch + the underlying schema overview. Updated alongside the migration in #13.
- [Per-tab storage](per-tab-storage.md) — the per-tab storage rationale. Still applies; the link table is orthogonal to where the tab body lives.
