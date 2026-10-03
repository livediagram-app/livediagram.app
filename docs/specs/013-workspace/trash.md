# Trash

Status: shipped

## What

Deleting a document moves it to the **Trash** for **30 days**; after that it is
purged for good. The Trash is a quiet backstop, not a feature to manage:
deletion still feels permanent, the delete confirmations stay, and nothing nags
about where the document went. Someone who deleted the wrong thing can go and
fetch it back.

### Deleting

Every document delete asks one short question, the same everywhere (the
Explorer, the editor, the Explorer panel's popover, the team library;
`apps/live/lib/delete-confirmation.ts`):

- Title **Confirm**; first line **Delete "<name>"?**
- A second line only for what applies, in this order: "It is deleted for the
  whole team." (a team document), "Its share links stop working." (only when
  the document has share links; for the document open in the editor this is
  asked of the server, and left out when it cannot say), and the shared-tabs
  sentence ([Tab ↔ document many-to-many](../006-document/tab-document-many-to-many.md)).
- The **Delete** button is not red: nothing is lost for 30 days.
- The Trash is not mentioned: it is a backstop, found in Settings. There is no
  undo toast and no "moved to Trash" message.

Every delete of a whole document goes to the Trash: the Explorer, the editor,
the team library, the public API with a token, and the MCP server. The rule is
the same for guests and signed-in users. Tabs are not trashed; deleting a tab
is unchanged.

Three things bypass it:

- **Take Offline** ([Offline Mode](../006-document/offline-mode.md)) is a move,
  not a delete: the document leaves the server because it now lives in this
  browser, so there is nothing to restore.
- **Account deletion** is a full, immediate hard delete of everything the
  account holds, its Trash included.
- **Delete permanently**, from the Trash, or through the documented
  `?permanent=true` on the REST API's delete. The MCP server has no permanent
  delete: an AI tool can bin a document, never destroy one.

## Where things live

| Document                               | Its Trash                         | Who may see, restore and purge           |
| -------------------------------------- | --------------------------------- | ---------------------------------------- |
| Personal (guest or account)            | The owner's personal Trash        | The owner                                |
| Team library                           | The team's Trash                  | Any joined member (the delete authority) |
| Offline Mode (IndexedDB, this browser) | A local Trash in the same browser | Whoever uses this browser                |

The authority to restore or purge is exactly the authority to delete today:
the owner, or a joined member of the document's team
([Team shared documents](team-shared-documents.md)). A share-link visitor can
never delete, so never sees a Trash entry for it.

## The Trash view

One view lists everything the person can restore, grouped:

- **Your documents**: the personal Trash.
- **One group per team** the person has joined, named after the team.
- **This browser only**: the local Trash of offline documents, labelled as such.

Each row shows the document's name, when it was deleted, and how many days are
left before it is purged. Each row offers **Restore** and **Delete
permanently**; each group offers **Empty Trash**. Delete permanently and Empty
Trash are always confirmed. Restore is not: it destroys nothing.

"Days left" counts whole days until the purge is due, rounded up, so a document
deleted a moment ago shows 30 and one due within the day shows 1. A document
past its 30 days but not yet swept reads "Removed at the next clean-up".

The Trash is reached two ways, never from the account menu: the **Trash** row
last in the Explorer sidebar's **More** group, after **Library** (Image gallery,
Themes and Shape libraries, the other things that hold your stuff rather than
being it; [Explorer structure](explorer-structure.md)), and
**Settings › Account**'s **Trash** row, for everyone, guests and deployments
without accounts included, because Settings is the one menu every deployment
has. It was Settings-only at first, to stay out of the way of everyday work,
but a deleted document's first question is "where did it go", and the sidebar is
where people look. The row is selected while the Trash is open. The view itself
lives at `/explorer/trash`.

Empty Trash empties **one group**: your documents, one team's, or this
browser's. Emptying a team's Trash is said to be for the whole team in its
confirmation; nothing empties more than one group at once.

## Restore

