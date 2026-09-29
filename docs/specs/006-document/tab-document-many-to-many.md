# Tab ↔ document many-to-many

## Why

Originally every `tabs` row carried a single `document_id` FK — one tab belonged to one document. That worked for the editor's "tabs are folders inside a document" mental model, but it forecloses a category of features the user has flagged for the next phase:

- **Copy a tab between documents** without duplicating the content (so an edit in one tab propagates to the other).
- **A reference tab** that lives in several documents at once — e.g. a glossary, a shared timeline, an architecture diagram that's part of two product lines' workspaces.
- **Change log without per-document scoping** ([Activity and audit log](../012-collaboration/activity-and-audit.md) — paired with item #14): once a tab can live in multiple documents, attributing a change to a single `(document_id, tab_id)` pair stops being meaningful. The change should be on the tab; consumers join through the link table when they care which documents it surfaces in.

The migration sequences as items #13 → #14 → #15 → #16 in the post-prototype haul. #13 adds the link table; #14 drops the now-redundant `change_log.document_id`; #15 denormalises participant metadata out of `change_log`; #16 ages out old `change_log` rows on a cron.

## Data model

New table:

```sql
CREATE TABLE document_tabs (
  document_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (document_id, tab_id),
  FOREIGN KEY (document_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id)     REFERENCES tabs(id)     ON DELETE CASCADE
);

CREATE INDEX document_tabs_by_document ON document_tabs(document_id, order_index);
CREATE INDEX document_tabs_by_tab     ON document_tabs(tab_id);
```

`order_index` lives on the link, not on the tab — two documents that share a tab can order it independently. `added_at` lets us surface "added to this document on date X" later. A later migration (0018, [Tab folders](tab-folders.md)) adds a nullable `folder` column to this table for the same reason: tab-folder membership is per-document, so a shared tab can be foldered in one document and loose in another.

The link is the only place a tab meets a document. `tabs` holds the body (`id, name, data, updated_at`, [Per-tab storage](per-tab-storage.md)) and no pointer to any document: migration 0049 dropped the original `tabs.document_id` and `tabs.order_index`, which 0011 had backfilled `document_tabs` from. That column's `ON DELETE CASCADE` meant deleting the document a tab was created in destroyed the tab in every other document, even after it had been removed from that first document.

### Tab lifecycle

- **Create tab** — insert one row into `tabs`, one row into `document_tabs` pointing it at the owning document.
- **Add tab to another document** — `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)`. No change to `tabs`. Edits to the tab propagate to every document referencing it.
- **Remove tab from a document** — `DELETE FROM document_tabs WHERE document_id = ? AND tab_id = ?`. If no rows remain referencing the tab, the `tabs` row AND every `change_log` entry and `image_refs` row keyed by that tab id are dropped in the same call (atomic on the server). When other documents still link the tab, both the body and the change_log entries stay: the activity log lives on the tab, so any document that still surfaces the tab still surfaces its history. Client-side cascades for tab delete (`apiDeleteChangeLogForTab`) are no longer fired in this path; the server handles it correctly with full knowledge of the link-count.
- **Delete a document** — the document-scoped form of removing a tab, in one atomic batch (`documentRemovalStatements`, `apps/api/src/db/document-removal.ts`): every tab linked into the document that no other document links is dropped with its `change_log`, collaboration-index and `image_refs` rows, then the document row goes and `ON DELETE CASCADE` from `documents` removes its link rows. A tab another document still links survives whole there: body, history, index rows, and its order and folder in that document. Every path that removes a document takes this route: the [Trash](../013-workspace/trash.md) purge (a delete first moves the document to the Trash, touching no tab, and removal happens 30 days later, or at once on Delete permanently / Empty Trash / `?permanent=true`), Take Offline ([Offline Mode](offline-mode.md)), and account deletion (which keeps a tab shared into a document another owner holds). While a document waits in the Trash its tabs stay where they are, so a tab it shares carries on in the other document as before.

### Shared-tab notice

A **shared tab** is a tab linked into more than one document. Removing a document is safe for its shared tabs, but the user cannot see that from the document alone, so every confirmation that removes a document from the server says it first. `GET /api/documents/:id/shared-tabs` answers `{ sharedTabs: { tabs, documents } }`: how many of the document's tabs are also linked elsewhere, and how many distinct other documents hold them. It answers exactly the callers who may delete the document (owner, or a joined member of its team; `mayDeleteDocument`), in the DELETE's order: 400 with no caller, 404 when missing, 403 otherwise.

The confirmation reads the counts before it opens (`fetchSharedTabsNotice`, `apps/live/lib/shared-tabs-notice.ts`) and, when `tabs` is above zero, adds one sentence:

- **Delete** (the Explorer page and editor modal, the Explorer panel's inline confirm, the team-library modal): _"3 of its tabs are also used in 2 other documents; they stay there."_
- **Take Offline** ([Offline Mode](offline-mode.md)): _"2 of its tabs are also used in 1 other document; they stay there, and the copies in this browser no longer share edits with them."_

Singular forms read _"1 of its tabs is ... it stays there"_ and _"1 other document"_. An offline document has no shared tabs and makes no request. The read waits at most `SHARED_TABS_NOTICE_TIMEOUT_MS` (1500 ms); when it fails or runs out of time the confirmation opens without the sentence (the api client reports the failure), since the server keeps shared tabs either way and the notice is information, not the safeguard. The counts are read before the dialog renders so its content never changes under the pointer.

## API impact

`GET /api/documents/:id` returns the document with its tab summaries — the join now goes through `document_tabs`:

```sql
SELECT t.id, t.name, dt.order_index
  FROM document_tabs dt
  JOIN tabs t ON t.id = dt.tab_id
 WHERE dt.document_id = ?
 ORDER BY dt.order_index ASC
```

`PUT /api/documents/:id/tabs/:tabId` (tab body write) is unchanged on the surface but the implementation no longer scopes by `document_id` to find the row — the tab id is globally unique. The caller's permission to edit the tab is still gated by their permission on at least one document that contains it (owner of any containing document, OR an edit-role share code for any containing document).

`POST /api/documents/:id/tabs/:tabId/link` adds an existing tab into the target document. Idempotent: same `(document_id, tab_id)` pair returns 200 without duplicating the link row (`ON CONFLICT DO NOTHING`). Auth: caller must own the target document AND own at least one document that already contains the tab (so a stranger can't graft a tab they have no read access to). Returns the resulting tab summary. The TabBar's "Add to Document" action (Organise category) opens a centred modal (`AddTabToDocumentDialog`): a filterable tile grid of the caller's other documents, replacing the old in-menu list; each tile shows the destination document's cached snapshot preview ([Document SVG snapshots](document-snapshots.md), the same `DocumentThumbnail` the Explorer rows use, versioned by `savedAt`) over its name, so the user picks by recognising the canvas rather than parsing a list of near-identical names; picking one calls this endpoint. Subsequent edits on either side write to the same `tabs.data` row, so changes propagate.

`DELETE /api/documents/:id/tabs/:tabId` now removes the link row first, then drops the underlying `tabs` row only when no other `document_tabs` entries reference it. Unlinking a shared tab from one document leaves the body intact for the others.

`POST /api/documents/:id/copy` (item #9) copies tab bodies into freshly minted tab rows — that doesn't change. The new tab rows get fresh ids and their own `document_tabs` entries pointing at the new document, and any tab / element link in a copied body is re-pointed from the source tab id to its copy's (`remapTabLinks`, `@livediagram/document`). Cloning vs linking is a deliberate distinction: copy = independent content, link = shared content.

## Phasing

This spec describes the destination. The implementation lands in stages so each can be tested in isolation:

1. **Migration 0011** — add `document_tabs`, backfill from `tabs.document_id` / `tabs.order_index`. Reads go through the link table; writes update both the link table AND the legacy columns. No surface change.
2. **Item #14 — drop `change_log.document_id`** — change_log entries already key by `tab_id`; the `document_id` was just denormalisation. Migration drops the column, queries that filtered by `document_id` now derive the document set via `document_tabs`.
3. **Item #15 — drop denormalised participant metadata from `change_log`** — `participant_name` and `participant_color` columns were copy-on-write snapshots for offline-friendly reads. Drop and join through `participants` on read instead.
4. **Item #16 — 90-day `change_log` cron** — daily worker cron deletes `change_log` rows older than 90 days. Capacity guard against unbounded growth as collab traffic ramps up.
5. **Migration 0049 — drop `tabs.document_id` + `tabs.order_index`.** A table rebuild; `tabs` is a parent table, so the migration parks and restores every `document_tabs`, `change_log` and collaboration-index row across the drop. Document deletion became link-aware first ("Delete a document" above), since with the column gone nothing else removes a tab its last document leaves behind.

## Cross-references

- [API app](../015-api/api.md) — endpoint dispatch + the underlying schema overview. Updated alongside the migration in #13.
- [Activity and audit log](../012-collaboration/activity-and-audit.md) — change_log shape. Updated in #14 + #15.
- [Per-tab storage](per-tab-storage.md) — the per-tab storage rationale. Still applies; the link table is orthogonal to where the tab body lives.
