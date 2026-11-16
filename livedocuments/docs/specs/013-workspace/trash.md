# Trash

The Trash is the index's. Deleting a document moves it to the Trash for 30 days, restorable to its folder, and the index's daily sweep purges it after that, telling livedocuments to delete the document's content. A trashed item is reached only by its owner and team, so a share link to it grants nothing. The shared Explorer's Trash view offers Restore, Delete Forever and Empty Trash.

## Deleting

Deleting the document open in the editor (`trashOpenDocument`, `apps/editor/lib/document-delete-undo.ts`) marks it deleted first (`../packages/workbench/src/lib/document-tombstones.ts`), so neither the autosave nor the unload flush writes it back, asks the index to delete it, and leaves for the Explorer at `/explorer?trashed=<id>&title=<name>`, which offers **“Name” deleted** with **Undo** on arrival and drops both from the address once read. The workbench frame's Explorer takes the same document from sessionStorage, kept for one page load.

An editor left open on a document that was trashed has its saves refused (410 `document_trashed`) and shows the deleted state. API clients list, restore and delete trashed documents at `/api/trash` ([API](../015-api/api.md)), which reads and writes the index.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).

### Open editors

A trash made anywhere (the editor, the Explorer, the REST API, MCP) is the index's: it tells the app where the item
now stands (`POST /api/internal/items/:id/standing`, one-explorer-contracts.md "Where an item stands") off the trash's
own path. On `trashed: true` the api posts `{op: {kind: 'document-trashed'}}` to the document's room (`tellTrashed`,
`@liveworkspace/api-kit/room-access-client`), which sends it from `system` to every session and closes each socket,
as for any `document-trashed` op. Open editors and MCP views show the trashed state at once. The notice is fire-and-forget (a
room that cannot be reached is logged, and its sessions end at their next grant renewal), and the room keeps nothing
of it, so a restore reopens as before.
