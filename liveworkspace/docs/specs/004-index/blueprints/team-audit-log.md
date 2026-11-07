# The team audit log: blueprint

Derived from [team-audit-log.md](../team-audit-log.md). The spec decides; this file only adds engineering precision,
read from the code. Defaults are cited as `IDXn`. Paths are relative to the repository root.

Scope, by file:

| File                                                      | Role                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/migrations/0011_team_audit.sql` | the `team_audit_events` table and its indexes                                                                                                 |
| `liveworkspace/apps/index/src/team-audit.ts`              | `itemAuditStatement`, `accountAuditStatement`, `deletedAuditStatement`, `webhookAuditStatement`, `sweepTeamAudit`, `teamAuditPurgeStatements` |
| `liveworkspace/apps/index/src/timeline.ts`                | `eventStatements` and `bulkEventStatements` add the audit statement to the event's batch                                                      |
| `liveworkspace/apps/index/src/items.ts`                   | a move's `auditTeams` and `fromTeamId`; Delete Forever and Empty Trash pass who did it to `purgeRows`                                         |
| `liveworkspace/apps/index/src/purge.ts`                   | `purgeRows(…, audit?)` logs team items before their rows go; `sweep` runs `sweepTeamAudit`                                                    |
| `liveworkspace/apps/index/src/sharing.ts`                 | a public link's `shared` carries `public`                                                                                                     |
| `liveworkspace/apps/index/src/webhooks/routes.ts`         | a team webhook's add and delete, each one batch with its audit row                                                                            |
| `liveworkspace/apps/index/src/account-purge.ts`           | `purgePerson` runs `teamAuditPurgeStatements` after the person's own rows                                                                     |
| `packages/index-client/src/constants.ts`                  | `TEAM_AUDIT_*_TYPES`, `TEAM_AUDIT_EVENT_TYPES`, `TeamAuditEventType`, `TEAM_AUDIT_RETENTION_MS`, the read's limits, `TEAM_AUDIT_EVENT_LABELS` |
| `liveworkspace/apps/index/src/team-audit-read.ts`         | `GET /team-audit`: `handleTeamAudit`, `pageQuery`, `eventOf`, `csvRow`                                                                        |
| `liveworkspace/apps/index/src/webhooks/access.ts`         | `accountsAdminTeams` (who runs the team now), `accountsPeopleNames` (names now, `POST /api/account/index/people`)                             |
| `packages/index-client/src/{types,client}.ts`             | `TeamAuditEvent`, `TeamAuditQuery`, `TeamAuditPage`, `TeamAuditCsv`; `teamAudit`, `teamAuditCsv`                                              |
| `packages/api-kit/src/csv.ts`                             | `toCsv`, formula-safe (shared with the data export)                                                                                           |

## Domain and naming

| Kind                                                                                                           | Written by                                         | Row id                 | Team                                 |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------- | ------------------------------------ |
| `team_invite_sent`, `team_joined`, `team_declined`, `team_role_changed`, `team_member_removed`, `team_renamed` | `bulkEventStatements` (`POST /internal/timeline`)  | the Timeline event's   | each `t:<team>` scope named          |
| `shared`, `unshared`, `trashed`, `restored`                                                                    | `eventStatements` (sharing, connected tabs, items) | the Timeline event's   | the item's team, read in the batch   |
| `moved`                                                                                                        | `eventStatements` (`PATCH /items/:id`)             | the Timeline event's   | `auditTeams`: the old and new team   |
| `deleted` (`reason: offline` for an owner's Take Offline)                                                      | `purgeRows` (Delete Forever, Empty Trash)          | `del:<item>:<at>`      | the item's team, read before it goes |
| `webhook_added`, `webhook_removed` (`webhookId`, `kind`, `host`)                                               | `POST /webhooks`, `DELETE /webhooks/:id`           | `wh+:<id>`, `wh-:<id>` | the webhook's `t:<team>` scope       |

`subject_id` is `json_extract(detail, '$.personId')`: the person a team event is about. A connected tab's pass
(`connections.ts`) is a share link, so its `shared` and `unshared` on a team item are logged too.

## Behaviour and state

- Every write is `INSERT OR IGNORE` on `(team_id, id)`: a resent or self-extending event adds nothing and never
  updates a row.
- An item event's statement follows its Timeline statement in the same batch and reads it back by id
  (`timeline_events` primary key, then `items` primary key), so a gated event (`shared`'s `when`) that wrote nothing
  logs nothing.
- `moved`: `auditTeams` is `[row.team_id, teamId]` when the team changed (nulls dropped, so into or out of a team is
  one row, between teams two), and `[]` for a folder move (no statement).
- `accountAuditStatement` takes the batch's `TEAM_AUDIT_ACCOUNT_TYPES` events and their `t:` scopes as
  `[team, event id]` pairs through one `json_each`; a batch with none adds no statement.
- `deletedAuditStatement` runs in `purgeRows`' batch before the `DELETE FROM items`, one statement per 50-item chunk,
  `WHERE id IN (json_each) AND team_id IS NOT NULL`. The daily Trash sweep passes no `audit` (`IDX29`).

## Data and persistence

| Table               | Key             | Indexes                                                                                                                                                                                                                                                                                                                 | Written by        | Read by                                 |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------- |
| `team_audit_events` | `(team_id, id)` | `team_audit_time (team_id, occurred_at DESC, id DESC)`; `team_audit_actor (team_id, actor_id, occurred_at DESC, id DESC)`; `team_audit_type (team_id, type, occurred_at DESC, id DESC)`; `team_audit_age (occurred_at)`; `team_audit_people (actor_id)`; `team_audit_subject (subject_id) WHERE subject_id IS NOT NULL` | the writers above | the sweep, the purge, `GET /team-audit` |

No foreign keys: a row outlives its item and its team. Columns: `team_id`, `id`, `type`, `app`, `actor_id`,
`actor_name`, `subject_id`, `item_id`, `title`, `detail` (JSON, string values), `occurred_at`.

## Interfaces and contracts

`GET /team-audit` (a person's route, `PERSON_ROUTES`):

| Param    | Value                                           | Refused                       |
| -------- | ----------------------------------------------- | ----------------------------- |
| `team`   | the team's id (required)                        | `400 invalid_query`           |
| `person` | who did it (`actor_id`)                         | `400 invalid_query` not an id |
| `kind`   | one `TEAM_AUDIT_EVENT_TYPES` kind               | `400 invalid_query`           |
| `from`   | ms, inclusive; digits only, a safe integer      | `400 invalid_query`           |
| `to`     | ms, exclusive                                   | `400 invalid_query`           |
| `limit`  | 1 to `TEAM_AUDIT_LIMIT_MAX` (100); 50 unset     | `400 invalid_query`           |
| `cursor` | the last page's `nextCursor` (or X-Next-Cursor) | `400 invalid_cursor`          |
| `format` | `json` (unset) or `csv`                         | `400 invalid_query`           |

The query is read before accounts is asked. Then: a caller that isn't an account's own session (a guest, `person.app`,
`person.drive`, `person.export`) is `403 not_team_admin` without asking; `accountsAdminTeams` null is
`503 team_audit_unavailable`; a team not in it is `403 not_team_admin` (a member and someone outside alike, so the
answer says nothing of who is in it).

- JSON: `{ events: TeamAuditEvent[], nextCursor }`. `actor` and `subject` are `{ id, name }`: `name` is accounts' now
  (`accountsPeopleNames`, one call per 100 distinct people, 4 at once), else the event's `actor_name` or the
  detail's `memberName`, else null; `deleted` is never sent to accounts and reads `{ id: 'deleted', name: null }`.
  Names unavailable degrade to the carried names, never a refusal. An empty page asks accounts nothing.
- CSV: `text/csv; charset=utf-8`, a UTF-8 byte-order mark, `Content-Disposition: attachment;
filename="team-activity-<YYYY-MM-DD>.csv"`, `private, no-store`. Columns: `Time (UTC)` (ISO 8601), `Event`
  (`TEAM_AUDIT_EVENT_LABELS`), `Kind`, `App`, `By`, `By ID`, `About`, `About ID`, `Name`, `Document ID`, `Detail`
  (`key=value; …`, without `personId` and `memberName`, which About shows). Read `CSV_READ_CHUNK` (2,000) rows a
  query up to `TEAM_AUDIT_CSV_MAX` (10,000); more matching sets `X-Next-Cursor`. `limit` is validated but a file
  ignores it.

## Errors and edge cases

- A deleted team's rows stay until the year (`IDX30`); a team closed with an account loses them at once.
- An `actor_name` is only what accounts sent with a team event; the index's own rows have none (it keeps no names).
- Guests are never team members, so a guest merge rewrites nothing here.

## Security and trust

The read is a team admin's alone, asked of accounts on every request (`accountsAdminTeams`, as a team webhook's
management is); a token's `teams` claim is never trusted for it. No content is copied: titles, ids, levels, kinds and a webhook's host, never its URL or
secret.

## Performance and limits

One statement per event or per batch, each a primary-key read of the event it copies: `POST /internal/timeline` with
100 team events is four statements (`timeline.test.ts` "the bound"); the plans never scan `timeline_events`, `items`
or the log (`team-audit.test.ts` "the bound"). The sweep is one indexed `DELETE … LIMIT 5000` a day (`IDX28`).

The read is one keyset query per page, `team_id = ?` plus each filter given, `(occurred_at < ? OR (occurred_at = ?
AND id < ?))` for the cursor, `ORDER BY occurred_at DESC, id DESC LIMIT n + 1`: at most 9 bound parameters, and its
plan uses `team_audit_time`, `_actor` or `_type` with no temp B-tree for every filter (`team-audit-read.test.ts` "the
bound"). With both `person` and `kind`, one index serves and the other filters within the team's year. A 10,000-row
CSV with 250 people is five queries and three name calls, under a 1.5 s CPU budget in the test.

## Testing

| Test                                                   | Pins                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/team-audit.test.ts` (9)  | a team item's shares, trash, restore, delete for good, moves across teams, Take Offline and Empty Trash; nothing for personal items; accounts' team events once, never a token's; the year's sweep; anonymising; the plans                                                                  |
| `liveworkspace/apps/index/src/webhooks/routes.test.ts` | a team webhook added and removed; never a personal one                                                                                                                                                                                                                                      |
| `liveworkspace/apps/index/src/timeline.test.ts`        | 100 account events in four statements, all logged                                                                                                                                                                                                                                           |
| `packages/index-client/src/constants.test.ts`          | no token kind and no `team_deleted` in `TEAM_AUDIT_EVENT_TYPES`                                                                                                                                                                                                                             |
| `liveworkspace/apps/index/src/team-audit-read.test.ts` | admin allowed; member, outsider, token-claimed admin, guest, app, Drive mirror and export refused; 503 when accounts can't say; names now (left members included), fallbacks, `deleted`; every filter and pages; malformed queries; CSV content, cap, next cursor and CPU budget; the plans |
| `liveworkspace/apps/accounts/src/account-api.test.ts`  | `POST /api/account/index/people`: the key only, unknown ids left out, at most 100                                                                                                                                                                                                           |
| `packages/index-client/src/client.test.ts`             | `teamAudit`, `teamAuditCsv` and its refusals                                                                                                                                                                                                                                                |
| `packages/api-kit/src/csv.test.ts`                     | quoting, formula-safety, CRLF                                                                                                                                                                                                                                                               |