Restoring returns the document exactly as it was: its tabs, its deck, its share
links, its stars, its history and its place. It goes back to the folder it was
in, or to that folder's parent when the folder has since been deleted (the delete moved it up,
[Folders: Deleting a folder](folders.md#deleting-a-folder)); a team document goes
back to its team library the same way. The document keeps its id, so every link
to it works again.

A team that was deleted while one of its documents was in its Trash returned the
document to its owner, the same way deleting a team returns every live team
document ([Team shared documents](team-shared-documents.md)): the trashed document
lands in the owner's personal Trash.

## While a document is in the Trash

A trashed document is gone from everywhere a live one shows up:

- every document list: the Explorer (all sections, Recent, Search results, folders),
  the team library, **Shared with you**, **Favourites**, search, the
  **Timeline**, and the **Activity** page;
- the tab picker that links a tab into another document.

Nothing about it is lost: its stars, share links, history, Timeline events and
images stay where they are and come back on restore. Images it references stay
referenced until the purge, so the unused-image retention never reaps them from
under a restorable document ([Images](../009-elements/images.md)).

Everything that would read or change it answers with a clear **deleted** state
rather than a generic error:

- **Share links** stop resolving. A visitor sees that the document was deleted,
  not a "link not found". On restore the same links work again, subject to
  their own expiry ([Share-link expiry](share-link-expiry.md)).
- **The realtime room** refuses new joins, and ends every open session the
  moment the document is trashed, telling each one it was deleted. An editor that
  loaded just before the delete and joins just after is refused, not told, so
  it asks the api why: the same load answers `document_trashed`, and the editor
  shows the deleted card.
- **Edits and saves** are rejected with a named error, `document_trashed`, so an
  editor left open on another device stops and says why instead of failing
  silently.
- **Opening it by URL** shows the deleted state, a card saying the document was
  deleted. Someone with the authority to restore it (the document is in their
  own Trash) is offered **Restore** on that card, with the days it has left;
  a share-link visitor only learns that it was deleted, and that the link
  works again if it is restored. The same card replaces an editor that was
  open when the document was trashed.

Who learns that a document is trashed, rather than simply not found: anyone who
could have opened it (its owner, a joined team member, a share-link holder).
Anyone else gets the same not-found they would for an id that never existed,
so the state leaks nothing.

## Tabs shared with other documents

A tab can sit in several documents
([Tab ↔ document many-to-many](../006-document/tab-document-many-to-many.md)).
Trashing a document does not touch its tabs, so a tab it shares with another
document carries on there, editable as before. When the trashed document is
purged, its tabs go the way every document delete takes them: a tab no other
document holds goes, a tab still linked elsewhere stays exactly where it is.

## The purge

The api worker's daily `0 3 * * *` cron purges every document that has been in
the Trash for 30 days or more, through the same removal that deletes a document
today (`documentRemovalStatements`), plus its snapshot and its Timeline events.
The purge is set-based and capped per run, so a backlog drains over a few days
rather than overrunning one invocation. It logs how many it purged.

A purge is therefore due 30 days after deletion and happens at the next 03:00
UTC after that; a document can sit in the Trash for up to a day beyond its 30.

Delete permanently and Empty Trash run the same purge, immediately, for the
documents they name.

## The local Trash (Offline Mode)

An offline document lives only in this browser, so its Trash does too. Deleting
one marks its IndexedDB record as trashed with the time; the record keeps
everything it had. The local Trash follows the same 30-day rule, applied
whenever the app runs rather than by a server cron: listing documents, or
opening the Trash, purges any local record past its 30 days first. A browser that is not opened for months
keeps its trashed records until it is.

## The API

`DELETE /api/documents/:id` moves the document to the Trash and answers `204`.
`DELETE /api/documents/:id?permanent=true` deletes it for good. Both keep the
delete authority they have today.

The Trash has its own resource:

- `GET /api/trash`: what the caller may restore, personal and every joined
  team's, each row naming its team.
- `POST /api/trash/:id/restore`: restore one.
- `DELETE /api/trash/:id`: purge one.
- `DELETE /api/trash`: empty the personal Trash; `?team=<id>` empties that
  team's.

An API token reaches the Trash like it reaches everything else
([Public API and API tokens](../015-api/public-api-and-tokens.md)); a
read-only token may list but not restore or purge.

The MCP server ([MCP server](../015-api/mcp-server.md)) goes to the Trash only:
`delete_document` moves a document there and has no permanent option, so an AI
tool can bin a document but never destroy one. `list_trash` and
`restore_document` are the way back, with the REST Trash's authority. The
permanent delete stays with the person and the REST API.

## Designed for a mirror

A later Google Drive mirror will map Drive's bin onto this Trash: binning a
document's file in Drive moves the document to the Trash, restoring it in Drive
restores it, and emptying Drive's bin purges it. The three operations are plain
calls with no HTTP concerns (`trashDocument`, `restoreDocument`,
`purgeDocuments`) in `apps/api/src/db/trash.ts`: trash takes an id and the time,
restore an id, purge a list of ids. Each keeps its own guard (only a live
document is trashed, only a trashed one restored or purged), so the mirror calls
them directly without re-checking state.

## Telemetry

One category, `Trash` ([Telemetry](../017-telemetry/telemetry.md)): `Opened`
(`Settings`), and `Restored` / `Deleted` (for good) / `Cleared` (Empty
Trash), each typed by the Trash it happened in: `Personal`, `Team` or
`Local`. The delete itself stays `Document·Deleted`. Whether anyone ever comes
back for a deleted document is the question these answer; no names are sent.

## Decided trade-offs

- **A column, not a table.** Trashing stamps `documents.trashed_at`. Moving rows
  to a separate table would have to move tabs, links, share links, stars and
  history with them, and move them back on restore; a timestamp leaves every
  foreign key standing, which is what makes restore exact.
- **Fail closed.** The document reads every door uses exclude trashed rows, so a
  path nobody remembered answers not-found rather than serving a deleted
  document. Only the doors that owe a person the deleted state look further.
- **No "deleted by".** The Trash does not record who binned a document. It would
  be one more owner id to erase on account deletion, and nothing in the view
  needs it.
- **Timeline history is hidden, not swept.** A hard delete sweeps a document's
  Timeline events; trashing hides them, so a restored document comes back with
  its history. The purge sweeps them.
- **A teammate's Take Offline goes to the team Trash.** Only the owner's Take
  Offline bypasses the Trash. When a teammate takes a team document into their
  own browser it leaves the owner and the team for good, which from their side
  is a deletion, the same reading the Timeline already gives it.
- **The image gallery still counts a trashed document as using its images.** It
  does reference them until the purge, and deleting such an image would break
  the document the moment it is restored.
- **Milestones count trashed documents.** The document-count milestone email
  counts what an owner created, so binning and restoring never re-earns one.
