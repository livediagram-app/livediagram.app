# Tab ↔ document many-to-many

## Status

Retired. A tab used to be a row of its own that any number of documents could link (`document_tabs` in D1), so one
tab body could show in two documents at once. Each document's content now lives in its own SQLite-backed Durable
Object ([API app, Storage](../015-api/api.md#storage)), so a tab belongs to exactly one document. This page records
what is left of the link table and what replaced the features it carried.

## Data model

The link table survives inside each document's own SQLite (`apps/api/src/document-room/document-schema.ts`):

```sql
CREATE TABLE document_tabs (
  document_id TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (document_id, tab_id),
  FOREIGN KEY (document_id) REFERENCES document (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
```

It holds the tab's place in its document: `order_index`, and the per-document `folder` ([Tab folders](tab-folders.md)).
`tabs` holds the body ([Per-tab storage](per-tab-storage.md)). Every row of both is the one document's.

### Tab lifecycle

- **Create tab** — insert one row into `tabs`, one row into `document_tabs` pointing it at the owning document.
- **Add tab to another document** — `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)`. No change to `tabs`. Edits to the tab propagate to every document referencing it.
- **Remove tab from a document** — `DELETE FROM document_tabs WHERE document_id = ? AND tab_id = ?`. If no rows remain referencing the tab, the `tabs` row AND every collaboration-index row keyed by that tab id are dropped in the same call (atomic on the server). When other documents still link the tab, the body stays, so any document that still surfaces the tab still surfaces its content. The server handles it with full knowledge of the link-count.
- **Delete a document** — a delete moves the document to the index's Trash, touching no tab. It is purged 30 days later, or at once on Delete permanently / Empty Trash / `?permanent=true`: the index drops its rows and asks livedocuments to drop the content (`DELETE /api/internal/items/:id`), which empties the document's Durable Object. Take Offline ([Offline Mode](offline-mode.md)) and account deletion take the same purge. While a document waits in the Trash its tabs stay where they are.

### Shared-tab notice

`GET /api/documents/:id/shared-tabs` still answers `{ sharedTabs: { tabs: 0, documents: 0 } }`, for the editors
that still ask before Take Offline (`fetchSharedTabsNotice`, `apps/editor/lib/shared-tabs-notice.ts`): no tab is
shared, so the confirmation never adds the sentence. It answers exactly the callers who may delete the document,
in the DELETE's order: 400 with no caller, 404 when missing, 403 otherwise.

## Add to Document

The tab menu's **Add to Document** row opens `AddTabToDocumentDialog`, a filterable tile grid of the caller's other
documents with their snapshot previews ([Document SVG snapshots](document-snapshots.md)). Picking one now copies
the tab there (`apiCopyTabTo`, `apps/editor/lib/api/tabs.ts`): the loaded tab, its elements under fresh ids
(`remintTabElements`), saved as a new tab of the target document. Edits on either side stay on that side. A tab
still loading is refused with a toast rather than copied empty. The row is offered for the same documents as before
(`addToDocumentTargets`, `apps/editor/lib/add-to-document-targets.ts`).

The `POST /api/documents/:id/tabs/:tabId/link` route is gone.

## Copies

`POST /api/documents/:id/copy` copies the tab bodies into fresh tab rows of the new document, in one transaction in
the new document's object (`importDocumentCopy`, `apps/api/src/document-room/document-content.ts`), and re-points
any tab or element link, and any Tab Window's tab, from the source tab id to its copy's (`remapTabLinks`,
`@livedocuments/document`).

## Cross-references

- [API app](../015-api/api.md): the Storage section and the endpoint table.
- [Per-tab storage](per-tab-storage.md): why a tab body is a row of its own.