## Constants and configuration

`TEAM_AUDIT_RETENTION_MS` 365 days, `TEAM_AUDIT_PAGE` 50, `TEAM_AUDIT_LIMIT_MAX` 100, `TEAM_AUDIT_CSV_MAX` 10,000,
`TEAM_AUDIT_NEXT_CURSOR_HEADER` (`packages/index-client`); `TEAM_AUDIT_SWEEP_MAX` 5,000 (`team-audit.ts`);
`CSV_READ_CHUNK` 2,000 (`team-audit-read.ts`); `NAMES_PER_CALL` 100 (`webhooks/access.ts`).

## Defaults ledger

- `IDX28`: the daily run deletes at most 5,000 rows past the year.
- `IDX29`: the Trash's own 30-day purge writes no row.
- `IDX30`: a deleted team's rows stay until the year takes them.
- `IDX31`: a page is 50 rows unless asked, at most 100; a CSV file at most 10,000, read 2,000 a query.
- `IDX32`: `person` filters on who did it, not whom it is about; `kind` takes one kind.
- `IDX33`: names accounts can't give fall back to those the event carried; the read never fails for want of names.

## Build order (Work Tracker #160)

1. This table, its write path and its sweep (no reader, nothing visible). Done (#1378).
2. The admins' read: `GET /team-audit?team=&person=&kind=&from=&to=&limit=&cursor=` and its CSV export, a team admin
   only, one index range per filter (`team_audit_time`, `_actor`, `_type`). Done.
3. The Activity section in team settings that shows it, with its filters and Export CSV.
