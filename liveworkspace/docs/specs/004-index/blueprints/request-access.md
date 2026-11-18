# Request Access: blueprint

Derived from [request-access.md](../request-access.md). The spec decides; this file only adds engineering precision.
Defaults are cited as `IDXn`. Paths are relative to the repository root.

## Build order

Work Tracker 1137 lands in three parts, each leaving main working; nothing a person can press exists until part 3.

| Part | Brings                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | This spec and blueprint; migration `0022_access_requests.sql`; the index's three routes, the Inbox's `accessRequests`, closing an account; `@liveworkspace/index-client`'s types, limits, client calls and notice parser; `@liveworkspace/index-app`'s notice door (202, handlers optional) |
| 2    | The managers' side: the Explorer's Inbox row, reading pane and verbs (Share, its level menu, Decline) and badge count; each app's `accessRequested` and `accessGranted` handlers and their two emails                                                                                       |
| 3    | The requester's side: Request Access (with its note, and Requested after) on the live embed's no-access card and on each app's Not Found screen; live-embeds.md's no-access row                                                                                                             |

Scope, by file:

| File                                                           | Role                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/migrations/0022_access_requests.sql` | `access_requests`, `access_request_tries` and their indexes                                                   |
| `liveworkspace/apps/index/src/access-requests.ts`              | `handleAccessRequests`: ask (`POST /items/:id/access-requests`), grant, decline; `recordRequest` off the path |
| `liveworkspace/apps/index/src/inbox.ts`                        | the fourth Inbox statement, `accessRequests`                                                                  |
| `liveworkspace/apps/index/src/account-purge.ts`                | a closed account's requests and tries deleted                                                                 |
| `liveworkspace/apps/index/src/index.ts`                        | routes `items/:id/access-requests…`; labels `access-requests`, `grant` (already), `decline`                   |
| `packages/index-client/src/access-requests.ts`                 | limits, `InboxAccessRequest`, `AccessNotice`, `parseAccessNotice`                                             |
| `packages/index-client/src/client.ts`                          | `requestAccess`, `grantAccessRequest`, `declineAccessRequest`                                                 |
| `packages/index-client/src/types.ts`                           | `InboxResponse.accessRequests`                                                                                |
| `packages/index-app/src/internal.ts`, `internal-contract.ts`   | the two notices to `accessRequested` / `accessGranted` (202 and nothing without one)                          |

## Domain and naming

| Term           | Identifier                                                                    |
| -------------- | ----------------------------------------------------------------------------- |
| access request | a row of `access_requests`; `InboxAccessRequest` in the Inbox                 |
| state          | `access_requests.state`: `open`, `granted`, `declined` (`AccessRequestState`) |
| a try          | a row of `access_request_tries`: one ask, whatever the id                     |
| the notices    | `AccessNotice`: `access_requested`, `access_granted`                          |

## Behaviour and state

Asking (`POST /items/:id/access-requests`), on the response's path, the same work for every id:

1. The caller: a person, an account, not `app`, `drive` or `export` (else `403 access_requests_need_a_person`); the id
   `isId` and the body's `note` text within `ACCESS_REQUEST_NOTE_MAX` (else `400 invalid_body`).
2. `SELECT COUNT(*) FROM access_request_tries WHERE person_id = ? AND at > now - 1 day` (the person's index range);
   at `ACCESS_REQUESTS_PER_PERSON_DAY` or more, `429 rate_limited` with `Retry-After` (`ACCESS_REQUEST_RETRY_AFTER_S`,
   one hour).
3. One batch: `INSERT` the try; `DELETE` the person's tries older than a day (their index range).
4. `waitUntil(recordRequest(…))`, then `202 {requested: true}`.

`recordRequest`, off the path (any failure logged as `[access-requests] record failed` and dropped):

1. `getItemRow`; stop when there is none, or it is trashed or archived.
2. `accessTo(env, row, {person})` with no share code: stop when it answers access (owner, team as accounts says now,
   or a live link in their Shared with me).
3. The requester's name from accounts (`accountsPeopleNames`, null when it can't say).
4. One batch:
   - the upsert, keyed `(requester_id, item_id)`:
     `INSERT … VALUES (…, 'open', now) ON CONFLICT DO UPDATE SET state = 'open', note, requester_name, asked_at = now,
