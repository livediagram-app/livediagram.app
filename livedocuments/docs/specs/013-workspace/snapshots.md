# Snapshots

Status: built (Work Tracker 948)

Manual save points of the whole document, built once for every app. The platform spec,
[Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md), is the source of truth for what a
snapshot is, the five kept, Revert and its automatic snapshot, the generation fence, the roles, the dialog and the
API. This spec says only what is livedocuments's own. (Not the previews in `006-*`, which are drawings of a document.)

## What a snapshot holds here

The document as its own export file, the `livedocuments.document` envelope (`exportDocumentFile`, document-room/document-file.ts): every tab with its folder, and what else that file carries.

## What a revert puts back

- **Every tab**, with its id, order and folder, written as a save writes it (its revision moves forward); a tab made
  since is deleted, and one removed since comes back.
- **The slide deck** becomes the snapshot's.
- **Version History is kept, beside it** ([version-history.md](../006-document/version-history.md)): a revert
  writes each tab as a save does, so the idle trigger may keep a tab's previous content as an automatic
  version, and named versions stay. Version History restores one tab; a snapshot reverts the whole document.
  Folding Name This Version into snapshots is a follow-up of Work Tracker 948.
- The document's name stays.

## Roles

As the platform spec's table, through this app's edit gate on the whole document ([Share roles](share-roles.md)): an
Editor of the whole document takes, reverts and deletes; a tab-scoped link, a Participant and a Viewer see nothing (404);
an API token is refused (403).

## In the editor

The **Snapshots** row sits in the footer's **Tools** menu ([The footer's Tools menu](../../../../liveworkspace/docs/specs/004-index/footer-tools-menu.md)), before History, there for that Editor once the document is
stored on the server (never in This Browser, a workbench frame or a Community visit). Its dialog is the shared one,
naming the item "document".

## Where it is built

`/api/documents/<id>/snapshots`, answered inside the document's Durable Object by `@liveworkspace/snapshots` through this app's door
(`livedocuments/apps/api/src/document-room/document-snapshots.ts`): its export, its content replace, its gate and the room's close.
