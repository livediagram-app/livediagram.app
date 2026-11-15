# Snapshots blueprint

Derived from [snapshots.md](../snapshots.md). Codes SN1 to SN30 are cited from the code.

## Domain and naming

| Term                  | Identifier                                     | Meaning                                                        |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| snapshot              | `SnapshotSummary` (wire), `snapshots` (table)  | one save point of a whole item                                 |
| kind                  | `SnapshotKind` = `'manual' \| 'before-revert'` | taken by hand, or by a revert first                            |
| body                  | `snapshot_chunks.data`                         | the item's export file text, in pieces                         |
| generation            | `snapshot_state.generation`                    | how many reverts the item has had                              |
| the fence             | `fenceStaleWrite`                              | the server's refusal of a write from before the last revert    |
| the door              | `SnapshotDoor`                                 | what an app hands the shared routes: export and replace        |
| the room's part       | `SNAPSHOT_REVERTED` on the room env            | what the room does after a revert: close sockets, clear ledger |

## Package layout (packages/snapshots, `@liveworkspace/snapshots`)

- `src/limits.ts` (SN1): `SNAPSHOTS_KEPT = 5`, `SNAPSHOT_MAX_BYTES = 32 * 1024 * 1024`, `SNAPSHOT_CHUNK_CHARS =
  600_000` (one UTF-16 unit is at most 3 UTF-8 bytes, so a chunk is at most 1.8 MB, under the 2 MB row limit),
  `SNAPSHOT_NAME_MAX = 80`.
- `src/wire.ts` (SN2): `SnapshotSummary { id, name, kind, author: { id, name, color } | null, createdAt, bytes }`,
  the list, take, revert answers, error codes, `SNAPSHOT_GENERATION_HEADER = 'X-Snapshot-Generation'`, and
  `SNAPSHOT_REVERTED_CLOSE` re-exported from `@liveworkspace/api-schema/room-wire` (4009).
