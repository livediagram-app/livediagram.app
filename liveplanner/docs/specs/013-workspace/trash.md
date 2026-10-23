# Trash

**Moved to liveworkspace's index (October 2026).** The Trash is the index's. Deleting a plan moves it to the Trash for 30 days, restorable to its folder, and the index's daily sweep purges it after that, telling liveplanner to delete the plan's content. A trashed item is reached only by its owner and team, so a share link to it grants nothing. The shared Explorer's Trash view offers Restore, Delete Forever and Empty Trash. liveplanner's trash columns, its local Trash and its daily purge are gone.

An editor left open on a plan that was trashed has its saves refused (410 `project_trashed`) and shows the deleted state. API clients can still list, restore and delete trashed plans at `/api/trash` ([API](../015-api/api.md)), which reads and writes the index.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
