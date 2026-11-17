# Snapshots

Status: built (Work Tracker 948)

## What

A **snapshot** is a save point for a whole item: a plan, a livediagram document, a livedocuments document, a design or
a Space. Anyone who can edit the whole item takes one by hand, names it if they like, and can later **revert** the
item to it. A revert puts the item back for everyone with it open.

Snapshots are manual save points, not an activity log: nothing is taken on a schedule, no edit is recorded one by one,
and nothing is kept beyond the latest five. They replace the hourly snapshots, the operation log and the Free and Pro
retention ideas (the owner's direction, 2026-11-15). They cost nothing extra and have no paid tier, like every other
feature.

livedocuments' Version History (its `006-document/version-history.md`) is a different thing kept beside them:
automatic versions of one tab, named or not, restored one tab at a time. A snapshot is the whole document, taken by a
person.

## What a snapshot holds

- The item as **its app's own export file**, the same text the Google Drive mirror writes
  ([drive.md](../005-drive/drive.md) "The file"): liveplanner's `.liveplanner` envelope from `exportProjectFile`, and
  livediagram's, livedocuments', livedesign's and livehuddle's envelopes from their `export*File`. Every tab with its
  folder, and whatever else that app's file carries (cards, card types and Sheets in a plan; the slide deck where an
  app has one; a design's component library).
- A **name**: what the person typed, trimmed, at most 80 characters, or none. The list shows a snapshot without a
  name by its time.
- **When** it was taken and **who** took it (their name and colour as the item shows them; their id is kept only to
  say "You").
- Its **kind**: `manual` (Take Snapshot) or `before-revert` (the automatic one a revert takes first).
- Its **size** in bytes.

## Only the latest five

An item keeps at most **five** snapshots, manual and automatic alike. Taking a sixth removes the oldest in the same
transaction. The dialog says so ("The latest 5 are kept") and, with five already kept, names the one the next snapshot
will remove.

## Where they live

In the item's own Durable Object SQLite, beside its content, never in R2 or D1. A snapshot is two tables:

- `snapshots`: one row per snapshot, the fields above.
- `snapshot_chunks`: its file text in order, cut into pieces small enough that no row nears the Durable Object's 2 MB
  row limit, however the text encodes.

A snapshot larger than **32 MiB** is refused before anything is written ("too large to snapshot"), so five of them
stay well under the object's storage. Deleting the item deletes its snapshots with it, as its object goes.

## Revert

Revert replaces the item's content in place with the snapshot's. Its steps, in order, all inside the item's object:

1. **Read the snapshot** being reverted to, whole. An unreadable one is refused and nothing changes.
2. **Take an automatic snapshot of the item as it is now** (`before-revert`, named `Before reverting to "<name>"`, or
   `Before reverting` for an unnamed one). This is the safety net and is **never skipped**: if it cannot be taken (the item is too large, the write
   fails), the revert is refused and nothing changes. With five kept it removes the oldest, which is never the one
   being reverted to: step 1 already holds that one.
3. **Replace the content.** The tabs become the snapshot's, in its order and folders, with their own ids, so share
   links to a tab, connected tabs and comment threads keep pointing at the same tab. Every written tab's revision
   moves forward. A tab made since the snapshot is removed as a tab delete removes it; a tab removed since comes back.
   The app's door replaces whatever else its file carries (see each app's spec).
4. **Advance the item's generation** (below) and **end every live session**: the room closes every socket with the
   `snapshot-reverted` close code (4009) and forgets its collaboration ledger, so nothing a client held before the
   revert is merged into a later save.
5. Every open editor that hears the close reloads the item and shows the reverted content, the person who reverted
   included.

A revert is undone by reverting to its `before-revert` snapshot.

## No stale writes after a revert

A revert must reach every open client cleanly, with nothing an editor held from before landing after it. Three things
make sure of it:

- **The generation fence.** Each item has a `generation`, 0 until its first revert and advanced by every revert. Every
  successful answer about the item carries it in `X-Snapshot-Generation`, 0 included, and the editor sends back the last
  one it saw on every request about that item. A write (any method but GET, HEAD and OPTIONS, other than the snapshot
  routes themselves) that names an older generation is refused with 409 `snapshot_reverted` before it reaches a
  handler, and the editor reloads on that answer. A request that names no generation (an agent's token, the CLI, an
  editor loaded before this shipped) is not fenced.
- **Revisions move forward.** A draft an editor kept of unsaved work is put back only while the stored tab is still at
  the draft's revision, and the revert moved every tab past it, so no draft is replayed over a reverted tab.
- **Sessions end.** Closing every socket stops live operations on the old content reaching the room; the editor
  reloads rather than reconnecting.

## Who may use them

Share roles as every app applies them (each app's `013-workspace/share-roles.md`):

| Who                                                                                                      | Snapshots                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| An **Editor** of the whole item: its owner, its team, an edit link to the whole item, a guest's own item | Sees the list, takes, reverts and deletes                      |
| An Editor through a link **confined to one tab**                                                         | Nothing: no button, and the routes answer as missing           |
| A **Participant** or a **Viewer**                                                                        | Nothing: no button, and the routes answer as missing           |
| An **API token** (agents, MCP, CLI)                                                                      | Refused (403 `snapshots_need_a_person`), an Editor's included  |
| A Community visitor, a workbench frame, an item in **This Browser**                                      | Nothing: no button (a This Browser item has no Durable Object) |

## In History

Snapshots live inside **History** in the footer's **Tools** menu ([The footer's Tools menu](../004-index/footer-tools-menu.md)),
which has one Versioning row, History (owner, 2026-11-17: merge Snapshots into History). There is no Snapshots row of
its own. History opens inside Tools, as every tool does, and what it shows depends on what the person may use:

