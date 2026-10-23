# Explorer Details view

**Moved to liveworkspace's index (October 2026).** The Details view is the shared Explorer's. Its columns come from the index's item rows and the summary each item pushes, not from livedocuments' own tables.

livedocuments still keeps per-tab stats (`tab_stats`, `apps/api/src/db/tab-stats.ts`) and folds them into the summary a document pushes to the index (`PUT /app/items/:id/summary`, `apps/api/src/document-room/document-outbox.ts`), on idle and at most once a minute.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "What an item pushes". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
