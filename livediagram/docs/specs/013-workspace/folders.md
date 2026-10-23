# Folders

Folders are liveworkspace's index's. There is one tree per person and one per team, and a folder holds items from any
app: a canvas can sit beside items from the other apps. Deleting a folder moves its folders and items up a level. The
shared Explorer's folder views, breadcrumbs and Move dialog (`MoveToFolderDialog`) read and write the index.

New from inside a folder or a team carries the place into the `/new` flow (`?folder=`, `?team=`), and the created
canvas is registered there. API clients can list the caller's folders at `GET /api/folders` ([API](../015-api/api.md)),
which reads the index.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, tags, favourites,
defaults". The Explorer that shows it is the shared package,
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
