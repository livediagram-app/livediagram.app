# Guest merge and the migration's handoff: blueprint

Derived from [one-explorer-contracts.md "Guests"](../one-explorer-contracts.md#guests)
and ["The migration's handoff"](../one-explorer-contracts.md#the-migrations-handoff). The spec decides; this file
only adds engineering precision, read from the code. Defaults are cited as `IDXn`. Paths are relative to the
repository root.

Scope, by file:

| File                                                | Role                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/merge.ts`             | `POST /internal/merge`: the one batch that moves a guest's rows            |
| `liveworkspace/apps/index/src/person-merges.ts`     | `recordPersonMerges`, `drainPersonMerges`: telling each app                |
| `liveworkspace/apps/index/src/migration-handoff.ts` | `POST /app/migration/handoff`                                              |
| `packages/index-app/src/internal.ts`                | The apps' `POST /people/:guest/merge` and `PUT /items/:id/migration` doors |
| `packages/index-app/src/migration-door.ts`          | Writing a handed-off item's room                                           |

## Domain and naming

| Term         | Identifier                          | Meaning                                                                             |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Guest        | an id starting `guest_`             | A browser's identity before an account                                              |
| Merge        | `{ guestId, userId, legacy? }`      | Everything the guest had becomes the account's                                      |
| Legacy merge | `legacy: true`                      | The migration's returning guest of the old livediagram.app; `userId` may be a guest |
| Person merge | `person_app_merges (guest_id, app)` | One app still to hear of a merge                                                    |
| Handoff      | `POST /app/migration/handoff`       | livediagram's api handing one split part of an old document to another app          |

## Behaviour and state

### The merge (`POST /internal/merge`, `MERGE_KEY`)

Refused `400` unless `guestId` is an id starting `guest_`, `userId` an id, not a guest unless `legacy`, and the two
differ. Then one batch, in order:

1. `recordPersonMerges`: a row per app in `APPS` (an upsert that renews `user_id`, `created_at`, `legacy`, and resets
   the attempts), first so the apps hear of it however the rest goes.
2. Items and folders: `owner_id` the user, a personal one's `scope` to `p:<user>`.
3. Favourites, opens (the later `last_opened_at`, hidden only if both), use days, Shared with me, placement defaults,
   form reads (the further `seen`), thread people: copied with `INSERT OR IGNORE` or the upsert shown (the account's
   own wins), then the guest's deleted.
4. The Timeline: scope rows `p:<guest>` to `p:<user>` (`UPDATE OR IGNORE`, then the rest dropped), `actor_id`, the
   later `last_seen_at`, dismissals.
5. Actions assigned to or by the guest name the user.

Answer `200 { items }` (items moved). After it: Drive signalled when items or folders moved; `drainPersonMerges` run
off the request's path; logged `[index] merged a guest { items, legacy, into }`. Run again, it finds nothing to move.

### Telling the apps (`drainPersonMerges`)

Run by the merge request and the frequent cron's second step. Rows older than 7 days go first (given up). Then up to
50 due rows (never tried, or not for an hour), oldest first; each `POST <app>/api/internal/people/:guest/merge {
into, legacy? }`; confirmed rows go (deleted only when `user_id` is unchanged, so a newer merge is not lost); an app
this deployment does not run counts as confirmed; a failure gets `attempts + 1`, `last_attempt_at`.

### The handoff (`POST /app/migration/handoff`), in order

1. Only livediagram's key (`403 wrong_app` for another app's).
2. The person from `X-Index-Person`: an account id, or a guest matching the guest id pattern (`401` otherwise).
3. `MIGRATION_LIMITER` keyed `handoff:<person>`, before the body is read: `429 rate_limited`.
4. The body read against 32 MiB: over is `413 payload_too_large`; not an object `400`.
5. `app` one of `liveplanner`, `livedocuments`, `livedesign` (`400 invalid_app`); `title` 1 to 500 (`400
invalid_title`); `payload` `{ v: 1, app: <same>, id: <id>, tabs: [] }` (`400`).
6. The item made as `POST /items` would: the person's, `source 'import'`, root of their own space, no team, with its
   `created { source: 'import' }` event; a taken id is `409 item_exists`.
7. The app's `PUT /items/:id/migration` with the payload, `ownerId` the person and `teamId` null whatever it said, 30 s.
8. The app failing: the row deleted (its event cascades), `502 migration_failed`, logged `[index] migration handoff
not taken`.
9. Drive signalled; logged `[index] migration handoff`; `201 { id, app }`.

## Data and persistence

| Table               | Key               | Indexes                                   | Written by | Read by             |
| ------------------- | ----------------- | ----------------------------------------- | ---------- | ------------------- |
| `person_app_merges` | `(guest_id, app)` | `person_app_merges_due (last_attempt_at)` | the merge  | `drainPersonMerges` |

Columns: `user_id`, `created_at`, `attempts` (default 0), `last_attempt_at`, and `legacy` (0006, `INTEGER NOT NULL
DEFAULT 0`). The merge also writes every table listed in step 3 and 4 above.

## Errors and edge cases

| Case                                | Answer                                   |
| ----------------------------------- | ---------------------------------------- |
| Not accounts' key                   | `401`                                    |
| A guest target without `legacy`     | `400`                                    |
| The same merge twice                | `200 { items: 0 }`, the app rows renewed |
| An app down                         | retried hourly for 7 days                |
| Too many handoffs                   | `429 rate_limited`                       |
| The target app can't write the room | the item undone, `502 migration_failed`  |

## Testing

| Test                                                  | Pins                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/app.test.ts` (15)       | the guest merge; merges told to apps                                      |
| `liveworkspace/apps/index/src/migration.test.ts` (14) | the handoff: who may call, limits, the app's door, undoing; legacy merges |
| `packages/index-app/src/migration-door.test.ts`       | each app writing a handed-off room                                        |

## Constants and configuration

`MERGES_PER_RUN` 50, `NOTICE_RETRY_AFTER_MS` 1 h, `NOTICE_GIVE_UP_MS` 7 d (`person-merges.ts`, `person-notices.ts`);
`HANDOFF_MAX_BYTES` 32 MiB, `HANDOFF_APP_TIMEOUT_MS` 30 s (`migration-handoff.ts`, `config.ts`). `MIGRATION_LIMITER`:
namespace `1106` (staging `2106`), 60 per 60 s; absent, nothing is limited.

## Defaults ledger

- `IDX14`: where a guest and the account both have a favourite, open, default or form read, the account's is kept
  (or the later or further of the two).
- `IDX15`: a handed-off item always lands at the root of the person's own space, whatever its old document said.
