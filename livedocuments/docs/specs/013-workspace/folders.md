# Folders

**Moved to liveworkspace's index (October 2026).** Folders are the index's. There is one tree per person and one per team, and a folder holds items from any app: a Document can sit beside items from the other apps. Deleting a folder moves its folders and items up a level. livedocuments' `folders` table, its folder routes and its placement resolver are gone; the shared Explorer's folder views, breadcrumbs and Move dialog (`MoveToFolderDialog`) read and write the index.

New from inside a folder or a team carries the place into the `/new` flow (`?folder=`, `?team=`), and the created document is registered there. API clients can list the caller's folders at `GET /api/folders` and make one with `POST /api/folders` ([API](../015-api/api.md)), both at the index as the caller.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, favourites, defaults". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
