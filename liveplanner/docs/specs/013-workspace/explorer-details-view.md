# Explorer Details view

**Moved to liveworkspace's index (October 2026).** The Details view is the shared Explorer's. Its columns come from the index's item rows and the summary each item pushes, not from liveplanner's own tables.

liveplanner still keeps per-tab stats (`tab_stats`, `apps/api/src/db/tab-stats.ts`) and folds them into the summary a plan pushes to the index (`PUT /app/items/:id/summary`, `apps/api/src/plan-room/plan-outbox.ts`), on idle and at most once a minute. Each row also keeps the tab's kind, written with the stats at every tab write, so `GET /api/projects/:id/tabs` (the Share dialog's tab picker on liveworkspace.app) names every tab's kind without reading a tab body.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "What an item pushes". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
