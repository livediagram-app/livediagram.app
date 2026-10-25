# Trash

The Trash is liveworkspace's index's. Deleting a canvas sends it to the Trash for **30 days**, restorable to its
folder, and the index's daily sweep purges it after that, telling livediagram to drop the canvas's content. A
trashed canvas is reached only by its owner and team, so a share link to it grants nothing. The shared Explorer's
Trash view (`/explorer/trash`) offers Restore, Delete Forever and Empty Trash, grouped by your own Trash and each
team's.

The Trash is a quiet backstop, not a feature to manage: a delete asks nothing first, offers an Undo, and nothing
nags about where the canvas went.

## Deleting

A canvas delete asks nothing first, the same everywhere (the Explorer, the editor, the editor's Explorer panel, the
team library): it only sends the canvas to the Trash, so a question would guard nothing that is lost.

- From a list, the row leaves at once, and the shared Explorer's toast (**“Roadmap” deleted**, with **Undo**) puts
  it back. A delete that fails puts the row back and says so.
- Deleting the canvas open in the editor (`trashOpenDocument`, `apps/editor/lib/document-delete-undo.ts`) marks it
  deleted first (`lib/document-tombstones.ts`), so neither the autosave nor the unload flush writes it back, asks
  the index to delete it, and leaves for the Explorer at `/explorer?trashed=<id>&title=<name>`, which offers the same
  Undo on arrival and drops both from the address once read. The workbench frame's Explorer takes the same canvas from
  sessionStorage, kept for one page load.
- A team canvas goes to the team's Trash, and its Undo restores it there.

Every delete of a whole canvas goes to the Trash: the Explorer, the editor, the team library, the public API with a
token, the MCP server, and the Drive mirror. So does a canvas left empty, by the index's daily sweep
([Empty document clean-up](empty-document-cleanup.md)), with the reason `empty`. Tabs are not trashed; deleting a
tab is unchanged.

Two things bypass it:

- **Take Offline** ([Offline Mode](../006-document/offline-mode.md)) is a move, not a delete: the canvas leaves the
  account because it now lives in this browser, so there is nothing to restore.
- **Account deletion** removes everything the account owns at once.

## This Browser

A canvas kept only in this browser is never on the index, so it has no Trash. **This Browser** (in the editor's Explorer panel) deletes
one for good, after a confirmation: "Delete this canvas?", "“Roadmap” is kept only in this browser, so deleting it
removes it for good." ([Offline Mode](../006-document/offline-mode.md)).

## While a canvas is in the Trash

A trashed canvas is gone from every list (the Explorer's views, the team library, Shared With Me, Favourites,
search, the Timeline and the Inbox) and from the tab picker that links a tab into another canvas. Nothing about it
is lost: its stars, share links, history and images stay where they are and come back on restore. Images it
references stay referenced until the purge, so the unused-image retention never reaps them from under a restorable
canvas ([Images](../009-elements/images.md)).

The index grants a trashed canvas to its owner and team alone, and their grant says it is in the Trash (`trashed`).
Every door about it answers them `410 document_trashed` (the workbench's ticket mint and session redemption among
them), and anyone else, a share-link visitor included, as for a canvas that does not exist (404). Only its snapshot
still serves, for the Trash's own rows. Its room admits nobody: trashing closes its sockets (`document-trashed`), an
upgrade with a trashed grant is refused 410, and a session renewing with one is closed as the trashing closes it.

When the api answers a canvas as not found, the editor asks the index whether it is in the Trash
(`isTrashedInIndex`, `apps/editor/lib/document-trashed.ts`): the index's item outlives the trashing, so it can tell a
trashed canvas from one that does not exist. A trashed one shows the deleted card in place of the canvas: Restore for
someone the index lets restore it (its owner, or a member of the team that owns it), and only that it was deleted for
a share-link visitor. The same question settles a room that closes, and a Drive follow that finds nothing.

On restore the same share links work again, subject to their own expiry
([Share-link expiry](share-link-expiry.md)).

## Tabs shared with other canvases

A tab can sit in several canvases ([Tab ↔ document many-to-many](../006-document/tab-document-many-to-many.md)).
Trashing a canvas does not touch its tabs, so a tab it shares with another canvas carries on there. When the
trashed canvas is purged, a tab no other canvas holds goes with it, and a tab still linked elsewhere stays.

## The purge

The index's daily sweep purges every canvas that has been in the Trash for 30 days or more, and tells livediagram to
drop its content: the internal `DELETE /api/internal/items/:id` purges the canvas's Durable Object, where the
collaboration ledger keeps the text of its comments, ideas and answers ([API](../015-api/api.md) "Purging a room"),
and drops its snapshot. Delete Forever and Empty Trash run the same purge at once, for the canvases they name.

## The API

API clients list, restore and purge trashed canvases at `/api/trash` ([API](../015-api/api.md)), which reads and
writes the index: `GET /api/trash`, `POST /api/trash/:id/restore`, `DELETE /api/trash/:id`, and `DELETE /api/trash`
(`?team=<id>` for a team's) to empty livediagram's canvases from a Trash. The MCP server's `delete_document` bins a
canvas but never destroys one; `list_trash` and `restore_document` are the way back
([MCP server](../015-api/mcp-server.md)).

## The Drive mirror

The [Google Drive mirror](../022-drive-mirror/drive-mirror.md) maps Drive's bin onto this Trash: binning a canvas's
file in Drive sends the canvas to the Trash, restoring it in Drive restores it, and emptying Drive's bin purges it,
each through the index's own calls, which keep their guards (only a live canvas is trashed, only a trashed one
restored or purged).

## Telemetry

`Trash` · `Opened` · `Settings` from Settings' Trash row, and `Trash` · `Restored` from a trashed canvas's own card
([Telemetry](../017-telemetry/telemetry.md)). The delete itself is `Document` · `Deleted`. The Explorer's own Trash
events are liveworkspace's ([telemetry.md](../../../../liveworkspace/docs/telemetry.md)).

## Decided trade-offs

- **A mark, not a move.** Trashing marks the index's item; the canvas's content stays in its Durable Object,
  untouched, which is what makes restore exact.
- **Fail closed.** A trashed canvas's grant says so, and every door under `/api/documents/<id>` answers it 410
  before its handler runs (`handleDocumentRequest`), so a door nobody remembered never serves it.
- **No "deleted by".** The Trash does not record who binned a canvas.
- **The image gallery still counts a trashed canvas as using its images.** It references them until the purge, and
  deleting such an image would break the canvas the moment it is restored.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows
it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
