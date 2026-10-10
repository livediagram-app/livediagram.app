# Explorer Home, data: blueprint

Derived from [Explorer Home](../explorer-home.md) (Jump back in, What happened, Opens), with the allocation of
[Within reach](../../004-interface-design/within-reach.md), the event store of [Timeline](../timeline.md), the access
set of [Inbox](../inbox.md) §4, the identity rules of
[Auth + guest access](../../014-identity/auth-and-guest-access.md) and the owner-keyed list of
[API](../../015-api/api.md#owner-keyed-data). The spec decides; this file only adds engineering precision. This
blueprint covers the data: recording opens and makings, Jump back in's set, the reads and the wire. The view, and this browser's
own opens of its local documents, are [Explorer Home, view](explorer-home-view.md).
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                           | Role                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/home.ts`                                              | Wire types, verbs, limits, the window, rejections, the open marker header                      |
| `packages/api-schema/src/within-reach.ts`                                      | `withinReach`, `utcDay`; shared with the view and the Shapes flyout                            |
| `packages/api-schema/src/creation-use.ts`                                      | `readMarkUsed`, `importMarksUse`, `MARK_USED_INVALID`, `MARKED_USED_IMPORT_MAX`                |
| `packages/api-schema/src/error-telemetry.ts`                                   | `home` resource                                                                                |
| `apps/api/migrations/0063_document_opens.sql`                                  | `document_opens`, its indexes, `timeline_events_actor_idx`                                     |
| `apps/api/migrations/0065_within_reach.sql`                                    | Drops frecency: the rank index, `frecency_key`, `open_days`, `first_opened_at`, the seed stamp |
| `apps/api/src/home/local-day.ts`                                               | `parseTimeZone`, `localDay`                                                                    |
| `apps/api/src/home/what-happened.ts`                                           | `verbOf`, `groupWhatHappened` (pure)                                                           |
| `apps/api/src/home/record-open.ts`                                             | `recordDocumentOpen`: the dedupe, the write, the last open, the fingerprints                   |
| `apps/api/src/timeline/seen.ts`                                                | `SEEN_WINDOW_MS`, `isNewVisit`: the unread mark's visit rule, shared with the Timeline route   |
| `apps/api/src/timeline/backfill.ts`                                            | The reconstructed edit says `backfilled: true`; it and the reconstructed creation keep a row   |
| `apps/api/src/db/document-visibility.ts`                                       | `VISIBLE_DOCUMENTS_CTES`: the documents a person can open, shared with the Inbox               |
| `apps/api/src/db/document-opens.ts`                                            | The `document_opens` statements: read, record, touch, migrate, delete, sweep                   |
| `apps/api/src/db/home.ts`                                                      | `readJumpBackIn`, `REAL_EDIT`, `MARKED_MAKING`, `readWhatHappenedRows`, `readMe`               |
| `apps/api/src/db/collab-index.ts`                                              | The Inbox's `SCOPE_CTES` composed from `VISIBLE_DOCUMENTS_CTES`                                |
| `apps/api/src/db/timeline.ts`                                                  | `NOT_IN_FEED`: the feed and the unread count leave `document_opened` out                       |
| `apps/api/src/db/account.ts`                                                   | Account deletion and sign-up migration of `document_opens`                                     |
| `apps/api/src/timeline/document-events.ts`, `tab-save.ts`                      | `recordDocumentOpened`; `markUsed`, `reply` and `assigneeId` on the snapshots                  |
| `apps/api/src/routes/documents.ts`                                             | The create reads `markUsed` and marks a genuine create; the copy route marks the copy          |
| `apps/api/src/timeline/tab-diff.ts`                                            | `newComments` says whether each new comment is a reply                                         |
| `apps/api/src/routes/document-subresource-routes.ts`                           | The tab read records a marked open; the comment POST stamps `reply`                            |
| `apps/api/src/routes/home.ts`                                                  | `GET /api/home`                                                                                |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`, `types.ts`                      | Dispatch, `HOME_RATE_LIMITER`, the `home_opens` sweep, `home` owner-scoped                     |
| `apps/api/src/responses.ts`                                                    | CORS allows `X-Document-Open`                                                                  |
| `apps/api/wrangler.toml`                                                       | `HOME_RATE_LIMITER` in the default and `[env.staging]` blocks                                  |
| `apps/api/src/openapi/manifest.ts`, `apps/api/scripts/gen-openapi-schemas.mjs` | The route; the `HomeResponse` schema; the create body's `markUsed`                             |
| `packages/agent-verbs/src/mcp/schema.ts`, `apps/mcp/src/tools.ts`              | `create_document`'s optional `markUsed`, passed through to the create                          |
| `apps/live/lib/api/documents.ts`                                               | `apiCreateDocument(..., { markUsed })` sends `markUsed: false` only                            |
| `apps/live/lib/board-scene-import.ts`                                          | `importDocuments` marks by the number of documents it sets out to make                         |
| `apps/live/lib/api/home.ts`                                                    | `apiReadHome`                                                                                  |
| `apps/live/lib/api/tabs.ts`                                                    | `apiLoadTab(..., { open })` sends the marker                                                   |
| `apps/live/app/document/[id]/seed-fetched-document.ts`                         | The editor's first-tab read is the marked one, unless embedded                                 |
| `apps/live/app/document/[id]/{useIdentityBootstrap,useEditorState}.ts`         | `embed` reaches the seed                                                                       |

## Domain and naming

| Term              | Identifier                                                      | Meaning                                                            |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Home              | `home` (route segment, log prefix `home:`)                      | The Explorer landing view's data                                   |
| Open              | `document_opens` row, `document_opened` event                   | The editor loading a document for a person                         |
| Open marker       | `DOCUMENT_OPEN_HEADER` `X-Document-Open: 1`, `readDocumentOpen` | The editor's declaration that this tab read is an open             |
| Open day          | `last_open_day` (`YYYY-MM-DD`, UTC), `document_opened` event    | A UTC day with at least one open: one event per person per doc/day |
| Last open         | `document_opens.last_opened_at`                                 | The person's latest open of a document, moved by every open        |
| Use day           | `useDays`, CTE `used`                                           | A UTC day with an open, a real edit or a marked making             |
| Making            | `document_created`, `document_duplicated` events                | The person making a document: a create, a duplicate, a copy        |
| Marked making     | snapshot `markUsed: true`, `MARKED_MAKING`                      | A making that counts as a use                                      |
| Mark used         | body `markUsed`, `readMarkUsed`                                 | The create's say on whether its making counts (default true)       |
| Bulk import       | `importMarksUse(count)`, `MARKED_USED_IMPORT_MAX`               | An import that sets out to make more than one document             |
| Use window        | `WITHIN_REACH_USE_WINDOW_DAYS`, `windowStartOf(now)`            | The last 90 UTC days, today included, over which use days count    |
| Last use          | `lastUsedAt`                                                    | The latest of the last open, last real edit and marked making      |
| Jump back in      | `jumpBackIn`, `HomeJumpBackInItem`, `HOME_WITHIN_REACH_PER_ROW` | A [Within reach](../../004-interface-design/within-reach.md) set   |
| What happened     | `whatHappened`, `HomeGroup`, `HomeAction`, `HomePerson`         | Others' actions, grouped                                           |
| Group             | `HomeGroup`, id `<documentId>:<day>`                            | One document's actions on one local day                            |
| Summary           | `HomeGroup.summary`                                             | A group with more than one person: one entry with a sentence       |
| Verb              | `HomeVerb`, `HOME_VERBS`                                        | The closed action vocabulary, in sentence order                    |
| Visible documents | `VISIBLE_DOCUMENTS_CTES`, CTE `visible`                         | Own, joined-team, shared with a live link; never trashed           |
| Via               | `via`: `own` / `team` / `shared`                                | How the person reaches a document                                  |
| Local day         | `localDay(at, tz)`, `day`                                       | The reader's calendar day for an instant                           |
| Me                | CTE `me`                                                        | The person's id plus every alias (`owner_aliases`)                 |

Banned: "visit" or "view" for an open, "frecency" (the rule has no decay), "notification" for a What happened
action, "timeline" for anything on Home but the link that leaves for the Timeline (`GET /api/timeline`).

## Behaviour and state

### Recording an open

`recordDocumentOpen(env, liveDoc, personId, now)`, called from the tab read only when `readDocumentOpen(header)` is
true, after the read gate passed and the tab exists, inside `ctx.waitUntil`:

1. `day = utcDay(now)`. Read `document_opens (person, document)`.
2. Row with `last_open_day = day` → `touchLastOpen`: `last_opened_at = now` where the stored one is earlier; log
   `open-touched`. Stop: the day is already counted.
3. Upsert the row: insert `{last_opened_at: now, last_open_day: day}`; on conflict update both **only where the
   stored `last_open_day < excluded.last_open_day`**.
4. Changes = 0 → another request recorded today first: skip, `reason=race`. Stop.
5. `recordDocumentOpened(env, liveDoc, personId, now)`: a `timeline_events` row, `event_type = 'document_opened'`,
   `source_type = 'document'`, `source_id = documentId`, `dedupe_key = dedupeKeyForDay(personId, now)`,
   title "Document Opened", description and snapshot naming the document, scopes `[user:<personId>]` only.
6. Log `open-recorded`. A thrown error anywhere logs `open-failed` and is swallowed.

Invariants: at most one `document_opened` event per person per document per UTC day (the open-day record Within
reach counts); the event and the row agree on that day (the row is written first and gates the event); the last
open never moves backwards; an open never reaches a `document` or `team` scope.

### Recording a making

Spec [Making a document](../explorer-home.md#making-a-document). A making is recorded on the creation's own Timeline
event, which every create already writes, so it costs no write of its own (`D136`):

1. `POST /api/documents` reads `readMarkUsed(body.markUsed)` with the other body checks, before anything is
   written: absent → `true`; a boolean → itself; anything else → 400 `bad_request` `MARK_USED_INVALID`
   ("invalid markUsed"), `documents: rejected reason=mark_used_invalid` logged (`D139`).
2. A genuine create (no clash) that is not a sync emits `recordDocumentCreated(env, liveDoc, owner, { markUsed })`;
   the event's snapshot carries `markUsed: true` only when it counts. A re-commit emits nothing; a sync emits
   `document_synced`, never marked. Logged `home: making doc=<id> marked=<true|false>`.
3. `POST /api/documents/:id/copy` emits `recordDocumentDuplicated(..., { markUsed: true })`: a copy always counts
   (`D138`).
4. The Timeline backfill's reconstructed `document_created` is written with `keepExisting` and no mark, so it
   neither counts nor clears the mark of the real one when it lands on the same row (`D137`).

`MARKED_MAKING` (`db/home.ts`) is the one predicate, on `e`: `e.event_type IN ('document_created',
'document_duplicated') AND json_extract(e.snapshot, '$.markUsed') IS 1`. Only makings recorded with the mark count,
so the makings before it (each a real `document_created` with no mark) never do, nor any bulk import made before.

Invariants: a making is at most one use day (its event's `occurred_at`, the server's now, whatever dates the body
carries); a making and an open on one UTC day are one use day (`COUNT(DISTINCT day)`); an unmarked making never
moves the last use.

### Jump back in

The server's half of the [Within reach](../../004-interface-design/within-reach.md) set; the view merges this
browser's local documents in by the same rule ([view blueprint](explorer-home-view.md#jump-back-in)).

`readJumpBackIn(env, personId, now, n = HOME_WITHIN_REACH_PER_ROW)`, one statement:

1. `used`: the person's `timeline_events` with `actor_id = person`, `source_type = 'document'`, `occurred_at` in
   `[windowStartOf(now), now]`, and `event_type = 'document_opened'`, or (`'document_edited'` and `REAL_EDIT`), or
   `MARKED_MAKING`,
   grouped by `source_id`: `use_days = COUNT(DISTINCT occurred_at / DAY_MS)` (UTC days), `last_at = MAX(occurred_at)`.
   An edit day counts as an open day (spec "an edit needs an open"), which is also what keeps day one from being
   empty: the edit history reaches back a year, opens only to when they began to be recorded (`D126`).
2. `reach`: `visible` left-joined to `used` and to the person's `document_opens`, keeping documents with either:
   `use_days` (0 without `used`) and `last_used_at = MAX(last_at, last_opened_at)`.
3. `picked`: the first `n` of `reach` with `use_days > 0` by `use_days DESC, last_used_at DESC, document_id ASC`,
   united with the first `2n` by `last_used_at DESC, document_id ASC`. By the merge property, these hold the
   person's whole server-side set.
4. The picked rows with their place columns, ordered `document_id ASC`; then `withinReach(rows, n, useOf)` with
   `useOf = { uses: useDays, lastUsedAt }`; the response is `[...mostUsed, ...recent]` (at most `2n`).

`windowStartOf(now)` is UTC midnight of `utcDay(now - (WITHIN_REACH_USE_WINDOW_DAYS - 1) days)`: the window is the
last 90 UTC days, today included, the same days the browser keeps for its local documents.

### Reads

Both reads scope by `visible` **first**, then filter. `visible` is the union of three indexed lookups (own
documents by `owner_id`, joined teams' documents by `team_id`, `shared_with` by its primary key), each document
then checked: not trashed, and owned, or in a joined team, or shared with `shareable = 1`; a shared row whose live
code is gone (expired or revoked) is dropped. `via` is `own`, then `team`, then `shared`; `share_code` the oldest
live code at the person's role and tab scope; `scope_tab_id` the person's tab scope for `shared`, else null.

- **Jump back in** (`readJumpBackIn`): above.
- **What happened** (`readWhatHappenedRows` then `groupWhatHappened`): `visible` (excluding `scope_tab_id IS NOT
NULL`) → `timeline_event_scopes (document, id)` → `timeline_events` with `event_type IN (comment_added,
comment_resolved, document_edited, action_assigned, action_completed, team_document_added)`, `occurred_at` in
  `[now - HOME_WHAT_HAPPENED_DAYS days, now]`, `actor_id` not null and not in `me`; ordered `occurred_at DESC, id
DESC`, limit `HOME_WHAT_HAPPENED_ACTION_MAX` (`D68`).

### Verbs

`verbOf(eventType, snapshot, me)`:

| Event                 | Verb                                                                          | Detail                 |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| `comment_added`       | `replied` when `snapshot.reply === true`, else `commented`                    | the stored description |
| `comment_resolved`    | `resolved`                                                                    | the stored description |
| `document_edited`     | `edited`                                                                      | null                   |
| `action_assigned`     | `assigned_you` when `snapshot.assigneeId` is in `me` (`D74`), else `assigned` | `actionName`           |
| `action_completed`    | `completed`                                                                   | `actionName`           |
| `team_document_added` | `shared`                                                                      | `teamName`             |

`HOME_VERBS` order: `commented, replied, resolved, edited, assigned_you, assigned, completed, shared`.

### Grouping

`groupWhatHappened(rows, tz, me)`, rows newest first:

- Key `<documentId>:<localDay(occurredAt, tz)>`. Groups ordered by their newest action, descending.
- `actions`: every row, newest first, `{ id, verb, personId, occurredAt, detail }`.
- `people`: distinct actors, newest action first (`D78`), each `{ id, name, color, pictureUrl }` from `participants`.
- `verbs`: distinct verbs with counts, in `HOME_VERBS` order. `total` = number of actions; `latestAt` = newest.
- `summary` = `people.length > 1`.

### Real edits

The Timeline backfill writes its `document_edited` with `snapshot.backfilled = true` and `keepExisting` (the
upsert does nothing when the day's row already exists), so it never marks a real edit. A real edit landing on a
backfilled row replaces the snapshot and so clears the mark. `REAL_EDIT` (`db/home.ts`) is the one predicate:
`json_extract(snapshot, '$.backfilled') IS NOT 1`. Within reach counts only real edits as use days. Migration 0063 marks the rows backfilled before the mark
existed: `document_edited` rows whose `created_at` is more than `LEGACY_BACKFILL_SKEW_MS` (60 s) after their
`occurred_at` (a live edit is stored within milliseconds of the time it claims; `D79`).

### Home read side effects

`GET /api/home` moves the Timeline feed's unread mark by the Timeline's own rule (`isNewVisit`,
`apps/api/src/timeline/seen.ts`: no mark yet, or the mark older than `SEEN_WINDOW_MS`), off the response path. The
response carries `lastSeenAt`, the mark as it stood before this read (`D75`). It seeds nothing: the Timeline
user-scope backfill is the Timeline's own business.

## Interfaces and contracts

### Open marker

- Header `X-Document-Open`, value `1`; any other value or absence is not an open. Allowed by CORS.
- Sent by `apiLoadTab(owner, documentId, tabId, shareCode, { open: true })`, which `seedFetchedDocument` passes for
  the editor's eager first-tab read when not embedded. The marker joins the in-flight dedupe key. Every other
  caller (lazy tab loads, room resync, duplicate, Take Offline, the Drive mirror, the MCP server) sends none (`D66`).

### `POST /api/documents` `markUsed`

`markUsed?: boolean` on the create body, default `true` (`D134`); the api spec's
[Marking a document used](../../015-api/api.md#marking-a-document-used). `readMarkUsed(value: unknown):
{ ok: true; markUsed: boolean } | { ok: false }`. The OpenAPI request schema documents it. The live client sends
`markUsed: false` and nothing otherwise; the MCP `create_document` input `markUsed` (optional boolean) is passed
through only when given. The upcoming CLI's `document create --no-recent` maps to `markUsed: false`.

`importMarksUse(documentCount)` → `documentCount <= MARKED_USED_IMPORT_MAX`: `importDocuments(sources, ...)` passes
`markUsed: importMarksUse(sources.length)` to every document it creates, counting the documents it sets out to make,
not the ones that land (`D135`); `debugLog('[board-scene] import', { ..., markUsed })` says which.

### `GET /api/home`

Query: `tz` (IANA name, default `UTC`, `D67`). Response `200 HomeResponse`:

```ts
type HomeDocument = {
  documentId: string;
  name: string; // the document's current name
  via: 'own' | 'team' | 'shared';
  shareCode: string | null; // 'shared' only
  tabId: string | null; // the tab a scoped share opens; null = every tab
  teamId: string | null; // null for 'shared' (D69)
  teamName: string | null;
  folderId: string | null; // null for 'shared' (D69)
  folderName: string | null;
  ownerName: string | null;
  savedAt: number; // the thumbnail's version
  empty: boolean; // nothing drawn: ask for no thumbnail
};
type HomeJumpBackInItem = HomeDocument & {
  useDays: number; // use days in the window: the most-used measure
  lastUsedAt: number; // the later of the last open and the last real edit: the recent measure
};
type HomeVerb =
  | 'commented'
  | 'replied'
  | 'resolved'
  | 'edited'
  | 'assigned_you'
  | 'assigned'
  | 'completed'
  | 'shared';
type HomePerson = {
  id: string;
  name: string | null;
  color: string | null;
  pictureUrl: string | null;
};
type HomeAction = {
  id: string;
  verb: HomeVerb;
  personId: string;
  occurredAt: number;
  detail: string | null;
};
type HomeVerbCount = { verb: HomeVerb; count: number };
type HomeGroup = HomeDocument & {
  id: string; // `${documentId}:${day}`
  day: string; // YYYY-MM-DD in `tz`
  summary: boolean;
  people: HomePerson[];
  verbs: HomeVerbCount[];
  total: number;
  latestAt: number;
  actions: HomeAction[];
};
type HomeResponse = {
  jumpBackIn: HomeJumpBackInItem[]; // the server's within-reach set: most used, then recent; at most 2n
  whatHappened: HomeGroup[];
  lastSeenAt: number | null; // the unread mark before this read; null = never looked
};
```

`GET /api/home/timeline` is gone: 404, like any other path under `/api/home`.

### Rejections

`{ error: HomeRejection }`, status 400, checked before any read; `home: rejected reason=<token>` logged.

| Token        | When                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| `tz_invalid` | `tz` longer than 64 characters or not accepted by `Intl.DateTimeFormat` |

Other answers: 400 `bad_request` without an identity (`missingAuth`); 401 from the guest-signature gate
(`home` is owner-scoped); 429 `rate_limited`; 404 for any other method or path under `/api/home`.

### Client

`apiReadHome(owner, { tz })` → `HomeResponse | null`. Null means "we could not ask" (any non-2xx, a thrown fetch, an
unparseable body), never an empty Home, as `apiListTimeline` does.

## Data and persistence

Migration `0063_document_opens.sql` (`D65`) created `document_opens`, `timeline_events_actor_idx` and the seed
stamp, and marked legacy reconstructed edits. Migration `0065_within_reach.sql` (`D127`) retires frecency:

```sql
DROP INDEX IF EXISTS document_opens_rank_idx;
ALTER TABLE document_opens DROP COLUMN frecency_key;
ALTER TABLE document_opens DROP COLUMN open_days;
ALTER TABLE document_opens DROP COLUMN first_opened_at;
ALTER TABLE timeline_scope_state DROP COLUMN frecency_seeded_at;
```

What remains:

```sql
CREATE TABLE document_opens (
  owner_id       TEXT NOT NULL,   -- the person: guest id or Clerk id
  document_id    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  last_opened_at INTEGER NOT NULL,
  last_open_day  TEXT NOT NULL,   -- 'YYYY-MM-DD', UTC
  PRIMARY KEY (owner_id, document_id)
);
CREATE INDEX document_opens_last_idx ON document_opens (last_opened_at);
CREATE INDEX timeline_events_actor_idx ON timeline_events (actor_id, occurred_at DESC, id DESC);
```

| Field            | Class                                       |
| ---------------- | ------------------------------------------- |
| `owner_id`       | Identity (owner-keyed: deletion, migration) |
| `document_id`    | Reference, cascades with the document       |
| `last_opened_at` | Fact, the recent measure and retention key  |
| `last_open_day`  | Derived, the dedupe key                     |

The open days themselves are the `document_opened` events (one per person per document per UTC day, in the
person's `user` scope), kept for the Timeline's year, well past the 90-day window. A making's use is its creation
event's `snapshot.markUsed` (classed as a fact, written once, `D136`): no migration, and it goes wherever the
event goes (account deletion, sign-up migration, document purge, the Timeline's retention).

- **Account deletion**: `DELETE FROM document_opens WHERE owner_id = ?`. Other people's opens of the account's
  documents cascade with the documents. The `document_opened` events go with `deleteTimelineForOwner` (actor and
  user scope).
- **Sign-up migration** (`migrateDocumentOpens(from, to)`): `UPDATE OR IGNORE ... SET owner_id = to WHERE owner_id =
from` moves every row the account does not already hold; each leftover (opened under both) merges into the
  account's row, `last_opened_at` and `last_open_day` the later (`D70`); then the guest rows are deleted. The events
  move with `migrateTimelineOwner`, so the use days are the days of either identity: a day opened under both counts
  once.
- **Document purge**: rows cascade; events go with `documentsTimelineSweepStatement`. **Trash**: rows stay, the
  reads skip the document; a restore brings it back.
- **Retention**: the 03:00 UTC cron deletes rows with `last_opened_at < now - TIMELINE_RETENTION_MS` (365 days)
  through `scheduleSweep('home_opens', ...)`; the events go with the Timeline's own sweep.
- Timeline dismissals (`timeline_event_scopes.deleted_at`) are not read: Home reads by actor, not by scope (`D71`).

## Errors and edge cases

| Case                                                 | Handling                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Tab read refused (403 / 404 / 410)                   | Nothing recorded: the gate runs first                                       |
| Marker on a resync / lazy load                       | Not sent; if a client sends it anyway, it only moves the last open          |
| Two first opens of the day race                      | The guarded upsert lets one through; the other logs `reason=race`, no event |
| Two opens race the last open                         | `last_opened_at` only moves forwards                                        |
| D1 failure while recording                           | `open-failed` logged, the tab read already answered                         |
| Opened across UTC midnight                           | Two open days, as the spec's UTC rule says                                  |
| Opened and edited on one day                         | One use day (`COUNT(DISTINCT day)`)                                         |
| A reconstructed edit                                 | Not a use day (`REAL_EDIT`)                                                 |
| Opened more than 90 days ago only                    | `use_days = 0`: never most used, still recent by its last open              |
| Created, never opened or edited                      | In Jump back in: the marked making is a use day and the last use            |
| Created with `markUsed: false` (a bulk import)       | Not in `candidates` until its first open or edit; on the Recent page        |
| Created before makings were marked                   | No mark: joins at its next open or edit                                     |
| Created and opened on one UTC day                    | One use day                                                                 |
| `markUsed` not a boolean                             | 400 `invalid markUsed`; nothing created                                     |
| Re-commit or sync with `markUsed`                    | Not a making: no mark                                                       |
| Backfill over a marked creation                      | `keepExisting`: the mark stays                                              |
| Creation event emit fails                            | `timeline emit failed` logged; the document is made, its making not counted |
| Document trashed, team left, link revoked or expired | Dropped by `visible`; its rows remain until purge / sweep                   |
| Tab-scoped shared document                           | In Jump back in; never in What happened                                     |
| Own action on someone else's document                | Not in What happened (`me`); a use day when it is an edit                   |
| Guest-era action of the person (aliased id)          | Excluded from What happened by `me`                                         |
| Actor without a participant row                      | `HomePerson.name` / `color` / `pictureUrl` null                             |
| Legacy `comment_added` / `action_assigned` rows      | `commented` / `assigned`                                                    |
| Future-dated event                                   | Excluded (`occurred_at <= now`)                                             |
| What happened over its cap                           | First 200 actions newest first; `what-happened-capped` logged               |
| `tz` with a DST change inside the window             | `Intl` resolves each instant's own offset                                   |
| A person with no opens and no edits                  | Empty arrays                                                                |
| `document_opened` in `GET /api/timeline`             | Left out by `NOT_IN_FEED`; never counted unread                             |
| A client still asking `GET /api/home/timeline`       | 404                                                                         |

## Security and trust

- `home` is in `OWNER_SCOPED_SEGMENTS`: a Clerk-shaped `X-Owner-Id` is refused and, when armed, the guest signature
  is required.
- `visible` is the boundary: an event, an open or an entry about a document the person cannot open is never read.
  Team membership is matched on the resolved owner id, as the Inbox does; teams are Clerk-only and a Clerk-shaped
  guest header never reaches a route.
- Opens are private: the event is scoped to `user:<person>` only, left out of the feed, and not a What happened
  verb. Nobody's open is in anybody else's response.
- `markUsed` is client-supplied and only decides whether the caller's own making counts in the caller's own Jump
  back in. The mark rides the creation's snapshot, which the creation's audience already reads; it says nothing
  the creation does not.
- The marker is client-supplied and can only add opens to the caller's own data, for documents the read gate
  already admitted, at most once per document per day.
- A tab-scoped link shows nothing in What happened (the actions name things on other tabs). A shared document's
  team and folder are not disclosed (`D69`).
- Person ids on the wire are the same actor ids `GET /api/timeline` already carries to the same audience.
- `HOME_RATE_LIMITER`: 60 reads per 60 s per resolved owner (`D73`); an API token caller is also under
  `API_TOKEN_READ_RATE_LIMITER`. Absent binding → allow (self-host).

## Performance and limits

Let `L` be the person's library (own + joined-team + shared documents).

| Path                  | Cost                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Tab read, marked      | Response path: nothing. `waitUntil`: 1 point read; then 1 update (same day) or 1 upsert + the emit   |
| Tab read, unmarked    | Nothing                                                                                              |
| Jump back in          | `L` + the person's events in 90 days on `timeline_events_actor_idx` (a heavy user: 40 a day, 3,600)  |
| What happened         | `L` + every document-scope row of `L` within retention (worst case `L = 2,000`, 20 events each: 40k) |
| `document_opens` size | One row per person per document opened in the last 365 days, ~100 B; 2,000 documents ≈ 200 KB        |
| Response              | Worst 8 documents at ~0.4 KB, 200 actions at ~0.3 KB: ~65 KB; typical under 15 KB                    |

The What happened scan is the one that grows with a team's history. The measured remedy, if it bites, is an
`added_at` range on the document-scope membership, not a cleverer query (as [Timeline](../timeline.md) §3.2 says of
its own read).

## Web Experience

`GET /api/home` answers the whole first screen in one request, so the view needs no waterfall for LCP. Thumbnails
stay on their own lazy route.

## Observability

| Fingerprint                                                      | Where         |
| ---------------------------------------------------------------- | ------------- |
| `home: open-recorded doc=<id>`                                   | api, info     |
| `home: open-touched doc=<id>`                                    | api, info     |
| `home: open-skipped reason=race doc=<id>`                        | api, info     |
| `home: open-failed doc=<id>` + error                             | api, error    |
| `home: making doc=<id> marked=<true/false>`                      | api, info     |
| `documents: rejected reason=mark_used_invalid`                   | api, warn     |
| `home: read jump=<n> used=<n> recent=<n> groups=<n> actions=<n>` | api, info     |
| `home: what-happened-capped max=<n>`                             | api, warn     |
| `home: rejected reason=<token>`                                  | api, warn     |
| `home: rate-limited`                                             | api, warn     |
| `home: seen-marked`                                              | api, info     |
| `home: seen-mark-failed` + error                                 | api, error    |
| `home: opens-migrated moved=<n> merged=<n>`                      | api, info     |
| `home_opens sweep: deleted <n> rows older than <cutoff>`         | api cron, log |
| `[home] read failed status=<n/thrown/unparseable>`               | editor, warn  |

## Testing

| Rule                                                                                    | Test                                                                                      |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rejection tokens, the marker reader, the use window                                     | `packages/api-schema/src/home.test.ts`                                                    |
| The within-reach allocation                                                             | `packages/api-schema/src/within-reach.test.ts`                                            |
| Time zone parse and local day                                                           | `apps/api/src/home/local-day.test.ts`                                                     |
| Verbs, grouping, summary, order, counts                                                 | `apps/api/src/home/what-happened.test.ts`                                                 |
| Record, same-day touch, next day, race, private scope, failure log                      | `apps/api/src/home/record-open.test.ts` (real SQLite)                                     |
| The tab read records a marked open only, never an unmarked or refused one               | `apps/api/src/routes/document-open-marker.test.ts` (real SQLite)                          |
| Jump back in: use days in the window, edit days, dedupe, the split, access, ties        | `apps/api/src/routes/home.test.ts` (real SQLite)                                          |
| A making counts once, an opted-out or bulk one does not, a sync or re-commit never      | `apps/api/src/routes/document-create-use.test.ts` (real SQLite)                           |
| `readMarkUsed`, `importMarksUse`                                                        | `packages/api-schema/src/creation-use.test.ts`                                            |
| The client sends `markUsed: false` only; a bulk import sends it, a single one does not  | `apps/live/lib/api-client.test.ts`, `apps/live/lib/board-scene-import.test.ts`            |
| `create_document` passes `markUsed` through only when given                             | `apps/mcp/src/create-document-placement.test.ts`                                          |
| An imported board is in Jump back in unopened; a two-board import is not (guest, phone) | `apps/live/e2e/creation-use.spec.ts`                                                      |
| Signed in: the same, and an API create with `markUsed: false` stays out                 | `apps/live/e2e/clerk-stub/creation-use.spec.ts`                                           |
| Reads: others only, opens private, rejections, rate limit, the unread mark, no timeline | `apps/api/src/routes/home.test.ts` (real SQLite)                                          |
| The backfill marks its edit, never marks a real one; migration 0063 marks legacy rows   | `apps/api/src/home/real-edits.test.ts` (real SQLite)                                      |
| The feed and the unread count leave opens out                                           | `apps/api/src/db/timeline-opens.test.ts` (real SQLite)                                    |
| Migration merge and account deletion                                                    | `apps/api/src/db/document-opens.test.ts`, `account-owner-columns.test.ts`                 |
| Reply flag on both comment paths, `assigneeId` on assignment                            | `apps/api/src/timeline/tab-diff.test.ts`, `apps/api/src/routes/home-snapshots.test.ts`    |
| CORS allows the marker                                                                  | `apps/api/src/responses.test.ts`                                                          |
| The Inbox unchanged on the shared visibility                                            | `apps/api/src/db/activity-mentions.test.ts`, `apps/api/src/db/trash-surfaces.test.ts`     |
| OpenAPI parity and schemas                                                              | `apps/api/src/openapi/*.test.ts`                                                          |
| Route labels know `home`                                                                | `apps/api/src/route-resources.test.ts`, `packages/api-schema/src/error-telemetry.test.ts` |
| Client wrapper: null on failure; the marker header and its dedupe key                   | `apps/live/lib/api/home.test.ts`, `apps/live/lib/api-client.test.ts`                      |
| The seed marks the first-tab read unless embedded                                       | `apps/live/app/document/[id]/seed-fetched-document.test.ts`                               |

## Constants and configuration

| Constant                        | Value     | Where                                         | Provenance                                   | Safe range     |
| ------------------------------- | --------- | --------------------------------------------- | -------------------------------------------- | -------------- |
| `HOME_WITHIN_REACH_PER_ROW`     | 4         | `packages/api-schema/src/home.ts`             | Spec (4 most used, 4 recent)                 | 3 to 6         |
| `WITHIN_REACH_USE_WINDOW_DAYS`  | 90        | same                                          | Spec ("the last 90 days")                    | 30 to 365      |
| `HOME_WHAT_HAPPENED_DAYS`       | 14        | same                                          | Spec                                         | 7 to 30        |
| `HOME_WHAT_HAPPENED_ACTION_MAX` | 200       | same                                          | `D68`                                        | 100 to 500     |
| `HOME_TZ_MAX_LENGTH`            | 64        | same                                          | Longest IANA name is 32; double for headroom | 32 to 128      |
| `MARKED_USED_IMPORT_MAX`        | 1         | `packages/api-schema/src/creation-use.ts`     | Spec ("more than one document in one go")    | fixed          |
| `TIMELINE_RETENTION_MS`         | 365 days  | `packages/api-schema/src/timeline.ts`         | Spec (the Timeline's retention), reused      | fixed          |
| `LEGACY_BACKFILL_SKEW_MS`       | 60 s      | `apps/api/migrations/0063_document_opens.sql` | `D79`                                        | 10 s to 10 min |
| `SEEN_WINDOW_MS`                | 60 s      | `apps/api/src/timeline/seen.ts`               | [Timeline](../timeline.md) §2.5, reused      | fixed          |
| `HOME_RATE_LIMITER`             | 60 / 60 s | `apps/api/wrangler.toml`, namespace `1008`    | `D73`                                        | 30 to 120      |

No environment variable. The rate limiter binding is optional; absent means allow.

## Defaults ledger

D65 to D80, D126, D127 and D133 to D139 in [DEFAULTS.md](DEFAULTS.md); D72, D76, D80 and D133 are retired there.
