# Restoring rooms

Every product keeps its items in Durable Objects with SQLite storage: one room per canvas, plan, document, design,
Space or Knowledgebase, and (in livediagram and livehuddle) one store per person. D1 has its own export and Time Travel
and R2 can be copied, but the rooms had no operator-level way back after a bad deploy: the only export was each
person's Download Your Data. This spec is that way back, for upstream's own production and for anyone who hosts the
products themselves. The runbook is [docs/restore-rooms.md](../../../../docs/restore-rooms.md) at the repository root.

## Point-in-time recovery

Cloudflare keeps 30 days of point-in-time recovery (PITR) for every SQLite-backed Durable Object, with nothing to turn
on: the object can find the bookmark for any moment in those 30 days (`getBookmarkForTime`), and on its next start it
comes back as it was at that bookmark (`onNextSessionRestoreBookmark`, then a restart). Every write after the bookmark
is gone. Restoring answers a bookmark of the moment just before it, so a restore can itself be undone, with the same
door, inside the same 30 days.

A Durable Object with key-value storage has no PITR. No class here has one: every class in every `wrangler.toml` is
created by a `new_sqlite_classes` migration.

| Worker                 | Class (binding)                                                  | In the restore door                                                                        |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| livediagram-api        | `DocumentRoom` (`DOCUMENT_ROOM`), `PersonStore` (`PERSON_STORE`) | yes                                                                                        |
| livehuddle-api         | `DocumentRoom` (`DOCUMENT_ROOM`), `PersonStore` (`PERSON_STORE`) | yes                                                                                        |
| liveplanner-api        | `PlanRoom` (`PLAN_ROOM`)                                         | yes                                                                                        |
| livedocuments-api      | `DocumentRoom` (`DOCUMENT_ROOM`)                                 | yes                                                                                        |
| livedesign-api         | `DesignRoom` (`DESIGN_ROOM`)                                     | yes                                                                                        |
| liveknowledge-api      | `DocumentRoom` (`DOCUMENT_ROOM`)                                 | yes                                                                                        |
| liveworkspace-accounts | `WorkbenchStore` (`WORKBENCH`)                                   | no: pairings, tickets and sessions, which a restore would bring back after they were ended |
| liveworkspace-drive    | `DriveMirror` (`DRIVE_MIRROR`)                                   | no: a mirror's sync state, rebuilt from the rooms and Drive                                |
| liveworkspace-export   | `DataExport` (`DATA_EXPORT`)                                     | no: export jobs, each gone within a day                                                    |
| liveworkspace-index    | `WebhookDispatcher` (`WEBHOOKS`)                                 | no: a delivery queue, which a restore would send again                                     |

The platform's four are SQLite-backed too, so PITR covers them; they are left out of the door because restoring them
would undo something on purpose (an ended session, a sent delivery) and they hold no one's content.

## The restore door

Each product's api Worker answers `POST /api/internal/restore`, with the operator's key as
`Authorization: Bearer <OPERATOR_KEY>`. It is the one door that restores a room, it is no person's: no account, guest,
API token, workbench session, share link or other service key opens it, whatever that caller may do to the item
itself. The key is a secret of its own on each api Worker (`wrangler secret put OPERATOR_KEY`), compared in constant
time. With no key set the door answers `404` to everyone, so a Worker that never set one has no door at all.

A restore names the room's class (one of the Worker's own, from the table above) and the room's name, which is the
name the Worker reaches it by: the item's id for a room, the person's id for a person store. It names where to go
back to, either a moment (`at`, milliseconds since 1970 or an ISO 8601 time, inside the last 30 days and not in the
future) or a bookmark an earlier restore answered (`bookmark`, to undo it).

- **One room at a time** is the default: `name` restores one room.
- **Several rooms** take `names`, up to 20 in one call, restored four at a time, each with its own answer. More than
  20 is refused, never cut short; the runbook pages a longer list through in calls of 20.
- **A dry run** (`dryRun: true`) finds the bookmark and changes nothing, so an operator can check the moment and the
  room names first.

A restore, room by room:

1. The room finds the bookmark for the moment (or takes the one given) and asks to start from it next time, which
   answers the bookmark of now, the undo.
2. The room closes every session with the snapshot revert's close code (4009,
   [Snapshots](../014-snapshots/snapshots.md) "Revert"), so each open editor reloads rather than saves what it held
   over the restored content, and restarts at once. It comes back as it was at the bookmark.
3. The door answers the room's name, the bookmark it went back to and the undo bookmark.

Restoring is destructive for everything after the moment: every write to that room since, by anyone, is gone. Nothing
else changes: the index's row for the item, its sharing, its Trash state and its previews stay as they are now, and
the rooms the item does not own (another item, a person's store) are untouched. An item restored to before it was
moved, renamed or shared still shows the index's current name and sharing. Media an item placed after the moment stays
in the media service until its own sweep; the room's image references go back with the room.

## Refusals and logs

| Answer | When                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | no `OPERATOR_KEY` is set on the Worker                                                                                                                                                                                 |
| `401`  | no Bearer, or one that is not the key                                                                                                                                                                                  |
| `400`  | the body is not JSON, the class is not one of the Worker's, no name or more than 20, a name is not text of 1 to 256 characters, neither or both of `at` and `bookmark`, `at` outside the last 30 days or in the future |
| `501`  | the runtime keeps no PITR (`wrangler dev` and local workerd do not), per room as `pitr_unavailable`                                                                                                                    |
| `502`  | a room failed some other way, per room as `restore_failed` with the runtime's message                                                                                                                                  |

Every restore and every dry run is logged once per room, as `[room-restore]` with the app, the class, the name, the
moment or bookmark, the undo bookmark and the outcome, so Workers Logs keep who went back where. A refused key is
logged as `[room-restore] refused`, without the key.

## Performance

The door is apart from the live path: it is matched before identity, it reads no D1, and no room changes how it
works until a restore reaches it. A restore costs a room two calls and a restart; a call of 20 rooms is five rounds of
four, so one call never holds more than four rooms at once.