closed_at = NULL, share_code = NULL WHERE access_requests.state <> 'open' AND access_requests.asked_at <= now -
ACCESS_REQUEST_REPEAT_MS`;
   - the item's emails of the last day: `SELECT COUNT(*) FROM access_requests WHERE item_id = ? AND emailed_at > now -
1 day`.
5. When the upsert changed a row (`meta.changes === 1`): read its id; when the item's count is under
   `ACCESS_REQUEST_EMAILS_PER_ITEM_DAY`, work out the recipients (the personal item's owner; a team item's
   `owner_id` when `accountsPersonTeams` says they are still in its team), and when there is one, set `emailed_at =
now` and `tellApp` the `access_requested` notice.

Granting (`POST /items/:id/access-requests/:requestId/grant`), a manager (`loadItem(…, 'edit', {manage: true})`, the
whole item): refused archived (`409 archived`) or trashed (`404`); `level` checked as a new link's
(`invalid_level`, `level_not_offered`), defaulting to `view` where `linkLevelOffered(app, 'view')`, else
`APP_DEFAULT_LINK_LEVEL[app]`. The open request read by `(id, item_id, state = 'open')` (else `404
access_request_not_found`). Then one batch, every statement guarded so a lost race changes nothing:

1. `INSERT INTO share_links … SELECT … WHERE (link count) < SHARE_LINKS_PER_ITEM AND EXISTS (the request open)`;
2. `UPDATE access_requests SET state = 'granted', closed_at = now, share_code = ? WHERE id = ? AND state = 'open' AND
EXISTS (the link)`;
3. `INSERT INTO shared_with … SELECT … WHERE EXISTS (the link) ON CONFLICT (person_id, item_id) DO UPDATE SET
share_code, last_seen`;
4. the `shared` event (`level`), `when` the link exists.

When the insert changed nothing: the request still open means the cap (`409 share_link_limit`), else `404
access_request_not_found` (another manager answered first). Then `tellApp` `access_granted`, and `200 {link}`.

Declining: the same caller and item checks, then `UPDATE … SET state = 'declined', closed_at = now WHERE id = ? AND
item_id = ? AND state = 'open'`; no change is `404 access_request_not_found`; else `204`.

## Interfaces and contracts

| Route                                                | Need                                  | Body       | Answers                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `POST /items/:id/access-requests`                    | an account in person                  | `{note?}`  | 202 `{requested: true}`; 400 `invalid_body`; 403 `access_requests_need_a_person`; 429 `rate_limited`                       |
| `POST /items/:id/access-requests/:requestId/grant`   | a manager of the item (owner or team) | `{level?}` | 200 `{link}`; 400 `invalid_level`, `level_not_offered`; 404 `access_request_not_found`; 409 `archived`, `share_link_limit` |
| `POST /items/:id/access-requests/:requestId/decline` | the same                              | none       | 204; 404 `access_request_not_found`; 409 `archived`                                                                        |

Every route: 401 without a person; 403 `access_requests_need_a_person` for an app acting for a person, the Drive
mirror or the export; any other method or path below `access-requests` 404.

`GET /inbox` answers `accessRequests: InboxAccessRequest[]` beside the rest:

```ts
type InboxAccessRequest = {
  id: string;
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  requesterId: string;
  requesterName: string | null;
  note: string | null;
  askedAt: number;
};
```

The notices (`AccessNotice`, `parseAccessNotice`):

```ts
type AccessNotice =
  | { type: 'access_requested'; requestId; requesterId; requesterName: string | null; recipientIds: string[] (1..10);
      itemTitle; note: string | null }
  | { type: 'access_granted'; requestId; requesterId; granterId; granterName: string | null; level: Level; itemTitle };