- `src/store.ts` (SN3 to SN9): the tables and their reads and writes, over the item's `D1Database` surface
  (`env.<ITEM>_DB`, the object's SQLite).
- `src/routes.ts` (SN10 to SN15): `answerSnapshotRoute(request, rest, caller, door)`.
- `src/fence.ts` (SN16 to SN18): `fenceStaleWrite`, `stampGeneration`.
- `src/client.ts` (SN19 to SN21): the editor's calls and the fence's browser half.
- `src/ui/` (SN22 to SN27): `SnapshotsDoorProvider`, `useSnapshotsDoor`, `SnapshotsButton`, `SnapshotsDialog`,
  `useSnapshots`, `snapshot-words.ts`.

## Data and persistence

SN3. Created on first use with `CREATE TABLE IF NOT EXISTS`, once per `D1Database` instance (a `WeakSet`):

```sql
CREATE TABLE IF NOT EXISTS snapshots (
  id           TEXT    PRIMARY KEY,           -- 's_' + 16 hex
  item_id      TEXT    NOT NULL,
  name         TEXT    NULL,
  kind         TEXT    NOT NULL CHECK (kind IN ('manual', 'before-revert')),
  author_id    TEXT    NULL,
  author_name  TEXT    NULL,
  author_color TEXT    NULL,
  bytes        INTEGER NOT NULL,
  chunks       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_by_item ON snapshots (item_id, created_at);
CREATE TABLE IF NOT EXISTS snapshot_chunks (
  snapshot_id TEXT    NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  data        TEXT    NOT NULL,
  PRIMARY KEY (snapshot_id, seq)
);
CREATE TABLE IF NOT EXISTS snapshot_state (
  item_id    TEXT    PRIMARY KEY,
  generation INTEGER NOT NULL
);
```

`item_id` is kept although an object holds one item: the apps' tests hold every item in one database, and a row can
never be read for the wrong item.

SN4. Take: measure the text (UTF-8 bytes); over `SNAPSHOT_MAX_BYTES` refuses `too_large` and writes nothing. Else one
`batch` (a transaction): the `snapshots` row, its chunks, then the prune (SN5). Chunks cut the string every
`SNAPSHOT_CHUNK_CHARS` UTF-16 units, never between a surrogate pair.

SN5. Prune: `DELETE FROM snapshots WHERE item_id = ? AND id NOT IN (SELECT id FROM snapshots WHERE item_id = ? ORDER BY
created_at DESC, rowid DESC LIMIT 5)`; the chunks go by the foreign key, and by an explicit delete of orphan chunks in
the same batch for a database without foreign keys on.

SN6. Read: the chunks in `seq` order joined; a count that differs from `chunks`, or a missing row, is `null`
(unreadable).

SN7. List: summaries only, `ORDER BY created_at DESC, rowid DESC`, never a body.

SN8. Delete: the row and its chunks; `false` for no such snapshot.

SN9. Generation: `readGeneration(db, itemId)` reads `snapshot_state` once per `D1Database` and item and keeps it in a
`WeakMap`; an object holds one item and every write to it goes through this module, so the kept value is the stored
one. No table yet reads 0 without creating one. `advanceGeneration` writes `generation + 1` and updates the kept value.

## Behaviour and state

SN10. Routes, after the app's item route (`rest` is the path after `/api/<items>/<id>/`):

| `rest`                  | Method | Does                     |
| ----------------------- | ------ | ------------------------ |
| `snapshots`             | GET    | list (SN7)               |
| `snapshots`             | POST   | take (SN4), kind manual  |
| `snapshots/<id>`        | DELETE | delete (SN8)             |
| `snapshots/<id>/revert` | POST   | revert (SN12)            |

Anything else under `snapshots` is 405 or 404 as the shape says.

SN11. The caller: `{ itemId, person: { id, name, color } | null, token: boolean, mayUse: boolean }`. A token is 403
`snapshots_need_a_person`, checked first, before any read. `mayUse` false is 404 `not_found`.

SN12. Revert, in order: read the target (SN6; `null` is 422 `snapshot_unreadable`, missing is 404); export the item
now (`door.exportFile()`); take it as `before-revert` named `Before reverting to <target name, or "the snapshot of
<time>">` capped at 80 (refused take is 413, nothing changes); `door.replaceContent(text)` (`invalid` is 422,
`too_large` 413; a throw propagates as 500 after the safety snapshot already stands); `advanceGeneration`;
`door.afterRevert(generation)`. Answers `{ reverted: { snapshotId, safetySnapshotId, generation } }`.

SN13. The safety snapshot is taken before the content changes and the replace runs only after it is written; no flag
or path skips it.

SN14. Names: `name` a string is trimmed and cut to `SNAPSHOT_NAME_MAX` (by code points); empty is `null`; any other
type is `null`.

SN15. A body that is not JSON, or JSON without an object, takes no name; the take still runs.

## The fence

SN16. `fenceStaleWrite(request, generation)`: when `generation > 0`, the method is not GET, HEAD or OPTIONS, the
request carries `X-Snapshot-Generation`, and its value is a whole number below `generation`, answers 409
`{ error: 'snapshot_reverted', message }`. Otherwise `null`. The snapshot routes are exempt (the app calls them first).

SN17. `stampGeneration(response, generation)`: a copy of the response with `X-Snapshot-Generation` set, when
`generation > 0`; the same response otherwise. A WebSocket upgrade (status 101) is never copied.

SN18. Each app's in-room router (`answer*Request`) runs: snapshot routes, then the fence, then its handlers, and stamps
every answer.

SN19. The editor's half (`createSnapshotFence(collection)`): `stamp(input, init)` adds the header to a request whose
path is `/api/<collection>/<id>…` when a generation above 0 is known for that id; `note(response)` keeps the highest
generation each response's URL names. Each app binds it in `lib/api/core.ts` through `createApiCore`'s
`stampRequest` and `noteResponse` hooks, so every request, the unload flush included, carries it.

SN20. A 409 `snapshot_reverted`, or the room's close code 4009, reloads the page (`reloadAfterRevert`), once.

SN21. `snapshotsApi({ apiFetch, apiHeaders, base })`: `list`, `take`, `remove`, `revert`, each throwing the shared
`ApiError` shape on refusal with the server's message.

## The room's part

SN28. Each app's room adds `SNAPSHOT_REVERTED: (generation) => void` to its room env. It clears the collaboration
ledger (`RoomLedgerStore.clear`), then closes every socket with 4009 `snapshot reverted`. The room client of every
editor (`@liveworkspace/workbench/lib/room-client` and the copies in livediagram, livehuddle and liveplanner) treats
4009 as final: it does not reconnect and calls `reloadAfterRevert`.

## Presentation and UX

SN22. `SnapshotsDoorProvider value={door | null}`; `SnapshotsButton` renders nothing without a door. The door:
`{ api, noun, open, setOpen }` built by the app's host from its gate.

SN23. The button: the footer's `CHROME_BTN` classes (and `CHROME_BTN_LABELLED` when labelled), a camera-shutter glyph
(14 px, `aria-hidden`), label "Snapshots", `aria-label="Snapshots"` and a hover card "Snapshots" / "Save points for
the whole <noun>. Revert to one to undo a big change."

SN24. The dialog: `Dialog size="md" phoneSheet`, `DialogHeader title="Snapshots" subtitle="Save points for the whole
<noun>. The latest 5 are kept."`, a close button. Body: the take row, then the list, as the spec says. Rows are
`li` in a `ul aria-label="Snapshots"`; the confirm replaces the row's actions, focuses its safe button (Cancel), and
Escape inside it cancels the confirm rather than closing the dialog.

SN25. States: loading (`LoadingSweep`), empty (`CompactEmptyState`), error (a `role="alert"` line), busy (the busy
button's label: "Taking…", "Reverting…", "Deleting…"; every other action disabled).

SN26. Words (`snapshot-words.ts`): the time label (`15 Nov, 14:32` in the viewer's locale), "You" for the viewer's own,
sizes in KB or MB with one decimal under 10.

SN27. After a revert the page reloads (SN20) and the dialog goes with it.

## Accessibility

Every control reaches by keyboard in reading order; buttons are 32 px tall on desktop and 40 px on touch; the badge
and meta text keep 4.5:1 in both themes (`text-slate-600` / `dark:text-slate-300`); the confirm is announced by
moving focus into it; no motion beyond the dialog's own.

## Errors and edge cases

| Case                                         | Handling                                                   |
| -------------------------------------------- | ---------------------------------------------------------- |
| Item too large to snapshot                   | 413 `snapshot_too_large`, nothing written (take or revert) |
| Snapshot chunks missing or short             | 422 `snapshot_unreadable`, nothing changes                 |
| File the door cannot read                    | 422 `snapshot_unreadable`; the safety snapshot stands       |
| Reverting to the oldest of five              | read first (SN12), then pruned by the safety snapshot      |
| Two reverts at once                          | each runs whole inside the object; the second wins, both safety snapshots kept within the cap |
| A save in flight during the revert           | fenced (SN16) once its editor saw the old generation        |
| An item never started                        | the routes answer 404 (the app's gate finds no item)       |

## Security and trust

A token is refused before any read (SN11). The gate is the app's edit gate on the whole item, with a tab-scoped grant
refused. The bodies never leave the object except as the item itself is read: the list carries no body. Author ids go
out only as the viewer's own ("You").

## Performance and limits

A take exports the item once (the same work as a Drive mirror push) and writes at most `32 MiB / 600,000` = 56 chunk
rows. A list reads summaries only. The fence costs one kept integer per request after the first; the first read per
object is one `sqlite_master` lookup. Five snapshots at the cap are 160 MiB, inside the object's storage. A revert
writes every tab once in one batch, then deletes the extra tabs one by one.

## Observability

`[snapshots] taken|reverted|deleted|refused` with `{ itemId, snapshotId, kind, bytes, reason }`; never a name or body.

## Testing

- `packages/snapshots`: store (chunking at the limit and a surrogate pair at a cut, the cap at six, unreadable bodies,
  the generation cache), routes (every row of SN10 and SN11, the revert's order with a door that fails at each step),
  fence (each SN16 branch), client fence (stamp and note), the UI (button gating, take, revert confirm, delete confirm,
  empty, error, busy).
- Each app's api: snapshot, edit, revert gives the snapshot back; a sixth drops the oldest; Editor, Participant,
  Viewer, tab-scoped link and token gates; a stale write after a revert is refused.
- `@liveworkspace/index-app`: `replaceTabs` writes, reorders, re-folders, re-creates and removes tabs, revisions move
  forward.

## Constants and configuration

SN1's four constants, with safe ranges: kept 1 to 20; max bytes 1 to 64 MiB; chunk chars 100,000 to 650,000; name
max 40 to 200.

## Defaults ledger

SND1 to SND3 in [DEFAULTS.md](DEFAULTS.md).
