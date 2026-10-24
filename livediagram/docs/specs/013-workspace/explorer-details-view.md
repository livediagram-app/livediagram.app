# Explorer Details view

The Details view is the shared Explorer's: a sortable table, one row per folder or item, beside List and Cards. Its
columns come from the index's item rows and the summary each item pushes.

livediagram keeps per-tab stats (`tab_stats`, `apps/api/src/db/tab-stats.ts`): each tab's element and comment
counts, the mode it was last written in and its stored size, kept by the canvas's own writes. It folds them into the
summary a canvas pushes to the index (`PUT /app/items/:id/summary`, `apps/api/src/document-room/document-outbox.ts`),
on idle and at most once a minute, so the Details view reads them with no request of its own. A canvas's preview
image is liveworkspace's, `GET /api/previews/items/:id` (`liveworkspace/docs/previews.md`).

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "What an item pushes". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
