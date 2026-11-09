# Trash

The Trash is the index's. Deleting a document moves it to the Trash for 30 days, restorable to its folder, and the index's daily sweep purges it after that, telling livedocuments to delete the document's content. A trashed item is reached only by its owner and team, so a share link to it grants nothing. The shared Explorer's Trash view offers Restore, Delete Forever and Empty Trash.

## Deleting

Deleting the document open in the editor (`trashOpenDocument`, `apps/editor/lib/document-delete-undo.ts`) marks it deleted first (`lib/document-tombstones.ts`), so neither the autosave nor the unload flush writes it back, asks the index to delete it, and leaves for the Explorer at `/explorer?trashed=<id>&title=<name>`, which offers **“Name” deleted** with **Undo** on arrival and drops both from the address once read. The workbench frame's Explorer takes the same document from sessionStorage, kept for one page load.

An editor left open on a document that was trashed has its saves refused (410 `document_trashed`) and shows the deleted state. API clients list, restore and delete trashed documents at `/api/trash` ([API](../015-api/api.md)), which reads and writes the index.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
