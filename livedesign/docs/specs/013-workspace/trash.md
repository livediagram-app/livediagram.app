# Trash

Status: shipped, on liveworkspace's index and the shared Explorer
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)).

## What

Deleting a design moves it to the **Trash** for **30 days**; after that it is
purged for good. The Trash is a quiet backstop, not a feature to manage:
a delete asks nothing first, offers an Undo, and nothing nags
about where the design went. Someone who deleted the wrong thing can undo it
on the spot, or go and fetch it back.

### Deleting

A design delete asks nothing first, the same everywhere (the Explorer, the editor, the Explorer panel, the team
library): it only moves the design to the Trash, so a question would guard nothing that is lost.

- **“Roadmap” deleted** shows once the delete has landed, naming the design
  ([Toasts](../004-interface-design/toasts.md#naming-what-it-acted-on); "Design deleted" when it has no name), with
  **Undo** (`apps/live/lib/design-delete-undo.ts`, `offerDeleteUndo`). Undo restores it from the Trash exactly as
  Restore does (`Trash·Restored`, typed by the Trash it was in), closes the toast and says **“Roadmap” restored**; a
  restore that fails says "Could not restore “Roadmap”. It is in the Trash, in Settings." The toast stays up for the
  answer time (10 seconds, paused while hovered or focused) and then goes, leaving the Trash; the "Show
  notifications" preference silences it like any other.
- From a list (the Explorer, the editor's Explorer panel, `/new`), the row leaves at once, and Undo puts it back where it
  was. A delete that fails puts the row back and says "Could not delete “Roadmap”. Try again." (logged
  `[explorer] delete-failed, row restored`).
- Deleting the design open in the editor takes the editor to the Explorer, which offers the same toast on arrival:
  the delete, with the design's name, is handed over in `sessionStorage` for 30 seconds (`handOffDeleteUndo`, `takeDeleteUndo`,
  `useDeleteUndoHandoff`).
- A team design deleted from the team library goes to the team's Trash, and its Undo restores it there.

Every delete of a whole design goes to the Trash: the Explorer, the editor,
the team library, the public API with a token, and the MCP server. So does a
design left empty for 30 days, moved there by the daily
[empty design clean-up](empty-design-cleanup.md). The rule is
the same for guests and signed-in users. Tabs are not trashed; deleting a tab
is unchanged.

Three things bypass it:

- **Take Offline** ([Offline Mode](../006-design/offline-mode.md)) is a move,
  not a delete: the design leaves the server because it now lives in this
  browser, so there is nothing to restore.
- **Account deletion** is a full, immediate hard delete of everything the
  account holds, its Trash included.
- **Delete permanently**, from the Trash, or through the documented
  `?permanent=true` on the REST API's delete. The MCP server has no permanent
  delete: an AI tool can bin a design, never destroy one.

## Where things live

| Design                                 | Its Trash                         | Who may see, restore and purge           |
| -------------------------------------- | --------------------------------- | ---------------------------------------- |
| Personal (guest or account)            | The owner's personal Trash        | The owner                                |
| Team library                           | The team's Trash                  | Any joined member (the delete authority) |
| Offline Mode (IndexedDB, this browser) | A local Trash in the same browser | Whoever uses this browser                |

The authority to restore or purge is exactly the authority to delete today:
the owner, or a joined member of the design's team
([Team shared designs](team-shared-designs.md)). A share-link visitor can
never delete, so never sees a Trash entry for it.

## The Trash view

One view lists everything the person can restore, grouped:

- **Your designs**: the personal Trash.
- **One group per team** the person has joined, named after the team.
- **This Browser only**: the local Trash of offline designs, labelled as such.

Each row shows the design's name, when it was deleted, and how many days are
left before it is purged. A design the clean-up moved says so instead: "Moved
here {d MMM} because it was empty". Each row offers **Restore** and **Delete
permanently**; each group offers **Empty Trash**. Delete permanently and Empty
Trash are always confirmed. Restore is not: it destroys nothing.

"Days left" counts whole days until the purge is due, rounded up, so a design
deleted a moment ago shows 30 and one due within the day shows 1. A design
past its 30 days but not yet swept reads "Removed at the next clean-up".

The Trash is reached two ways, never from the account menu: the **Trash** row
last in the Explorer sidebar's **More** group, after **Library** (the Image gallery,
the other things that hold your stuff rather than
being it; [Explorer structure](explorer-structure.md)), and
**Settings › Account**'s **Trash** row, for everyone, guests and deployments
without accounts included, because Settings is the one menu every deployment
has. It was Settings-only at first, to stay out of the way of everyday work,
but a deleted design's first question is "where did it go", and the sidebar is
where people look. The row is selected while the Trash is open. The view itself
lives at `/explorer/trash`.

Empty Trash empties **one group**: your designs, one team's, or this
browser's. Emptying a team's Trash is said to be for the whole team in its
confirmation; nothing empties more than one group at once.

## Restore

Restoring returns the design exactly as it was: its tabs, its share
links, its stars, its history and its place. It goes back to the folder it was
in, or to that folder's parent when the folder has since been deleted (the delete moved it up,
[Folders: Deleting a folder](folders.md#deleting-a-folder)); a team design goes
back to its team library the same way. The design keeps its id, so every link
to it works again.

A team that was deleted while one of its designs was in its Trash returned the
design to its owner, the same way deleting a team returns every live team
design ([Team shared designs](team-shared-designs.md)): the trashed design
lands in the owner's personal Trash.

## While a design is in the Trash

A trashed design is gone from everywhere a live one shows up:

- every design list: the Explorer (all sections, Recent, Search results, folders),
  the team library, **Shared with you**, **Favourites**, search, the
  **Timeline**, and the **Inbox**;
- the tab picker that links a tab into another design.

Nothing about it is lost: its stars, share links, history, Timeline events and
images stay where they are and come back on restore. Images it references stay
referenced until the purge, so the media service's sweep of unused images never
reaps them from under a restorable design ([Images](../009-elements/images.md)).

Everything that would read or change it answers with a clear **deleted** state
rather than a generic error:

- **Share links** stop resolving. A visitor sees that the design was deleted,
  not a "link not found". On restore the same links work again, subject to
  their own expiry ([Share-link expiry](share-link-expiry.md)).
- **The realtime room** refuses new joins, and ends every open session the
  moment the design is trashed, telling each one it was deleted. An editor that
  loaded just before the delete and joins just after is refused, not told, so
  it asks the api why: the same load answers `design_trashed`, and the editor
  shows the deleted card.
- **Edits and saves** are rejected with a named error, `design_trashed`, so an
  editor left open on another device stops and says why instead of failing
  silently.
- **Opening it by URL** shows the deleted state, a card saying the design was
  deleted. Someone with the authority to restore it (the design is in their
  own Trash) is offered **Restore** on that card, with the days it has left;
  a share-link visitor only learns that it was deleted, and that the link
  works again if it is restored. The same card replaces an editor that was
  open when the design was trashed.

Who learns that a design is trashed, rather than simply not found: anyone who
could have opened it (its owner, a joined team member, a share-link holder).
Anyone else gets the same not-found they would for an id that never existed,
so the state leaks nothing.

## Tabs shared with other designs

A tab put into another design with **Add to Design** is in both
([Tab ↔ design many-to-many](../006-design/tab-design-many-to-many.md)): each
design keeps its own copy, and the copies stay in step. Trashing a design does
not touch its tabs, which stay in step while it waits in the Trash; purging it
removes its copies and tells the other designs it left, so theirs carry on.

## The purge

liveworkspace's index purges every design that has been in the Trash for 30
days or more, on its daily cron (04:23 UTC). It removes the design's index rows
(its filing, share links, stars, Timeline events, comment and action rows) and
asks the api to drop the content (`DELETE /api/internal/items/:id`, with
`INDEX_KEY`; `apps/api/src/routes/internal-items.ts`): the design's Durable
Object drops its storage, tabs, changesets and collaboration ledger included
([API](../015-api/api.md) "Purging a room"), and the api deletes its snapshot
from R2. The index keeps a tombstone until the api confirms, and retries a
missed one, so a purge that fails once still lands
([one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Purging").

A purge is therefore due 30 days after deletion and happens at the index's next
daily run after that; a design can sit in the Trash for up to a day beyond its 30.

Delete permanently and Empty Trash run the same purge, immediately, for the
designs they name.

## The local Trash (Offline Mode)

An offline design lives only in this browser, so its Trash does too. Deleting
one marks its IndexedDB record as trashed with the time; the record keeps
everything it had. The local Trash follows the same 30-day rule, applied
whenever the app runs rather than by a server cron: listing designs, or
opening the Trash, purges any local record past its 30 days first. A browser that is not opened for months
keeps its trashed records until it is.

## The API

`DELETE /api/designs/:id` moves the design to the Trash and answers `204`.
`DELETE /api/designs/:id?permanent=true` deletes it for good. Both keep the
delete authority they have today.

The Trash has its own resource:

- `GET /api/trash`: what the caller may restore, personal and every joined
  team's, each row naming its team and its `reason` (`deleted` or `empty`).
- `POST /api/trash/:id/restore`: restore one.
- `DELETE /api/trash/:id`: purge one.

Each is the index's operation, passed on with the caller's grant. Empty Trash is
the shared Explorer's, straight to the index (`DELETE /trash`, `?team=<id>` for
a team's); the api has no route for it.

An API token reaches the Trash like it reaches everything else
([Public API and API tokens](../015-api/public-api-and-tokens.md)); a
read-only token may list but not restore or purge.

The MCP server ([MCP server](../015-api/mcp-server.md)) goes to the Trash only:
`delete_design` moves a design there and has no permanent option, so an AI
tool can bin a design but never destroy one. `list_trash` and
`restore_design` are the way back, with the REST Trash's authority. The
permanent delete stays with the person and the REST API.

## One operation each

Trashing, restoring and purging are the index's operations, each with its own guard (only a live design is
trashed, only a trashed one restored or purged), so a caller uses them directly without re-checking state
([one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items"). The api reaches
them for API clients in `apps/api/src/routes/trash.ts`, and a purge tells the design's Durable Object to drop its
content.

## Telemetry

One category, `Trash` ([Telemetry](../017-telemetry/telemetry.md)): `Opened`
(`Settings`), and `Restored` / `Deleted` (for good) / `Cleared` (Empty
Trash), each typed by the Trash it happened in: `Personal`, `Team` or
`Local`. The delete itself stays `Document·Deleted`. Whether anyone ever comes
back for a deleted design is the question these answer; no names are sent.

## Decided trade-offs

- **A stamp, not a move.** Trashing stamps the design's index item
  (`trashedAt`, `trashReason`). Nothing moves: its content stays in its Durable
  Object and its share links, stars and history stay in the index, which is
  what makes restore exact.
- **Fail closed.** The index grants nothing on a trashed item but its Trash
  operations, so a door nobody remembered answers not-found rather than serving
  a deleted design. Only the doors that owe a person the deleted state look
  further.
- **No "deleted by".** The Trash does not record who binned a design. It would
  be one more owner id to erase on account deletion, and nothing in the view
  needs it. It records only why, the item's `trashReason`: `deleted` for a delete,
  `empty` for the [clean-up](empty-design-cleanup.md).
- **Timeline history is hidden, not swept.** A hard delete sweeps a design's
  Timeline events; trashing hides them, so a restored design comes back with
  its history. The purge sweeps them.
- **A teammate's Take Offline goes to the team Trash.** Only the owner's Take
  Offline bypasses the Trash. When a teammate takes a team design into their
  own browser it leaves the owner and the team for good, which from their side
  is a deletion, the same reading the Timeline already gives it.
- **The image gallery still counts a trashed design as using its images.** It
  does reference them until the purge, and deleting such an image would break
  the design the moment it is restored.
- **Milestones count trashed designs.** The design-count milestone email
  counts what an owner created, so binning and restoring never re-earns one.
