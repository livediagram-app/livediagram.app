# The Trash, purges and closing an account: blueprint

Derived from [one-explorer-contracts.md "Items"](../one-explorer-contracts.md#items), "Purging" and
["Closing an account"](../one-explorer-contracts.md#closing-an-account). The spec decides; this file only adds
engineering precision, read from the code. Defaults are cited as `IDXn`. Paths are relative to the repository root.

Scope, by file:

| File                                              | Role                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `liveworkspace/apps/index/src/items.ts`           | `DELETE /items/:id`, `POST /items/:id/restore`, `GET`/`DELETE /trash`                            |
| `liveworkspace/apps/index/src/purge.ts`           | `purgeRows`, `drainTombstones`, `drainTombstonesSoon`, `sweepEmpty`, `sweep`, `sweepLooseEvents` |
| `liveworkspace/apps/index/src/account-purge.ts`   | `POST /internal/purge-person`, `purgePerson`, `continuePurges`                                   |
| `liveworkspace/apps/index/src/person-notices.ts`  | `recordPersonNotices`, `drainPersonNotices`                                                      |
| `packages/index-app/src/purge.ts`, `anonymise.ts` | Each app's side: drop an item's room, anonymise a closed account in its items                    |

## Domain and naming

| Term          | Identifier                                      | Meaning                                                                 |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Trashed       | `trashed_at`, `trash_reason` `deleted`/`empty`  | In the Trash; purged 30 days on                                         |
| Purged        | the row deleted, a `purge_tombstones` row added | Gone from the index; the app still to drop the content                  |
| Tombstone     | `purge_tombstones (item_id)`                    | Kept until the app confirms                                             |
| Person purge  | `person_purges (person_id)`                     | A closed account's purge, run again for 2 hours                         |
| Person notice | `person_app_notices (person, app, item)`        | What an app must hear about a closed account (`item ''` for the person) |
| Anonymised    | `ANONYMISED_PERSON` `'deleted'`                 | What a closed account's id becomes where it stays                       |

## Behaviour and state

### An item's Trash state

| From      | Event                                                | To      | Effect                                                                                |
| --------- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| live      | `DELETE /items/:id`                                  | trashed | `trashed_at = now`, `trash_reason 'deleted'`; `trashed` event                         |
| live      | `DELETE ?reason=empty`                               | trashed | reason `empty`; no event                                                              |
| live      | daily empty clean-up                                 | trashed | reason `empty`, `empty_swept_for = updated_at`; no event                              |
| trashed   | `POST /items/:id/restore`                            | live    | both cleared; `restored` event; `{ item }`                                            |
| any       | `DELETE ?permanent=true`                             | purged  | tombstone; the app told at once; `204`                                                |
| team item | a teammate's `DELETE ?reason=offline&permanent=true` | trashed | the team's copy to its Trash (not purged); `taken_offline` on the teammate's Timeline |
| own item  | `DELETE ?reason=offline&permanent=true`              | purged  | `taken_offline` (`off:<item>:<now>`) on the person's Timeline                         |
| trashed   | 30 days in the Trash                                 | purged  | daily sweep                                                                           |

Delete and restore need `edit` and `manage` (owner or team, never a link).

### The Trash routes

- `GET /trash`: the `trash` view ([items.md](items.md)).
- `DELETE /trash?app=&team=`: purges up to 1,000 trashed items of the scope (the team's when `team` is joined, else the
  person's), newest first; `app` narrows, and a delegate must name its own (`403 wrong_app`); the first 25 drained at
  once; `{ purged }`; the Explorer calls again while some remain.

### Purging (`purgeRows`)

50 items a batch, two statements each: a tombstone (`ON CONFLICT DO NOTHING`) and the row's delete (its favourites,
opens, use days, links, passwords, Shared with me, collab and Timeline rows cascade). `drainTombstones` asks each
app `DELETE <app>/api/internal/items/:id`, 6 at a time; a `404` counts as done; confirmed rows go, failed ones get
`attempts + 1`, `last_attempt_at`, `last_error`, all in one batch.

### The daily sweep (`23 4 * * *`, `sweep`), in order

1. `sweepEmpty`: one `UPDATE … RETURNING` moves up to 1,000 live items whose summary is `'{}'` or `hasContent = 0`,
   unchanged for 30 days, and not already swept for this `updated_at`, oldest change first (`items_empty`).
2. Up to 500 items trashed more than 30 days ago, oldest first, purged.
3. Drive signals for the owners of personal items moved or purged.
4. Up to 200 tombstones, longest waiting first, drained.
5. Up to 1,000 events about no item that no scope sees, deleted.
6. Logged `[index] sweep: <n> empty items to the Trash, purged <n> items, apps confirmed <n>`.

### Closing an account (`POST /internal/purge-person`)

`{ personId, teamIds? (≤ 200 ids) }` with `MERGE_KEY`. The request is recorded first (`person_purges`, renewing
`requested_at`), then `purgePerson` runs within 5 s and 300 D1 calls; `200 { done, items }` whatever is left. The
first 25 purged items are drained at once, and person notices sent.

`purgePerson`, every step in chunks of 500 rows and safe to run again:

1. Record person notices: one row per app (`item ''`), and one per item of someone else's that names them (threads,
   actions, edits), up to 5,000 per source per pass.
2. Items and folders in a team that outlives them: owner becomes `deleted`.
3. Their own items (including those in teams closed with them): tombstones in, rows out.
4. Everything else theirs: folders (defaults cascade), favourites, opens, use days, Shared with me, placement defaults,
   form reads, thread people; their id in threads' participants and mentions becomes `deleted`; actions assigned to
   or by them name `deleted`; Timeline rows only they saw, then their events no one else sees, then `actor_id
'deleted'` and `actor_name NULL` on the rest; their `drive_people` row.
5. `settleRequest`: a finished request older than 2 hours is forgotten; else `finished_at` and `runs + 1`.

The frequent cron (`continuePurges`): up to 20 recorded purges oldest first within 30 s and 300 calls; then up to 300
tombstones never tried or not tried for an hour; then `drainPersonNotices`.

### Person notices (`drainPersonNotices`)

Rows older than 7 days are given up (logged). Up to 20 due (person, app) groups a run (never tried, or not for an
hour); each `POST <app>/api/internal/people/:id/purge { items }` with up to 100 items; confirmed rows go; an app not
configured counts as confirmed; a failure gets `attempts + 1`.

## Data and persistence

| Table                | Key                         | Indexes                                          | Written by              | Read by              |
| -------------------- | --------------------------- | ------------------------------------------------ | ----------------------- | -------------------- |
| `purge_tombstones`   | `item_id`                   | `purge_tombstones_due (last_attempt_at)`         | every purge             | drains               |
| `person_purges`      | `person_id`                 |                                                  | purge request; settle   | the frequent cron    |
| `person_app_notices` | `(person_id, app, item_id)` | `person_app_notices_due (last_attempt_at)`       | `purgePerson`           | `drainPersonNotices` |
| `items` (Trash)      | `id`                        | `items_trash`, `items_trashed_at`, `items_empty` | delete, restore, sweeps | the Trash, sweeps    |

`person_purges.team_ids` is a JSON list (default `'[]'`); `finished_at` null while work remains; `runs` default 0.

## Errors and edge cases

| Case                                   | Behaviour                                                |
| -------------------------------------- | -------------------------------------------------------- |
| An app never had the content           | its `404` counts as done                                 |
| An app unreachable                     | the tombstone waits; retried hourly by the frequent cron |
| A purge call runs out of time          | `done: false`; the cron finishes it                      |
| Writes with an old token after closing | the purge runs again for 2 hours and catches them        |
| An item restored unchanged             | not swept empty again for the same `updated_at`          |

## Testing

| Test                                                        | Pins                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/items.test.ts` (35)           | the Trash among items                                                  |
| `liveworkspace/apps/index/src/app.test.ts` (15)             | the daily purge; the empty clean-up                                    |
| `liveworkspace/apps/index/src/account-purge.test.ts` (9)    | `POST /internal/purge-person`; telling the apps about a closed account |
| `packages/index-app/src/purge.test.ts`, `anonymise.test.ts` | each app dropping rooms and anonymising                                |

## Constants and configuration

`TRASH_RETENTION_MS` 30 d, `EMPTY_ITEM_STALE_MS` 30 d (`packages/index-client`); `SWEEP_ITEMS_MAX` 500,
`TOMBSTONES_PER_RUN` 200, `EMPTY_SWEEP_MAX` 1000, `PURGE_NOW_MAX` 25, `APP_CALL_CONCURRENCY` 6, `APP_CALL_TIMEOUT_MS`
10 s (`config.ts`); `ITEMS_PER_BATCH` 50, `EMPTY_TRASH_MAX` 1000, `LOOSE_EVENTS_SWEEP_MAX` 1000 (`purge.ts`,
`items.ts`); `ANONYMISED_PERSON` `'deleted'`, `CHUNK` 500, `TEAMS_MAX` 200, `LINGER_MS` 2 h, `FREQUENT_CRON`
`*/15 * * * *`, `TOMBSTONES_PER_FREQUENT_RUN` 300, `TOMBSTONE_RETRY_AFTER_MS` 1 h, `PURGES_PER_RUN` 20,
`CALL_BUDGET` 5 s / 300, `CRON_BUDGET` 30 s / 300 (`account-purge.ts`); `PERSON_ITEMS_PER_CALL` 100, `RECORD_MAX`
5,000, `GROUPS_PER_RUN` 20, `NOTICE_RETRY_AFTER_MS` 1 h, `NOTICE_GIVE_UP_MS` 7 d (`person-notices.ts`);
`ROOM_PURGE_TIMEOUT_MS` 3 s, `ROOM_PURGE_CONCURRENCY` 10, `BULK_PURGE_MAX` 100 (`packages/index-app/src/purge.ts`).

## Defaults ledger

- `IDX11`: an app that does not answer a tombstone is retried hourly with no give-up; person notices and merges give
  up after 7 days.
- `IDX12`: a person purge is kept and run again for 2 hours after the request, the life of an access token.
