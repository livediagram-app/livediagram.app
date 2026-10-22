# Trash

Status: shipped

## What

Deleting a project moves it to the **Trash** for **30 days**; after that it is
purged for good. The Trash is a quiet backstop, not a feature to manage:
a delete asks nothing first, offers an Undo, and nothing nags
about where the project went. Someone who deleted the wrong thing can undo it
on the spot, or go and fetch it back.

### Deleting

A project delete asks nothing first, the same everywhere (the Explorer, the editor, the Explorer panel, the team
library): it only moves the project to the Trash, so a question would guard nothing that is lost.

- **“Roadmap” deleted** shows once the delete has landed, naming the project
  ([Toasts](../004-interface-design/toasts.md#naming-what-it-acted-on); "Project deleted" when it has no name), with
  **Undo** (`apps/editor/lib/project-delete-undo.ts`, `offerDeleteUndo`). Undo restores it from the Trash exactly as
  Restore does (`Trash·Restored`, typed by the Trash it was in), closes the toast and says **“Roadmap” restored**; a
  restore that fails says "Could not restore “Roadmap”. It is in the Trash, in Settings." The toast stays up for the
  answer time (10 seconds, paused while hovered or focused) and then goes, leaving the Trash; the "Show
  notifications" preference silences it like any other.
- From a list (the Explorer, the editor's Explorer panel, `/new`), the row leaves at once, and Undo puts it back where it
  was. A delete that fails puts the row back and says "Could not delete “Roadmap”. Try again." (logged
  `[explorer] delete-failed, row restored`).
- Deleting the project open in the editor takes the editor to the Explorer, which offers the same toast on arrival:
  the delete, with the project's name, is handed over in `sessionStorage` for 30 seconds (`handOffDeleteUndo`, `takeDeleteUndo`,
  `useDeleteUndoHandoff`).
- A team project deleted from the team library goes to the team's Trash, and its Undo restores it there.

Every delete of a whole project goes to the Trash: the Explorer, the editor,
the team library, the public API with a token, and the MCP server. So does a
project left empty for 30 days, moved there by the daily
[empty project clean-up](empty-project-cleanup.md). The rule is
the same for guests and signed-in users. Tabs are not trashed; deleting a tab
is unchanged.

Three things bypass it:

- **Take Offline** ([Offline Mode](../006-project/offline-mode.md)) is a move,
  not a delete: the project leaves the server because it now lives in this
  browser, so there is nothing to restore.
- **Account deletion** is a full, immediate hard delete of everything the
  account holds, its Trash included.
- **Delete permanently**, from the Trash, or through the documented
  `?permanent=true` on the REST API's delete. The MCP server has no permanent
  delete: an AI tool can bin a project, never destroy one.

## Where things live

| Project                                | Its Trash                         | Who may see, restore and purge           |
| -------------------------------------- | --------------------------------- | ---------------------------------------- |
| Personal (guest or account)            | The owner's personal Trash        | The owner                                |
| Team library                           | The team's Trash                  | Any joined member (the delete authority) |
| Offline Mode (IndexedDB, this browser) | A local Trash in the same browser | Whoever uses this browser                |

The authority to restore or purge is exactly the authority to delete today:
the owner, or a joined member of the project's team
([Team shared projects](team-shared-projects.md)). A share-link visitor can
never delete, so never sees a Trash entry for it.

## The Trash view

One view lists everything the person can restore, grouped:

- **Your projects**: the personal Trash.
- **One group per team** the person has joined, named after the team.
- **This Browser only**: the local Trash of offline projects, labelled as such.

Each row shows the project's name, when it was deleted, and how many days are
left before it is purged. A project the clean-up moved says so instead: "Moved
here {d MMM} because it was empty". Each row offers **Restore** and **Delete
permanently**; each group offers **Empty Trash**. Delete permanently and Empty
Trash are always confirmed. Restore is not: it destroys nothing.

"Days left" counts whole days until the purge is due, rounded up, so a project
deleted a moment ago shows 30 and one due within the day shows 1. A project
past its 30 days but not yet swept reads "Removed at the next clean-up".

The Trash is reached two ways, never from the account menu: the **Trash** row
last in the Explorer sidebar's **More** group, after **Library** (Tags
and Themes, the other things that hold your stuff rather than
being it; [Explorer structure](explorer-structure.md)), and
**Settings › Account**'s **Trash** row, for everyone, guests and deployments
without accounts included, because Settings is the one menu every deployment
has. It was Settings-only at first, to stay out of the way of everyday work,
but a deleted project's first question is "where did it go", and the sidebar is
where people look. The row is selected while the Trash is open. The view itself
lives at `/explorer/trash`.

Empty Trash empties **one group**: your projects, one team's, or this
browser's. Emptying a team's Trash is said to be for the whole team in its
confirmation; nothing empties more than one group at once.

## Restore

Restoring returns the project exactly as it was: its tabs, its deck, its share
links, its stars, its history and its place. It goes back to the folder it was
in, or to that folder's parent when the folder has since been deleted (the delete moved it up,
[Folders: Deleting a folder](folders.md#deleting-a-folder)); a team project goes
back to its team library the same way. The project keeps its id, so every link
to it works again.

A team that was deleted while one of its projects was in its Trash returned the
project to its owner, the same way deleting a team returns every live team
project ([Team shared projects](team-shared-projects.md)): the trashed project
lands in the owner's personal Trash.

## While a project is in the Trash

A trashed project is gone from everywhere a live one shows up:

- every project list: the Explorer (all sections, Recent, Search results, folders),
  the team library, **Shared with you**, **Favourites**, search, the
  **Timeline**, and the **Inbox**;
- the tab picker that links a tab into another project.

Nothing about it is lost: its stars, share links, history and Timeline events
stay where they are and come back on restore.

Everything that would read or change it answers with a clear **deleted** state
rather than a generic error:

- **Share links** stop resolving. A visitor sees that the project was deleted,
  not a "link not found". On restore the same links work again, subject to
  their own expiry ([Share-link expiry](share-link-expiry.md)).
- **The realtime room** refuses new joins, and ends every open session the
  moment the project is trashed, telling each one it was deleted. An editor that
  loaded just before the delete and joins just after is refused, not told, so
  it asks the api why: the same load answers `project_trashed`, and the editor
  shows the deleted card.
- **Edits and saves** are rejected with a named error, `project_trashed`, so an
  editor left open on another device stops and says why instead of failing
  silently.
- **Opening it by URL** shows the deleted state, a card saying the project was
  deleted. Someone with the authority to restore it (the project is in their
  own Trash) is offered **Restore** on that card, with the days it has left;
  a share-link visitor only learns that it was deleted, and that the link
  works again if it is restored. The same card replaces an editor that was
  open when the project was trashed.

Who learns that a project is trashed, rather than simply not found: anyone who
could have opened it (its owner, a joined team member, a share-link holder).
Anyone else gets the same not-found they would for an id that never existed,
so the state leaks nothing.

## Tabs shared with other projects

A tab can sit in several projects
([Tab ↔ project many-to-many](../006-project/tab-project-many-to-many.md)).
Trashing a project does not touch its tabs, so a tab it shares with another
project carries on there, editable as before. When the trashed project is
purged, its tabs go the way every project delete takes them: a tab no other
project holds goes, a tab still linked elsewhere stays exactly where it is.

## The purge

The api worker's daily `0 3 * * *` cron purges every project that has been in
the Trash for 30 days or more, through the same removal that deletes a project
today (`projectRemovalStatements`), plus its snapshot, its Timeline events and
its realtime room's storage ([API](../015-api/api.md) "Purging a room"), where the
collaboration ledger kept the text of its comments, ideas and answers.
The purge is set-based and capped per run, so a backlog drains over a few days
rather than overrunning one invocation. It logs how many it purged.

A purge is therefore due 30 days after deletion and happens at the next 03:00
UTC after that; a project can sit in the Trash for up to a day beyond its 30.

Delete permanently and Empty Trash run the same purge, immediately, for the
projects they name.

## The local Trash (Offline Mode)

An offline project lives only in this browser, so its Trash does too. Deleting
one marks its IndexedDB record as trashed with the time; the record keeps
everything it had. The local Trash follows the same 30-day rule, applied
whenever the app runs rather than by a server cron: listing projects, or
opening the Trash, purges any local record past its 30 days first. A browser that is not opened for months
keeps its trashed records until it is.

## The API

`DELETE /api/projects/:id` moves the project to the Trash and answers `204`.
`DELETE /api/projects/:id?permanent=true` deletes it for good. Both keep the
delete authority they have today.

The Trash has its own resource:

- `GET /api/trash`: what the caller may restore, personal and every joined
  team's, each row naming its team and its `reason` (`deleted` or `empty`).
- `POST /api/trash/:id/restore`: restore one.
- `DELETE /api/trash/:id`: purge one.
- `DELETE /api/trash`: empty the personal Trash; `?team=<id>` empties that
  team's.

An API token reaches the Trash like it reaches everything else
([Public API and API tokens](../015-api/public-api-and-tokens.md)); a
read-only token may list but not restore or purge.

The MCP server ([MCP server](../015-api/mcp-server.md)) goes to the Trash only:
`delete_project` moves a project there and has no permanent option, so an AI
tool can bin a project but never destroy one. `list_trash` and
`restore_project` are the way back, with the REST Trash's authority. The
permanent delete stays with the person and the REST API.

## One operation each

The three operations are plain calls with no HTTP concerns (`trashProject`,
`restoreProject`, `purgeProjects`) in `apps/api/src/db/trash.ts`: trash takes
an id and the time, restore an id, purge a list of ids. Each keeps its own guard
(only a live project is trashed, only a trashed one restored or purged), so a
caller uses them directly without re-checking state.

## Telemetry

One category, `Trash` ([Telemetry](../017-telemetry/telemetry.md)): `Opened`
(`Settings`), and `Restored` / `Deleted` (for good) / `Cleared` (Empty
Trash), each typed by the Trash it happened in: `Personal`, `Team` or
`Local`. The delete itself stays `Project·Deleted`. Whether anyone ever comes
back for a deleted project is the question these answer; no names are sent.

## Decided trade-offs

- **A column, not a table.** Trashing stamps `projects.trashed_at`. Moving rows
  to a separate table would have to move tabs, links, share links, stars and
  history with them, and move them back on restore; a timestamp leaves every
  foreign key standing, which is what makes restore exact.
- **Fail closed.** The project reads every door uses exclude trashed rows, so a
  path nobody remembered answers not-found rather than serving a deleted
  project. Only the doors that owe a person the deleted state look further.
- **No "deleted by".** The Trash does not record who binned a project. It would
  be one more owner id to erase on account deletion, and nothing in the view
  needs it. It records only why, `projects.trash_reason`: unset for a delete,
  `empty` for the [clean-up](empty-project-cleanup.md).
- **Timeline history is hidden, not swept.** A hard delete sweeps a project's
  Timeline events; trashing hides them, so a restored project comes back with
  its history. The purge sweeps them.
- **A teammate's Take Offline goes to the team Trash.** Only the owner's Take
  Offline bypasses the Trash. When a teammate takes a team project into their
  own browser it leaves the owner and the team for good, which from their side
  is a deletion, the same reading the Timeline already gives it.
- **Milestones count trashed projects.** The project-count milestone email
  counts what an owner created, so binning and restoring never re-earns one.
