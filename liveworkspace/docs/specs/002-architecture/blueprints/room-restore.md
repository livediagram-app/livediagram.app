# Restoring rooms: blueprint

Derived from [room-restore.md](../room-restore.md). The runbook is [docs/restore-rooms.md](../../../../../docs/restore-rooms.md).

## Domain and naming

- **Room**: one Durable Object instance of a restorable class, reached by its **name** (`idFromName(name)`): an item's
  id for a room, a person's id for a person store, or another name the api keeps (liveknowledge's per-account counts).
- **Class**: the Durable Object class name, as `wrangler.toml` binds it (`DocumentRoom`, `PersonStore`, `PlanRoom`,
  `DesignRoom`). The door takes the class name, never the binding.
- **Moment** (`at`): milliseconds since 1970. **Bookmark**: Cloudflare's PITR bookmark string. **Undo**: the bookmark of
  the moment just before a restore, which `onNextSessionRestoreBookmark` answers.
- **Restore door**: `POST /api/internal/restore` on each product's api Worker. **Operator key**: `OPERATOR_KEY`.

## Files

| File                                                | What it holds                                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-kit/src/room-restore.ts`              | The constants, `prepareRoomRestore` and `restartRoom` (the room's half), `isRoomRestart`, `handleRoomRestore` (the Worker's half) |
| `packages/api-kit/src/timing-safe.ts`               | `timingSafeEqual`, `bearerMatches` (moved from `@liveworkspace/index-app`, which re-exports them)                                 |
| `packages/api-kit/src/testing/restore-door.ts`      | Tests only: `describeRestoreDoor`, the suite every product api runs through its Worker                                            |
| `<product>/apps/api/src/routes/operator-restore.ts` | `handleOperatorRestore(request, env)`: the door with `OPERATOR_KEY`, the app's name and its classes                               |
| `<product>/apps/api/src/index.ts`                   | `/api/internal/restore` (exactly three segments) answered before every other internal door and identity                           |
| each restorable class                               | `restorePrepare(target, dryRun)` over `prepareRoomRestore(ctx.storage, …)`; `restoreNow()` over `restartRoom(ctx)`                |
| `livediagram/apps/api/test/workerd-restore/`        | The workerd test Worker (the real door, `DocumentRoom` and `PersonStore`) and its test                                            |

The restorable classes: livediagram and livehuddle `DocumentRoom`, `PersonStore`; liveplanner `PlanRoom`;
livedocuments and liveknowledge `DocumentRoom`; livedesign `DesignRoom`.

## Constants and configuration

| Constant                 | Value           | Why                                                                      |
| ------------------------ | --------------- | ------------------------------------------------------------------------ |
| `PITR_WINDOW_MS`         | 30 days         | Cloudflare's PITR window for SQLite-backed Durable Objects               |
| `RESTORE_BATCH_MAX`      | 20              | one call's rooms; bounds the call's time and its log lines               |
| `RESTORE_CONCURRENCY`    | 4               | rooms restored at once, under a Worker's six open connections (`pooled`) |
| `ROOM_NAME_MAX`          | 256             | far over any id a product mints                                          |
| `BOOKMARK_MAX`           | 128             | Cloudflare's bookmarks are under 80 characters                           |
| `RESTORE_BODY_MAX_BYTES` | 16 KB           | 20 names of 256 characters with room to spare                            |
| `ROOM_RESTORE_REASON`    | `room-restore`  | the reason `ctx.abort` restarts with; the caller's error carries it      |
| `ROOM_RESTORED_REASON`   | `room-restored` | the close reason beside `SNAPSHOT_REVERTED_CLOSE` (4009)                 |

`OPERATOR_KEY` is a secret on each product's api Worker and its `-staging` twin (`wrangler secret put OPERATOR_KEY`),
documented in each `.env.example` and secrets policy. It has no local value: local workerd keeps no PITR.

## Interfaces and contracts

Request: `POST`, `Authorization: Bearer <OPERATOR_KEY>`, a JSON object:

| Field      | Type                    | Rule                                                                                                                                              |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | string                  | an own key of the Worker's `rooms` (else `unknown_class`)                                                                                         |
| `name`     | string, 1 to 256        | exactly one of `name` and `names` (else `name_or_names`; bad: `invalid_name`)                                                                     |
| `names`    | string[], 1 to 20       | each 1 to 256 (`invalid_name`); not an array or empty: `invalid_names`; over 20: `too_many_rooms`; a repeat restored once (ARC3)                  |
| `at`       | number (ms) or ISO 8601 | exactly one of `at` and `bookmark` (`at_or_bookmark`); not a time: `invalid_at`; after now: `at_in_future`; before now less 30 days: `at_too_old` |
| `bookmark` | string, 1 to 128        | hex digits and dashes only, checked character by character (`invalid_bookmark`)                                                                   |
| `dryRun`   | boolean, optional       | not a boolean: `invalid_dry_run`                                                                                                                  |

Answer (`Cache-Control: no-store`, ARC4): `{ app, class, dryRun, rooms: [...] }`, one entry per room in the order
asked: `{ name, ok: true, bookmark, undo }` (`undo` null on a dry run) or
`{ name, ok: false, error: 'pitr_unavailable' | 'restore_failed', message }`. Status `200` when every room is ok, else
`501` when the first failure is `pitr_unavailable`, else `502`. Refusals answer `{ error }`: `404 not_found` (no key),
`401 unauthorized`, `405 method_not_allowed`, `400` with the codes above or `invalid_body` (no body, not JSON, not an
object), `413 too_large`.

Room RPC (`RestorableRoom`): `restorePrepare(target: { at } | { bookmark }, dryRun) → { bookmark, undo }` and
`restoreNow() → void`, which never returns normally on workerd: the call rejects with `ROOM_RESTORE_REASON`
(`durableObjectReset: true`), which `isRoomRestart` reads as success.

## Behaviour and state

1. No key: `404`, nothing read. A Bearer that is not the key (constant time, `timingSafeEqual`): `401`, logged.
   Not `POST`: `405`. The body is read through `readCappedBody` only after the key passes.
2. The rooms run through `pooled(…, RESTORE_CONCURRENCY)`. Per room: `restorePrepare`; a throw ends that room
   (`pitr_unavailable` when its message holds "point-in-time recovery", else `restore_failed`). On a dry run, done.
   Else `restoreNow`; a rejection that `isRoomRestart` accepts is the restart, any other is `restore_failed` with
   `restart: <error>` (the room is set to start from the bookmark at its next start all the same).
3. In the room, `prepareRoomRestore`: `getBookmarkForTime(at)` (or the bookmark given); on a dry run return it with
   `undo: null`; else `onNextSessionRestoreBookmark(bookmark)` answers the undo. `restartRoom`: every
   `ctx.getWebSockets()` closed with `SNAPSHOT_REVERTED_CLOSE`, `ROOM_RESTORED_REASON` (a throw from an already closed
   socket ignored), then `ctx.abort(ROOM_RESTORE_REASON)`. Sockets and abort run in one synchronous step, so no editor
   reconnects to the old instance; a write between the two calls is discarded with the rest.

## Data and persistence

The restore changes only the named room's own storage, to its state at the bookmark. Nothing else is written: no D1
row, no index call, no media call. The undo bookmark is kept only in the answer and the log line; it stays usable
for the rest of the 30 days.

## Errors and edge cases

- A name that never held anything restores an empty room (the object exists once reached); the runbook takes names
  from the index, and a dry run first.
- Local workerd: every restore is `501 pitr_unavailable`, the room untouched and not restarted.
- A restart that fails some other way: `502 restore_failed`, `message` `restart: …`; the next start of that room still
  restores, so the runbook says to repeat the call (it is idempotent for the same moment).
- Several failures in one call: each room has its own entry; the status follows the first failure.

## Security and trust

- The door is matched in `index.ts` before identity, before every other `internal` door and before the write limits:
  no session, API token, workbench session, share link, `INDEX_KEY`, `MEDIA_KEY` or other key reaches it, and it
  reads no identity.
- Unset or empty `OPERATOR_KEY`: `404` to everyone. The key is compared hashed and in constant time and never logged.
- The body is bounded at 16 KB and parsed only after the key; the bookmark check has no pattern to backtrack.

## Performance and limits

The door adds one string comparison of `segments` to every api request (before identity), nothing more. A restore
costs each room two RPCs and a restart; a call of 20 is five rounds of four. Measured: the shared suite's 20-room call
peaks at exactly four rooms in flight (`room-restore.test.ts`).

## Observability

One `console.warn('[room-restore]', fields)` per room per call: `app`, `class`, `name`, `at` or `bookmark`, `dryRun`,
then `bookmark` and `undo`, or `error` and `message`. A refused key: `[room-restore] refused` with `app` and whether a
Bearer was sent.

## Testing

| Spec rule                                                                                                                                                                                                       | Test                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no key, no door; only the key opens it                                                                                                                                                                          | `packages/api-kit/src/room-restore.test.ts` "who opens the door"; each product's `routes/operator-restore.test.ts` (`describeRestoreDoor`, through the Worker) |
| the body's rules and every refusal code                                                                                                                                                                         | `room-restore.test.ts` "what it takes"                                                                                                                         |
| one room, several (bounded, four at a time), dry run, undo, failures                                                                                                                                            | `room-restore.test.ts` "a restore"                                                                                                                             |
| the room's half: order, sockets closed with 4009, the restart told apart                                                                                                                                        | `room-restore.test.ts` "the room's half"                                                                                                                       |
| on workerd: `pitr_unavailable` leaves the room as it was; the restart is real for a room and a person's store; a write after the moment is gone and the undo brings it back (only where the runtime keeps PITR) | `livediagram/apps/api/test/workerd-restore/room-restore.workerd.test.ts`                                                                                       |

`room-restore.ts` and `timing-safe.ts` are held at 100% in `packages/api-kit/vitest.config.ts`. The PITR case cannot
run on local workerd; the PR's Owner checklist runs it on staging (the runbook's "Checking a Worker's restore").

## Defaults ledger

- ARC3: a repeated name in `names` is restored once.
- ARC4: every answer carries `Cache-Control: no-store`.