| Who                                                                            | History shows                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Signed in, on a stored item they may take snapshots of (the owner, their team) | a **Take Snapshot** button at History's foot, and each snapshot on the timeline at the time it was taken      |
| Signed in, may read History but not take snapshots (a Participant or Viewer)   | The timeline alone, as before                                                                                 |
| May take snapshots but has no History to read (an Editor through a share link) | The snapshots on their own (the list below)                                                                   |
| A guest who may take snapshots (a share link's Editor, signed out)             | The snapshots on their own, with "Sign In to see who changed this <item>, and when." under them               |
| A guest or an item in **This Browser**, with no snapshots to take              | The Sign In or Sync <Item> prompt, as before (a This Browser item has no snapshots: it has no Durable Object) |

On the timeline:

- A **Take Snapshot** button (the camera) sits full width at the foot of History, always in reach (owner, 2026-11-17: the form is not always on show). It opens **Take a
  Snapshot** beside Tools (or beside the Snapshots dialog) as a popover, a drawer from the bottom on a phone
  (`SnapshotButton`, `ResponsivePopover` `placement="side"`): History's band art, a name field ("Name this snapshot
  (optional)") that takes the keyboard, and **Take Snapshot**, which closes the popover once taken. With five kept, a
  line under it says which snapshot the next one removes.
- Each snapshot is an entry on the rail among the item's events, newest first, under its day. It is pinned: a camera
  on the brand's wash in place of the event's disc, a small "Snapshot" label over it, then the same row as below
  (name or time, who took it, how long ago, its size, the `Before revert` badge), with **Revert** (asked first, in the shared confirm popover beside it) and **Delete** (at once, no
  question; owner, 2026-11-17). A day's heading counts its snapshots beside its events ("4 events · 1 snapshot").
- History has no filter (owner, 2026-11-17): every event and snapshot shows, newest first. Its summary is four
  tiles: Created, Last Changed and Events, each a glyph on a soft tinted disc with the value over its name, and
  People, the faces of those involved alone (up to five, then +N; names on hover). Two by two in Tools, four across
  in a wide dialog.
- An item with snapshots but no events yet shows the snapshots, not the empty state.
- A failed list leaves the timeline as it is (no snapshots on it); a refused action shows its message under Take
  Snapshot.

On their own (no timeline), the same parts in a list:

- The take row, as above.
- The snapshots, newest first. Each row: its name (or its time), then who took it, how long ago and its size; a
  `Before revert` badge on an automatic one (on a phone the badge takes its own line under the name). Two actions: **Revert** and **Delete** (a bin, named "Delete snapshot").
- **Delete** goes at once, its bin spinning while it runs (owner, 2026-11-17: no question). **Revert** asks first in
  the shared confirm popover beside its button: "Revert to this snapshot?" over "Everyone's work since then is
  replaced. A snapshot of the <item> as it is now is taken first, so you can undo this.", with **Cancel** and
  **Revert**; the button then reads "Reverting…".
- Empty: "No snapshots yet" and "Take one before a big change, so you can come back to it."
- The list failed to load: "Couldn't load snapshots", "Check your connection, then try again." and **Try Again**,
  never the empty state, which would say there are none.
- While a request runs its button says so and the others wait; a refusal shows its message in the dialog.

Either way, Escape inside a row's confirm cancels the confirm; the next Escape goes back to the Tools list. The data,
routes and telemetry names are unchanged: History draws the same list from the same calls.

## API

Under each app's item route (`/api/projects/<id>`, `/api/documents/<id>`, `/api/designs/<id>`):

| Method and path                          | Does                                | Answers                                                 |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `GET    …/snapshots`                     | Lists them, newest first, no bodies | 200 `{ snapshots, kept }`                               |
| `POST   …/snapshots` `{ name? }`         | Takes one of the item now           | 201 `{ snapshot }`, 413 `snapshot_too_large`            |
| `DELETE …/snapshots/<snapshotId>`        | Deletes one                         | 204, 404                                                |
| `POST   …/snapshots/<snapshotId>/revert` | Reverts to one (steps above)        | 200 `{ reverted }`, 404, 413, 422 `snapshot_unreadable` |

Each refuses a token (403) and answers 404 to anyone else who may not use snapshots.

## Telemetry

Each editor counts three events under its own app, from the shared dialog and only once the api accepted the call:
`Snapshot·Created` (one taken by hand), `Snapshot·Reverted` and `Snapshot·Deleted`. No type: never a name, an id or a
size. A refused call counts nothing, and the safety snapshot a revert takes first is not counted as a take. Read
Reverted against Created to see whether people come back to what they keep.

## Built once

Everything the apps share lives in `@liveworkspace/snapshots` (packages/snapshots): the store with its five-snapshot
cap, chunking and size check, the routes, the revert's order, the generation fence on both sides, and the editor's
parts (Take Snapshot, the row, the list on its own, the pins History lays on its timeline) and their state. Each app adds a thin door: how it exports its file, how it replaces its content from
one, its gate, and handing `useHistorySnapshotsHost()` to the History host it already mounts. The tab replacement every app shares is `replaceTabs` in
`@liveworkspace/index-app` (item-tab-writes.ts), beside the other tab writes.

## Not in scope

- Automatic or scheduled snapshots, an operation log, per-edit history, retention tiers.
- Restoring a snapshot as a copy (Make a Copy already copies the item as it is).
- Snapshots of an item in This Browser.
- Agent access: no MCP tool or CLI verb takes or reverts a snapshot.
