# Explorer Home, data: blueprint

Derived from [Explorer Home](../explorer-home.md) (Jump back in, What happened, Timeline, Opens), with the event
store of [Timeline](../timeline.md), the access set of [Activity page](../activity-page.md) §4, the identity rules of
[Auth + guest access](../../014-identity/auth-and-guest-access.md) and the owner-keyed list of
[API](../../015-api/api.md#owner-keyed-data). The spec decides; this file only adds engineering precision. This
blueprint covers the data: recording opens, ranking, the reads and the wire. The view, and this browser's own opens
of its local documents, are [Explorer Home, view](explorer-home-view.md).
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                           | Role                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/home.ts`                                              | Wire types, verbs, limits, rejections, the open marker header                                |
| `packages/api-schema/src/error-telemetry.ts`                                   | `home` resource, `timeline` route word                                                       |
| `apps/api/migrations/0063_document_opens.sql`                                  | `document_opens`, its two indexes, `timeline_events_actor_idx`                               |
| `packages/api-schema/src/frecency.ts`                                          | The half-life, `nextFrecencyKey`, `mergeFrecencyKeys`, `frecencyScore`; shared with the view |
| `apps/api/src/home/local-day.ts`                                               | `parseTimeZone`, `localDay`                                                                  |
| `apps/api/src/home/what-happened.ts`                                           | `verbOf`, `groupWhatHappened` (pure)                                                         |
| `apps/api/src/home/record-open.ts`                                             | `recordDocumentOpen`: the dedupe, the write, the fingerprints                                |
| `apps/api/src/home/seed-frecency.ts`                                           | `seedFrecency`, `FRECENCY_SEED_EVENT_MAX`, `FRECENCY_SEED_DOCUMENT_MAX`                      |
| `apps/api/src/timeline/seen.ts`                                                | `SEEN_WINDOW_MS`, `isNewVisit`: the unread mark's visit rule, shared with the Timeline route |
| `apps/api/src/timeline/backfill.ts`                                            | The reconstructed edit says `backfilled: true` and keeps an existing row                     |
| `apps/api/src/db/document-visibility.ts`                                       | `VISIBLE_DOCUMENTS_CTES`: the documents a person can open, shared with Activity              |
| `apps/api/src/db/document-opens.ts`                                            | The `document_opens` statements: read, upsert, migrate, delete, sweep                        |
| `apps/api/src/db/home.ts`                                                      | `readJumpBackIn`, `readHomeTimeline`, `parseHomeCursor`, `readWhatHappenedRows`, `readMe`    |
| `apps/api/src/db/collab-index.ts`                                              | Activity's `SCOPE_CTES` composed from `VISIBLE_DOCUMENTS_CTES`                               |
| `apps/api/src/db/timeline.ts`                                                  | `NOT_IN_FEED`: the feed and the unread count leave `document_opened` out                     |
| `apps/api/src/db/account.ts`                                                   | Account deletion and sign-up migration of `document_opens`                                   |
| `apps/api/src/timeline/document-events.ts`, `tab-save.ts`                      | `recordDocumentOpened`; `reply` and `assigneeId` on the snapshots                            |
| `apps/api/src/timeline/tab-diff.ts`                                            | `newComments` says whether each new comment is a reply                                       |
| `apps/api/src/routes/document-subresource-routes.ts`                           | The tab read records a marked open; the comment POST stamps `reply`                          |
| `apps/api/src/routes/home.ts`                                                  | `GET /api/home`, `GET /api/home/timeline`                                                    |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`, `types.ts`                      | Dispatch, `HOME_RATE_LIMITER`, the `home_opens` sweep, `home` owner-scoped                   |
| `apps/api/src/responses.ts`                                                    | CORS allows `X-Document-Open`                                                                |
| `apps/api/wrangler.toml`                                                       | `HOME_RATE_LIMITER` in the default and `[env.staging]` blocks                                |
| `apps/api/src/openapi/manifest.ts`, `apps/api/scripts/gen-openapi-schemas.mjs` | The two routes; `HomeResponse`, `HomeTimelinePage` schemas                                   |
| `apps/live/lib/api/home.ts`                                                    | `apiReadHome`, `apiReadHomeTimeline`                                                         |
| `apps/live/lib/api/tabs.ts`                                                    | `apiLoadTab(..., { open })` sends the marker                                                 |
| `apps/live/app/document/[id]/seed-fetched-document.ts`                         | The editor's first-tab read is the marked one, unless embedded                               |
| `apps/live/app/document/[id]/{useIdentityBootstrap,useEditorState}.ts`         | `embed` reaches the seed                                                                     |

## Domain and naming

| Term              | Identifier                                                      | Meaning                                                                 |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Home              | `home` (route segment, log prefix `home:`)                      | The Explorer landing view's data                                        |
| Open              | `document_opens` row, `document_opened` event                   | The editor loading a document for a person, once per person per doc/day |
| Open marker       | `DOCUMENT_OPEN_HEADER` `X-Document-Open: 1`, `readDocumentOpen` | The editor's declaration that this tab read is an open                  |
| Open day          | `last_open_day` (`YYYY-MM-DD`, UTC), `openDays`                 | A UTC day with at least one open                                        |
| Frecency          | `frecency_key` (epoch ms), `FRECENCY_HALF_LIFE_MS`              | The rank of Jump back in                                                |
| Frecency score    | `frecencyScore(key, at)`                                        | Decayed open days at `at`: `2^((key - at) / H)`                         |
| Jump back in      | `jumpBackIn`, `HomeJumpBackInItem`, `HOME_JUMP_BACK_IN_MAX`     | The ranked strip                                                        |
| Timeline (Home)   | `timeline`, `HomeTimelineEntry`, `HomeTimelineKind`             | Own created / updated / opened, on documents still openable             |
| What happened     | `whatHappened`, `HomeGroup`, `HomeAction`, `HomePerson`         | Others' actions, grouped                                                |
| Group             | `HomeGroup`, id `<documentId>:<day>`                            | One document's actions on one local day                                 |
| Summary           | `HomeGroup.summary`                                             | A group with more than one person: one entry with a sentence            |
| Verb              | `HomeVerb`, `HOME_VERBS`                                        | The closed action vocabulary, in sentence order                         |
| Visible documents | `VISIBLE_DOCUMENTS_CTES`, CTE `visible`                         | Own, joined-team, shared with a live link; never trashed                |
| Via               | `via`: `own` / `team` / `shared`                                | How the person reaches a document                                       |
| Local day         | `localDay(at, tz)`, `day`                                       | The reader's calendar day for an instant                                |
| Me                | CTE `me`                                                        | The person's id plus every alias (`owner_aliases`)                      |

Banned: "visit" or "view" for an open, "recent" for the frecency rank, "notification" for a What happened action,
"feed" for Home's Timeline column (the feed is `GET /api/timeline`).

## Behaviour and state

### Recording an open

`recordDocumentOpen(env, liveDoc, personId, now)`, called from the tab read only when `readDocumentOpen(header)` is
true, after the read gate passed and the tab exists, inside `ctx.waitUntil`:

1. `day = utcDay(now)`. Read `document_opens (person, document)`.
2. Row with `last_open_day = day` → skip, `reason=same-day`. Stop.
3. `key = nextFrecencyKey(row?.frecency_key ?? null, now)`.
4. Upsert the row: insert `{open_days: 1, first_opened_at: now, last_opened_at: now, last_open_day: day,
frecency_key: key}`; on conflict update `open_days + 1`, `last_opened_at`, `last_open_day`, `frecency_key`
   **only where the stored `last_open_day < excluded.last_open_day`**.
5. Changes = 0 → another request recorded today first: skip, `reason=race`. Stop.
6. `recordDocumentOpened(env, liveDoc, personId, now)`: a `timeline_events` row, `event_type = 'document_opened'`,
   `source_type = 'document'`, `source_id = documentId`, `dedupe_key = dedupeKeyForDay(personId, now)`,
   title "Document Opened", description and snapshot naming the document, scopes `[user:<personId>]` only.
7. Log `open-recorded`. A thrown error anywhere logs `open-failed` and is swallowed.

Invariants: at most one counted open per person per document per UTC day; the event and the row agree on that day
(the row is written first and gates the event); an open never reaches a `document` or `team` scope.

### Frecency

With half-life `H = FRECENCY_HALF_LIFE_MS`, a document's score at time `t` is
`S(t) = sum over open days d of 2^(-(t - t_d) / H)`, where `t_d` is the day's first open. The table stores one
number per row, the **frecency key** `k`, the instant at which `S` decays to exactly 1: `S(t) = 2^((k - t) / H)`.

- First open at `t`: `k = t`.
- A later open day at `t`: `S' = 2^((k - t) / H) + 1`, `k' = t + H * log2(S')`, rounded to whole ms.
- Merging two keys at `t`: `k = t + H * log2(2^((k1 - t) / H) + 2^((k2 - t) / H))`.
- Ranking by `k` descending is ranking by `S(now)` descending for every `now`, because `S` is increasing in `k`, so
  the read needs no arithmetic and the index `(owner_id, frecency_key DESC)` answers it in order. Ties: document
  id ascending (`D77`).
- Worked check (spec): opened on each of the last ten days, `S = (1 - r^10) / (1 - r) = 8.09` with
  `r = 2^(-1/14)`, so `k = now + 14 * log2(8.09) days = now + 42 days`: it outranks a single open from yesterday
  (`k = now - 1 day`) for about six weeks.

### Reads

All three reads scope by `visible` **first**, then filter. `visible` is the union of three indexed lookups (own
documents by `owner_id`, joined teams' documents by `team_id`, `shared_with` by its primary key), each document
then checked: not trashed, and owned, or in a joined team, or shared with `shareable = 1`; a shared row whose live
code is gone (expired or revoked) is dropped. `via` is `own`, then `team`, then `shared`; `share_code` the oldest
live code at the person's role and tab scope; `scope_tab_id` the person's tab scope for `shared`, else null.

- **Jump back in** (`readJumpBackIn`): `document_opens WHERE owner_id = person` joined to `visible`, ordered by
  `frecency_key DESC, document_id ASC`, limit `HOME_JUMP_BACK_IN_MAX`.
- **Timeline** (`readHomeTimeline`): `timeline_events WHERE actor_id = person AND source_type = 'document' AND
event_type IN (document_created, document_duplicated, document_edited, document_opened) AND occurred_at <= now`,
  joined to `visible` on `source_id`, keyset `(occurred_at, id) <` cursor, ordered `occurred_at DESC, id DESC`,
  limit + 1 to learn whether a next page exists. Kinds: created ← `document_created`, `document_duplicated`;
  updated ← `document_edited`; opened ← `document_opened`. A reconstructed edit (`REAL_EDIT` false: its
  snapshot has `backfilled: true`) is left out, since only events with a real actor count. Raw entries: the one-per-day fold (spec) runs where the
  local day is known, in the view, across loaded pages.
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
`json_extract(snapshot, '$.backfilled') IS NOT 1`. Migration 0063 marks the rows backfilled before the mark
existed: `document_edited` rows whose `created_at` is more than `LEGACY_BACKFILL_SKEW_MS` (60 s) after their
`occurred_at` (a live edit is stored within milliseconds of the time it claims; `D79`).

### Seeding frecency

`seedFrecency(env, personId, now)` (`apps/api/src/home/seed-frecency.ts`), run once per person, inline on their first
`GET /api/home` (`timeline_scope_state.frecency_seeded_at` null), before the reads:

1. Read the person's real edits: `document_edited`, `actor_id = person`, `REAL_EDIT`, within
   `TIMELINE_RETENTION_MS`, on a document that still exists, newest first, at most `FRECENCY_SEED_EVENT_MAX`.
2. Group per document into UTC days (the day's time is the event's `occurred_at`); keep the
   `FRECENCY_SEED_DOCUMENT_MAX` documents with the newest edit (`D80`).
3. Read the person's `document_opens` rows for those documents. Seed days are the days strictly before the
   row's `utcDay(first_opened_at)`, or every day when there is no row.
4. Fold the seed days oldest first with `nextFrecencyKey`. No row: insert (`ON CONFLICT DO NOTHING`) with
   `open_days` = seed days, first and last from the seed days. A row: `frecency_key = mergeFrecencyKeys(row, seed,
now)`, `open_days + n`, `first_opened_at` = the earliest seed day, guarded on the `first_opened_at` and
   `frecency_key` it read (a concurrent open or seed wins; the document is counted as `conflicts`).
5. One batch; stamp `frecency_seeded_at = now`; log `home: frecency-seeded docs=<n> days=<n> conflicts=<n>
capped=<yes/no>`.

Idempotent without the stamp: after a seed, no edit day lies before `first_opened_at`, so a second run writes
nothing. A failure logs `home: frecency-seed-failed`, leaves the stamp unset (the next Home read tries again) and the
read carries on.

### Home read side effects

`GET /api/home` seeds frecency once (above), dispatches the Timeline user-scope backfill (`backfillUserScope`) when
the scope has no `backfilled_at`, off the response path, and moves the Timeline's unread mark by the Timeline's own
rule (`isNewVisit`, `apps/api/src/timeline/seen.ts`: no mark yet, or the mark older than `SEEN_WINDOW_MS`), off the response
path. The response carries `lastSeenAt`, the mark as it stood before this read (`D75`). `GET /api/home/timeline`
does none of these.

## Interfaces and contracts

### Open marker

- Header `X-Document-Open`, value `1`; any other value or absence is not an open. Allowed by CORS.
- Sent by `apiLoadTab(owner, documentId, tabId, shareCode, { open: true })`, which `seedFetchedDocument` passes for
  the editor's eager first-tab read when not embedded. The marker joins the in-flight dedupe key. Every other
  caller (lazy tab loads, room resync, duplicate, Take Offline, the Drive mirror, the MCP server) sends none (`D66`).

### `GET /api/home`

Query: `tz` (IANA name, default `UTC`, `D67`), `limit` (the Timeline's first page, default `HOME_TIMELINE_PAGE_SIZE`).
Response `200 HomeResponse`:

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
  lastOpenedAt: number;
  openDays: number;
  frecencyKey: number; // the rank, so the view can place this browser's local documents among them
};
type HomeTimelineKind = 'created' | 'updated' | 'opened';
type HomeTimelineEntry = HomeDocument & { id: string; kind: HomeTimelineKind; occurredAt: number };
type HomeTimelinePage = { items: HomeTimelineEntry[]; nextCursor: string | null };
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
  jumpBackIn: HomeJumpBackInItem[];
  timeline: HomeTimelinePage;
  whatHappened: HomeGroup[];
  lastSeenAt: number | null; // the unread mark before this read; null = never looked
};
```

### `GET /api/home/timeline`

Query: `cursor` (`<occurredAt>:<eventId>`; absent = first page), `limit`. Response `200 HomeTimelinePage`.

### Rejections

`{ error: HomeRejection }`, status 400, checked before any read; `home: rejected reason=<token>` logged.

| Token            | When                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| `tz_invalid`     | `tz` longer than 64 characters or not accepted by `Intl.DateTimeFormat` |
| `limit_invalid`  | `limit` present and not a whole number in `[1, HOME_TIMELINE_PAGE_MAX]` |
| `cursor_invalid` | `cursor` present and not `<finite number>:<non-empty id>`               |

Other answers: 400 `bad_request` without an identity (`missingAuth`); 401 from the guest-signature gate
(`home` is owner-scoped); 429 `rate_limited`; 404 for any other method or path under `/api/home`.

### Client

`apiReadHome(owner, { tz })` → `HomeResponse | null`; `apiReadHomeTimeline(owner, { cursor })` →
`HomeTimelinePage | null`. Null means "we could not ask" (any non-2xx, a thrown fetch, an unparseable body), never
an empty Home, as `apiListTimeline` does.

## Data and persistence

Migration `0063_document_opens.sql` (`D65`):

```sql
CREATE TABLE document_opens (
  owner_id        TEXT NOT NULL,   -- the person: guest id or Clerk id
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  open_days       INTEGER NOT NULL,
  first_opened_at INTEGER NOT NULL,
  last_opened_at  INTEGER NOT NULL,
  last_open_day   TEXT NOT NULL,   -- 'YYYY-MM-DD', UTC
  frecency_key    INTEGER NOT NULL,
  PRIMARY KEY (owner_id, document_id)
);
CREATE INDEX document_opens_rank_idx ON document_opens (owner_id, frecency_key DESC);
CREATE INDEX document_opens_last_idx ON document_opens (last_opened_at);
CREATE INDEX timeline_events_actor_idx ON timeline_events (actor_id, occurred_at DESC, id DESC);
ALTER TABLE timeline_scope_state ADD COLUMN frecency_seeded_at INTEGER;
UPDATE timeline_events SET snapshot = json_set(snapshot, '$.backfilled', json('true'))
 WHERE event_type = 'document_edited' AND created_at - occurred_at > 60000;
```

`frecency_seeded_at` rides the user scope-state row, which account deletion and sign-up migration already move and
delete.

| Field             | Class                                       |
| ----------------- | ------------------------------------------- |
| `owner_id`        | Identity (owner-keyed: deletion, migration) |
| `document_id`     | Reference, cascades with the document       |
| `open_days`       | Derived counter                             |
| `first_opened_at` | Fact                                        |
| `last_opened_at`  | Fact, the retention key                     |
| `last_open_day`   | Derived, the dedupe key                     |
| `frecency_key`    | Derived, the rank                           |

- **Account deletion**: `DELETE FROM document_opens WHERE owner_id = ?`. Other people's opens of the account's
  documents cascade with the documents. The `document_opened` events go with `deleteTimelineForOwner` (actor and
  user scope).
- **Sign-up migration** (`migrateDocumentOpens(from, to, now)`): `UPDATE OR IGNORE ... SET owner_id = to WHERE
owner_id = from` moves every row the account does not already hold; each leftover (opened under both) merges
  into the account's row: `open_days` summed (`D70`), `first_opened_at` min, `last_opened_at` and `last_open_day`
  max, `frecency_key = mergeFrecencyKeys(a, b, now)`; then the guest rows are deleted. The events move with
  `migrateTimelineOwner`.
- **Document purge**: rows cascade; events go with `documentsTimelineSweepStatement`. **Trash**: rows stay, the
  reads skip the document; a restore brings it back.
- **Retention**: the 03:00 UTC cron deletes rows with `last_opened_at < now - TIMELINE_RETENTION_MS` (365 days)
  through `scheduleSweep('home_opens', ...)`; the events go with the Timeline's own sweep.
- Opens are seeded once from real edit days (Seeding frecency, `D76`).
- Timeline dismissals (`timeline_event_scopes.deleted_at`) are not read: Home reads by actor, not by scope (`D71`).

## Errors and edge cases

| Case                                                 | Handling                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Tab read refused (403 / 404 / 410)                   | Nothing recorded: the gate runs first                                          |
| Marker on a resync / lazy load                       | Not sent; if a client sends it anyway, the same-day dedupe absorbs it          |
| Two first opens of the day race                      | The guarded upsert lets one through; the other logs `reason=race`, no event    |
| D1 failure while recording                           | `open-failed` logged, the tab read already answered                            |
| Opened across UTC midnight                           | Two open days, as the spec's UTC rule says                                     |
| Document trashed, team left, link revoked or expired | Dropped from all three reads by `visible`; its rows remain until purge / sweep |
| Tab-scoped shared document                           | In Jump back in and Timeline; never in What happened                           |
| Own action on someone else's document                | Not in What happened (`me`); in Timeline when it is an edit                    |
| Guest-era action of the person (aliased id)          | Excluded from What happened by `me`                                            |
| Actor without a participant row                      | `HomePerson.name` / `color` / `pictureUrl` null                                |
| Legacy `comment_added` / `action_assigned` rows      | `commented` / `assigned`                                                       |
| Future-dated event                                   | Excluded (`occurred_at <= now`)                                                |
| What happened over its cap                           | First 200 actions newest first; `what-happened-capped` logged                  |
| Cursor names a deleted event                         | Keyset still pages: the cursor is a position, not a row                        |
| `tz` with a DST change inside the window             | `Intl` resolves each instant's own offset                                      |
| A person with no opens / no history                  | Empty arrays, `nextCursor: null`                                               |
| `document_opened` in `GET /api/timeline`             | Left out by `NOT_IN_FEED`; never counted unread                                |

## Security and trust

- `home` is in `OWNER_SCOPED_SEGMENTS`: a Clerk-shaped `X-Owner-Id` is refused and, when armed, the guest signature
  is required.
- `visible` is the boundary: an event, an open or an entry about a document the person cannot open is never read.
  Team membership is matched on the resolved owner id, as Activity does; teams are Clerk-only and a Clerk-shaped
  guest header never reaches a route.
- Opens are private: the event is scoped to `user:<person>` only, left out of the feed, and not a What happened
  verb. Nobody's open is in anybody else's response.
- The marker is client-supplied and can only add opens to the caller's own data, for documents the read gate
  already admitted, at most once per document per day.
- A tab-scoped link shows nothing in What happened (the actions name things on other tabs). A shared document's
  team and folder are not disclosed (`D69`).
- Person ids on the wire are the same actor ids `GET /api/timeline` already carries to the same audience.
- `HOME_RATE_LIMITER`: 60 reads per 60 s per resolved owner (`D73`); an API token caller is also under
  `API_TOKEN_READ_RATE_LIMITER`. Absent binding → allow (self-host).

## Performance and limits

Let `L` be the person's library (own + joined-team + shared documents).

| Path                  | Cost                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Tab read, marked      | Response path: nothing. `waitUntil`: 1 point read; on a new day 1 upsert + the emit (3 statements)    |
| Tab read, unmarked    | Nothing                                                                                               |
| Jump back in          | `L` (visible) + an in-order walk of `document_opens_rank_idx`, stopping at 12 matches                 |
| Timeline page         | `L` + an in-order walk of `timeline_events_actor_idx` over the person's events, stopping at limit + 1 |
| What happened         | `L` + every document-scope row of `L` within retention (worst case `L = 2,000`, 20 events each: 40k)  |
| `document_opens` size | One row per person per document opened in the last 365 days, ~150 B; 2,000 documents ≈ 300 KB         |
| Response              | Worst 12 + 30 entries at ~0.4 KB, 200 actions at ~0.3 KB: ~80 KB; typical under 20 KB                 |

The What happened scan is the one that grows with a team's history. The measured remedy, if it bites, is an
`added_at` range on the document-scope membership, not a cleverer query (as [Timeline](../timeline.md) §3.2 says of
its own read).

## Web Experience

`GET /api/home` answers the whole first screen in one request, so the view needs no waterfall for LCP; Show more
uses `GET /api/home/timeline` and never re-reads the rest. Thumbnails stay on their own lazy route.

## Observability

| Fingerprint                                                             | Where         |
| ----------------------------------------------------------------------- | ------------- |
| `home: open-recorded doc=<id> days=<n>`                                 | api, info     |
| `home: open-skipped reason=<same-day/race> doc=<id>`                    | api, info     |
| `home: open-failed doc=<id>` + error                                    | api, error    |
| `home: read jump=<n> timeline=<n> groups=<n> actions=<n>`               | api, info     |
| `home: timeline-page items=<n> more=<yes/no>`                           | api, info     |
| `home: what-happened-capped max=<n>`                                    | api, warn     |
| `home: rejected reason=<token>`                                         | api, warn     |
| `home: rate-limited`                                                    | api, warn     |
| `home: backfill-dispatched`                                             | api, info     |
| `home: backfill-failed` + error                                         | api, error    |
| `home: frecency-seeded docs=<n> days=<n> conflicts=<n> capped=<yes/no>` | api, info     |
| `home: frecency-seed-failed` + error                                    | api, error    |
| `home: seen-marked`                                                     | api, info     |
| `home: seen-mark-failed` + error                                        | api, error    |
| `home: opens-migrated moved=<n> merged=<n>`                             | api, info     |
| `home_opens sweep: deleted <n> rows older than <cutoff>`                | api cron, log |
| `[home] read failed status=<n/thrown/unparseable>`                      | editor, warn  |

## Testing

| Rule                                                                                                | Test                                                                                      |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rejection tokens, the marker reader                                                                 | `packages/api-schema/src/home.test.ts`                                                    |
| Frecency: first open, increment, ranking, merge, decay                                              | `packages/api-schema/src/frecency.test.ts`                                                |
| Time zone parse and local day                                                                       | `apps/api/src/home/local-day.test.ts`                                                     |
| Verbs, grouping, summary, order, counts                                                             | `apps/api/src/home/what-happened.test.ts`                                                 |
| Record, same-day skip, next day, race, private scope, failure log                                   | `apps/api/src/home/record-open.test.ts` (real SQLite)                                     |
| The tab read records a marked open only, never an unmarked or refused one                           | `apps/api/src/routes/document-open-marker.test.ts` (real SQLite)                          |
| Reads: ranking, access, kinds, cursor, others only, opens private, rejections, rate limit, backfill | `apps/api/src/routes/home.test.ts` (real SQLite)                                          |
| Seed: real edit days only, days before the first open, re-run writes nothing, document cap, stamp   | `apps/api/src/home/seed-frecency.test.ts` (real SQLite)                                   |
| The backfill marks its edit, never marks a real one; migration 0063 marks legacy rows               | `apps/api/src/home/real-edits.test.ts` (real SQLite)                                      |
| Home seeds once, leaves reconstructed edits out, moves the unread mark once per visit               | `apps/api/src/routes/home.test.ts` (real SQLite)                                          |
| The feed and the unread count leave opens out                                                       | `apps/api/src/db/timeline-opens.test.ts` (real SQLite)                                    |
| Migration merge and account deletion                                                                | `apps/api/src/db/document-opens.test.ts`, `account-owner-columns.test.ts`                 |
| Reply flag on both comment paths, `assigneeId` on assignment                                        | `apps/api/src/timeline/tab-diff.test.ts`, `apps/api/src/routes/home-snapshots.test.ts`    |
| CORS allows the marker                                                                              | `apps/api/src/responses.test.ts`                                                          |
| Activity unchanged on the shared visibility                                                         | `apps/api/src/db/activity-mentions.test.ts`, `apps/api/src/db/trash-surfaces.test.ts`     |
| OpenAPI parity and schemas                                                                          | `apps/api/src/openapi/*.test.ts`                                                          |
| Route labels know `home` and `home/timeline`                                                        | `apps/api/src/route-resources.test.ts`, `packages/api-schema/src/error-telemetry.test.ts` |
| Client wrappers: null on failure, the marker header and its dedupe key                              | `apps/live/lib/api/home.test.ts`, `apps/live/lib/api-client.test.ts`                      |
| The seed marks the first-tab read unless embedded                                                   | `apps/live/app/document/[id]/seed-fetched-document.test.ts`                               |

## Constants and configuration

| Constant                        | Value     | Where                                         | Provenance                                     | Safe range     |
| ------------------------------- | --------- | --------------------------------------------- | ---------------------------------------------- | -------------- |
| `FRECENCY_HALF_LIFE_MS`         | 14 days   | `packages/api-schema/src/frecency.ts`         | Spec; a fortnight, the common iteration length | 7 to 30 days   |
| `HOME_JUMP_BACK_IN_MAX`         | 12        | `packages/api-schema/src/home.ts`             | Spec                                           | 6 to 24        |
| `HOME_TIMELINE_PAGE_SIZE`       | 30        | same                                          | Spec ("30 entries at a time")                  | 10 to 50       |
| `HOME_TIMELINE_PAGE_MAX`        | 100       | same                                          | `D72`; bounds one read's walk                  | 30 to 200      |
| `HOME_WHAT_HAPPENED_DAYS`       | 14        | same                                          | Spec                                           | 7 to 30        |
| `HOME_WHAT_HAPPENED_ACTION_MAX` | 200       | same                                          | `D68`; the Timeline's page ceiling             | 100 to 500     |
| `HOME_TZ_MAX_LENGTH`            | 64        | same                                          | Longest IANA name is 32; double for headroom   | 32 to 128      |
| `TIMELINE_RETENTION_MS`         | 365 days  | `packages/api-schema/src/timeline.ts`         | Spec (the Timeline's retention), reused        | fixed          |
| `FRECENCY_SEED_EVENT_MAX`       | 2,000     | `apps/api/src/home/seed-frecency.ts`          | `D80`; one person's recent edit days           | 500 to 5,000   |
| `FRECENCY_SEED_DOCUMENT_MAX`    | 200       | same                                          | `D80`; the Timeline backfill's document cap    | 50 to 500      |
| `LEGACY_BACKFILL_SKEW_MS`       | 60 s      | `apps/api/migrations/0063_document_opens.sql` | `D79`                                          | 10 s to 10 min |
| `SEEN_WINDOW_MS`                | 60 s      | `apps/api/src/timeline/seen.ts`               | [Timeline](../timeline.md) §2.5, reused        | fixed          |
| `HOME_RATE_LIMITER`             | 60 / 60 s | `apps/api/wrangler.toml`, namespace `1008`    | `D73`                                          | 30 to 120      |

No environment variable. The rate limiter binding is optional; absent means allow.

## Defaults ledger

D65 to D80 in [DEFAULTS.md](DEFAULTS.md).