```

`@liveworkspace/index-app`'s notices door takes either (202), and hands it to the app's `accessRequested` or
`accessGranted` handler when it has one, off the response's path.

## Data and persistence

```sql
CREATE TABLE access_requests (
  id             TEXT    PRIMARY KEY,
  item_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  requester_id   TEXT    NOT NULL,
  requester_name TEXT    NULL,
  note           TEXT    NULL,
  state          TEXT    NOT NULL CHECK (state IN ('open', 'granted', 'declined')),
  asked_at       INTEGER NOT NULL,
  emailed_at     INTEGER NULL,
  closed_at      INTEGER NULL,
  share_code     TEXT    NULL
);
CREATE UNIQUE INDEX access_requests_person_item ON access_requests (requester_id, item_id);
CREATE INDEX access_requests_item ON access_requests (item_id, state, asked_at DESC);
CREATE INDEX access_requests_item_emailed ON access_requests (item_id, emailed_at) WHERE emailed_at IS NOT NULL;
CREATE TABLE access_request_tries (
  person_id TEXT    NOT NULL,
  at        INTEGER NOT NULL
);
CREATE INDEX access_request_tries_person ON access_request_tries (person_id, at);
```

- A purged item takes its requests (cascade). `share_code` is no key: a deleted link leaves the granted row as it was.
- Tries keep at most a day per person: each ask deletes its asker's older ones in its batch.
- Closing an account: `DELETE` its rows of both tables by `requester_id` / `person_id`, in the purge's chunks (`IDX53`).
- `items` gains a child: a future rebuild of `items` carries `access_requests` with the other children
  ([items.md "Rebuilding items"](items.md#rebuilding-items)).

## Errors and edge cases

- A requester who meanwhile reaches the item through a live link is left out of the Inbox by the read
  (`NOT EXISTS` over their `shared_with` row and its live link); a team member's request is not, and the grant still
  works (their own access stands either way).
- Asking again while open changes nothing: the first note and time stand (the upsert's `WHERE`).
- A request on an item that moves into a team stays: the team's members see it from then on.
- The item's emails are counted by `emailed_at`, so a reopened request's email counts once for that day.

## Security and trust

- The ask's answer and its time are the same for every id: the item is read only after the answer, in `waitUntil`.
  The person's limit counts tries, not requests, so it says nothing about which ids were real.
- The note is the requester's text, shown to the managers only, escaped by every renderer.
- A grant makes an ordinary share link; the requester reaches the item through it like any visitor and loses it when
  it is deleted. A manager decides the level; the requester can't ask for one.
- The access_granted notice names the item to the requester: by then they reach it.

## Performance and limits

- Ask: one indexed count and one two-statement batch on the response's path; off it, one item read, the access check
  (one link read, accounts only for a team the token doesn't hold), one names call, one two-statement batch, and for
  a team item one teams call.
- Inbox: one more statement in the existing batch, from the person's scopes through `items_live` to
  `access_requests_item`; measured in `inbox.test.ts`'s scale test.
- Grant: one read and one four-statement batch.

## Observability

- `[access-requests] record failed` when the off-path record throws.
- `[index] notice not delivered` (`tellApp`) when the app does not take a notice.
- Route labels `…Items.AccessRequests`, `…Grant`, `…Decline`.

## Testing

- `liveworkspace/apps/index/src/access-requests.test.ts`: the same answer for every id; who may ask; the person's
  limit; the repeat window; the item's email limit; recipients for a personal and a team item; grant (link, Shared
  with me, the requester opens it, `shared` event, notice), the level rules, the race, the cap; decline; who may grant
  and decline; the Inbox rows and their reach; closing an account.
- `packages/index-client/src/access-requests.test.ts`: the notice parser.
- `packages/index-app/src/internal.test.ts`: the two notices to their handlers, and 202 without one.

## Constants and configuration

| Constant                             | Value  | Where                                          | Why                                                 |
| ------------------------------------ | ------ | ---------------------------------------------- | --------------------------------------------------- |
| `ACCESS_REQUESTS_PER_PERSON_DAY`     | 20     | `packages/index-client/src/access-requests.ts` | bounds probing and spam from one account            |
| `ACCESS_REQUEST_REPEAT_MS`           | 7 days | same                                           | one email per requester and item a week             |
| `ACCESS_REQUEST_EMAILS_PER_ITEM_DAY` | 10     | same                                           | bounds one item's managers' email, however many ask |
| `ACCESS_REQUEST_NOTE_MAX`            | 300    | same                                           | a line or two of why                                |
| `ACCESS_REQUEST_RECIPIENTS_MAX`      | 10     | same                                           | the notice's parser bound                           |
| `ACCESS_REQUEST_RETRY_AFTER_S`       | 3600   | `liveworkspace/apps/index/src/config.ts`       | the person's limit eases as their oldest try passes |

## Defaults ledger

`IDX53`: a closed account's access requests and tries are deleted, not anonymised: a request from no one asks nothing.
`IDX54`: a grant defaults to `view` (or the app's default where it offers no Viewer); the requester's ask names no level.
`IDX55`: a team item's request email goes to the person who made it while they are in the team; the team sees it in the
Inbox.
