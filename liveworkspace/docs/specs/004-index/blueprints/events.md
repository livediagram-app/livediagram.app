# The event log: blueprint

Derived from [one-explorer-contracts.md "The event log"](../one-explorer-contracts.md#the-event-log). The spec
decides; this file only adds engineering precision, read from the code. Defaults are cited as `IDXn`. Paths are
relative to the repository root.

Scope, by file:

| File                                              | Role                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/events.ts`          | `eventStatements`, `bulkEventStatements`, `editedEventId`, `sweepEvents`                                        |
| `liveworkspace/apps/index/src/history.ts`         | `buildHistoryQuery`, `itemHistory`: `GET /items/:id/history`                                                    |
| `liveworkspace/apps/index/src/event-push.ts`      | `pushAppEvents` (an app's `edited`), `parseAccountEvent`, `handleAccountEvents` (accounts' team events)         |
| `liveworkspace/apps/index/src/event-key.ts`       | `personEventKey(s)`: the one-way key of a person in `ed:` and `aa:` event ids                                   |
| `liveworkspace/apps/index/src/collab-push.ts`     | `collabEvents`, `retractedComments`: collaboration events from a tab's push                                     |
| `liveworkspace/apps/index/src/visitors.ts`        | Opened and Copied by a Visitor                                                                                  |
| `liveworkspace/apps/index/src/team-audit.ts`      | The team audit log's statement each team-level event adds to its batch ([team-audit-log.md](team-audit-log.md)) |
| `liveworkspace/apps/index/src/webhooks/outbox.ts` | The webhook deliveries an item event queues in its batch ([webhooks.md](webhooks.md))                           |

## Domain and naming

| Type                                                            | Source                            | Id                                               | Shown in History to              |
| --------------------------------------------------------------- | --------------------------------- | ------------------------------------------------ | -------------------------------- |
| `created`, `synced`                                             | `insertItem`                      | a UUID                                           | everyone who reaches it directly |
| `renamed { from }`, `moved { folderName, teamId, fromTeamId? }` | `PATCH /items/:id`                | a UUID                                           | everyone who reaches it directly |
| `trashed`, `restored`                                           | delete, restore                   | a UUID                                           | everyone who reaches it directly |
| `shared { level, public? }`, `unshared`                         | link routes                       | a UUID                                           | everyone who reaches it directly |
| `favourited`                                                    | `PUT /favourites/:id`             | a UUID                                           | the person who did it            |
| `edited`                                                        | `PUT /app/items/:id/events`       | `ed:<item>:<key>:<day>`                          | everyone who reaches it directly |
| `commented { reply? }`                                          | collab push                       | `cm:<item>:<tab>:<element>:<count>`              | everyone who reaches it directly |
| `comment_resolved`                                              | collab push                       | `cr:<item>:<tab>:<element>:<count>`              | everyone who reaches it directly |
| `action_assigned`                                               | collab push                       | `aa:<item>:<tab>:<element>:<action>:<key>`       | everyone who reaches it directly |
| `action_done`                                                   | collab push                       | `ad:<item>:<tab>:<element>:<action>:<updatedAt>` | everyone who reaches it directly |
| `opened_by_visitor`                                             | a grant through a link            | `vo:<item>:<visitor>:<day>`                      | the item's owner                 |
| `copied_by_visitor`                                             | a copy through a link             | `vc:<item>:<visitor>`                            | the item's owner                 |
| `team_*`                                                        | accounts, `POST /internal/events` | accounts' own                                    | none (no item): the audit log    |

`<day>` is the UTC day number (`ms / 86,400,000`). A visitor with no identity is `link:<code>`. Gone with the
Timeline (0017 deletes their rows): `share_link_expiring`, `image_uploaded`, `taken_offline`, and accounts'
`team_deleted`, `token_created`, `token_revoked` and `token_expiring`.

## Behaviour and state

### Recording

- `eventStatements` (in the batch of the change): `INSERT … SELECT … FROM items WHERE id = ?` (so the app and title
  come from the row, and an optional `when` clause gates it), `ON CONFLICT (id) DO UPDATE` for events that extend
  themselves (time, title, actor name move on). One statement, plus one queuing its webhook deliveries when it is a
  kind a webhook listens for, plus one copying it into its team's audit log when it is a kind the log keeps.
- `bulkEventStatements`: any number of events in one statement through `json_each`; the same id again moves its time
  and takes the newest title and detail. Then its webhooks' statement and its audit log's, as above.
- A push from further ahead than 5 minutes is dated now (`FUTURE_SLACK_MS`).
- Team audit ([team-audit-log.md](team-audit-log.md)): `eventStatements` adds one `itemAuditStatement` for a
  `shared`, `unshared`, `moved`, `trashed` or `restored` (the item's team, or a move's `auditTeams`), and
  `bulkEventStatements` one `accountAuditStatement` for the batch's team events, by each one's `detail.teamId`. So
  `POST /internal/events` is two statements when it carries a team event, one otherwise.

### Reports from apps and accounts

- `PUT /app/items/:id/events`, from the item's app: `{ events: [{ type: 'edited', actorId, actorName?, at }] }` (at
  most 100). One event per person and day, the latest time kept; each also a use day (Most Used). `204`;
  `400 invalid_events`.
- `PUT /app/people/events`, from an app: `204`, the body unread. Kept one release for apps that still report images,
  then it goes.
- `POST /internal/events`, from accounts (`MERGE_KEY`), and for one release the same at `POST /internal/timeline`:
  `{ events: [{ id (≤ 300), type, actorId?, actorName?, title, at, detail? }] }` (1 to 100). One or two statements;
  resent ids change nothing new. Detail at most 12 string keys, values cut to 500; title cut to 200; actor name to
  200; `at` at most now + 5 minutes. An old body's `scopes` is ignored; `team_deleted` and `token_*` are taken and
  dropped (`204`, so an old outbox's backlog never retries forever).

### Collaboration events (`collabEvents`, at most 100 a push, newest)

Compared with what the tab held, in the batch that replaces it: more comments is `commented` (detail carries the
words, `reply` past the first); turned resolved is `comment_resolved`; an open action with a new assignee is
`action_assigned` (detail `{ action, assigneeId, assigneeName }`); turned done is `action_done`. Anything dated before
the item was made is not news. `retractedComments`: a thread with fewer comments drops its `commented` events past
the count; a thread gone drops them and its `comment_resolved` too; a push at the 500-thread cap is never read as
deletions.

### Reading (`GET /items/:id/history?limit=&cursor=`)

`limit` default 30, at most 100 (`400 invalid_query`); a bad cursor is `400 invalid_cursor`. The item is read once
(`getItemRow`) and checked with `directAccess`: its owner, or a member of its team by the token. Anyone else
(someone outside, a link visitor whatever their level, no one signed in, an item that isn't there) is
`404 not_found`, as for any item they can't reach. Archived and trashed items read for their owner as any other.

One statement (`buildHistoryQuery`): a range of `events_item` (`item_id = ?1`, then `occurred_at DESC, id DESC`),
from `now - EVENT_RETENTION_MS` (so a lapsed event the sweep has not reached yet never shows), past the cursor,
`limit + 1` rows; `favourited` only where `actor_id` is the reader, and `opened_by_visitor` and `copied_by_visitor`
only for the owner. The index order is the page order, so there is no sort, and the rows it skips are only those
kinds. Each event carries the item as it is now (`toItem` on the row already read, nothing read per event).
Answer: `{ events: ItemEvent[], nextCursor }`. Binds are numbered (`?1` to `?6`, and the limit), seven at most.

### The sweep (`sweepEvents`, the daily run's `events` step)

`DELETE FROM events WHERE rowid IN (SELECT rowid FROM events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)`,
through `events_occurred`, `EVENT_SWEEP_CHUNK` (500) a statement, repeated while a statement takes a full chunk, at
most `EVENT_SWEEP_ROUNDS` (40) a run: 20,000 events a day at most. A backlog past that waits for the next day (the
step logs `more`). Deleting an event deletes nothing else: webhook deliveries and audit rows hold their own copy.

## Data and persistence

| Table    | Key  | Indexes                                                                                                        | Written by                          | Read by                           |
| -------- | ---- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| `events` | `id` | `events_item (item_id, occurred_at DESC, id DESC)`; `events_actor (actor_id)`; `events_occurred (occurred_at)` | every recorder; merge; purge; sweep | History; webhooks; audit; notices |

`item_id` cascades from `items` (a purged item takes its events). `actor_id` becomes `deleted` when an account
closes, and that person's `favourited` events go. Made by `0017_events.sql` from `timeline_events`, after dropping
`timeline_event_scopes`, `timeline_scope_state` and `timeline_dismissals` and deleting the kinds above.

## Testing

| Test                                                        | Pins                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/events.test.ts` (24)          | what the index records; what apps report (and the old images report's 204); collaboration; accounts' team events (both paths, dropped kinds, refusals); one item's History (who reads it, 404 otherwise, favourites, 30 days, paging, the plan); the bound; the daily sweep (cap, order, a realistic day and a worst-case backlog, timed) |
| `liveworkspace/apps/index/src/events-migration.test.ts` (4) | 0017 on a database of every migration before it: rows kept and deleted, indexes, cascades, foreign keys, D1-safe                                                                                                                                                                                                                          |
| `liveworkspace/apps/index/src/event-key.test.ts` (2)        | the key: stable per person, different between people, fixed-length hex; each person keyed once                                                                                                                                                                                                                                            |
| `liveworkspace/apps/index/src/visitors.test.ts` (2)         | visitors in History, the owner's alone                                                                                                                                                                                                                                                                                                    |

## Constants and configuration

`PERSON_EVENT_KEY_LENGTH` 32 (`event-key.ts`: `<key>` in `ed:` and `aa:` ids, the first 32 hex of
SHA-256(`liveworkspace:timeline:v1:<person>`), the prefix kept from the Timeline's days since changing it would
change every key; ids from before it keep the person's id). `EVENT_RETENTION_MS` 30 days, `HISTORY_PAGE` 30,
`HISTORY_LIMIT_MAX` 100, `APP_EVENTS_MAX` 100, `COLLAB_EVENTS_MAX` 100, `PLATFORM_APP` `'liveworkspace'`
(`packages/index-client`); `FUTURE_SLACK_MS` 5 min, `ACTOR_NAME_MAX` 200, `EVENT_SWEEP_CHUNK` 500,
`EVENT_SWEEP_ROUNDS` 40 (`events.ts`); `EVENT_ID_MAX` 300, `TITLE_MAX` 200, `DETAIL_KEYS_MAX` 12, `DETAIL_VALUE_MAX`
500 (`event-push.ts`).

Measured (`events.test.ts`, CPU time, local SQLite): two History pages beside 102,000 events, 1.8 ms; a day's sweep
of 5,000 beside 150,000 kept, 9.9 ms; a run at its cap of 20,000 from a 60,000 backlog, 32.9 ms.

## Defaults ledger

- `IDX9`: an event from a clock more than 5 minutes fast is dated now, so it can't pin itself to the top.
- `IDX10`: an empty item tidied away (`reason=empty`) records no `trashed` event.
