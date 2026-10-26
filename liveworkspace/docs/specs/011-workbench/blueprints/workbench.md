# Workbenches: blueprint

Derived from [workbench.md](../workbench.md). The spec decides; this file only adds engineering precision, read from
the code. Defaults are cited as `WBn`. Paths are relative to the repository root.

Scope, by file:

| File                                                          | Role                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `liveworkspace/apps/accounts/src/workbench/routes.ts`         | `/api/account/workbench/*`: tickets, sessions, pairing requests, pairings                  |
| `liveworkspace/apps/accounts/src/workbench/store.ts`          | `WorkbenchCore`: one person's SQLite tables, secrets, the alarm, ending access, allowances |
| `liveworkspace/apps/accounts/src/workbench/durable-object.ts` | `WorkbenchStore`, the Durable Object over `WorkbenchCore` (binding `WORKBENCH`)            |
| `liveworkspace/apps/accounts/src/workbench/internal.ts`       | The apps' servers' doors: `workbench/session`, `workbench/rooms`, `allowance`              |
| `liveworkspace/apps/accounts/src/workbench/index-access.ts`   | The owner's access to an item or folder, asked of the index; `closeRooms`                  |
| `liveworkspace/apps/accounts/src/workbench/revoke.ts`         | A revoked token's pairings end; a closed account's store goes                              |
| `liveworkspace/apps/accounts/src/workbench/apps.ts`           | Each app's dialect: its item word, `<word>Id`, its base address                            |
| `packages/workbench`                                          | The frame's side in each app (bindings, hooks, components)                                 |

## Domain and naming

| Term            | Identifier                                                                                                            | Meaning                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Store           | `WorkbenchStore`, `idFromName(<person id>)`                                                                           | One per person; every app's rows, each naming its app                    |
| Pairing request | `wb_pairing_requests`, code 16 random bytes base64url (22)                                                            | A token asking to pair, for 10 minutes                                   |
| Pairing         | `wb_pairings`, a UUID; unique `(app, token_id, origin)`                                                               | A token allowed to open a workbench on one origin, for a scope           |
| Ticket          | `<16 bytes base64url>.<store id, 64 hex>`                                                                             | Single use, 60 s, one app                                                |
| Session         | `lvw_<32 bytes base64url>.<store id>`                                                                                 | What the frame presents; at most 8 hours and never past its token        |
| Scope           | `item` (on the wire the app's word: `document` for livediagram and livedocuments, `project`, `design`) or `workspace` | One item, or the Explorer from an optional folder                        |
| Level           | `view` < `participate` < `edit`                                                                                       | The lowest of the pairing's grant, the owner's access now, and read-only |
| Allowance       | `wb_quota` rows of kind `<app>:<kind>`                                                                                | A per-person cap across items, such as notification emails               |

The suffix after the dot routes a secret to its store; it is no credential, since the store keeps only each secret's
SHA-256 and a forged suffix reaches a store that knows nothing of it. A store that was never written answers every
read as empty without creating itself.

## Behaviour and state

Every route is on liveworkspace.app at `/api/account/workbench/<rest>`, and on each app's address at
`/api/workbench/<rest>`, which its router forwards with the app's name. Without the `WORKBENCH` binding every route is
`503 workbench_unavailable`; a wrong method is `405 method_not_allowed`. Answers carry `cache-control: no-store`.

### The routes

| Route                                                           | Who                  | Effect                                                                                                                                                                                           |
| --------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST tickets { scope?, <word>Id?, tabId?, folderId?, origin }` | an API token         | `201 { url, <word>Id \| scope: 'workspace', folderId, expiresAt }`, or `428 pairing_required { pairingUrl, expiresAt }`                                                                          |
| `POST sessions { ticket }`                                      | the ticket           | `201 { session, scope, <word>Id, folderId, tabId, origin, person: { id, name, color } }`; `401 invalid_ticket { reason: unknown \| used \| expired }`; an `lvw_` bearer `403 workbench_confined` |
| `DELETE sessions/current`                                       | the session (bearer) | `204`; `403 not_a_workbench_session`; `401 invalid_session`                                                                                                                                      |
| `POST pairing-requests { scope?, origin, name? }`               | an API token         | `{ status: 'paired', pairing }` or `{ status: 'pending', code, pairingUrl, expiresAt, interval: 5 }`                                                                                             |
| `GET pairing-requests/:code/status`                             | the token that asked | `{ status: pending \| approved \| declined \| expired, interval: 5 }`; another token `404`                                                                                                       |
| `GET pairing-requests/:code`                                    | the owner, signed in | `{ request: { origin, name, tokenName, scope, expiresAt, status, app } }`; another app's `404`                                                                                                   |
| `POST pairing-requests/:code/approve\|decline`                  | the owner, signed in | `{ pairing }` or `204`; `409 pairing_answered`; `410 pairing_expired`; `404`                                                                                                                     |
| `GET pairings`                                                  | the owner, signed in | this app's pairings (every app's on liveworkspace.app), of live tokens only, newest first                                                                                                        |
| `DELETE pairings/:id`                                           | the owner, signed in | `204`; its sessions go and their rooms close; another app's `404`                                                                                                                                |

"An API token" is a `lwt_` or `lvd_` bearer looked up in accounts' own `api_token` (`403 token_required` otherwise).
"Signed in" is liveworkspace.app's session cookie (same-origin writes only) or an account's access token for one of
the apps; never an API token, a workbench session or a guest (`401 sign_in_required`). A pairing code is checked
against its pattern before any read (`404`). Ids are 1 to 64 characters (`400 bad_request`); a value of the wrong kind
is `400 invalid_value { message }`; no app named is `400 invalid_value 'name the app'`.

`origin` must be exactly `scheme://host[:port]`, at most 255 characters, `https` anywhere or `http` on `localhost`,
`127.0.0.1` or `[::1]` only (`400 invalid_origin`). `name` is trimmed to 1 to 40 characters, shown and never enforced.

### Minting a ticket (in order)

1. The token (`403 token_required`), then `WORKBENCH_LIMITER` keyed `workbench-ticket:<token id>`, shared with pairing
   requests (`429 rate_limited`). Refusals log `[workbench] mint-refused { reason, scope, tokenId }`.
2. The body: the app, the scope (absent is the item scope); a workspace ticket names no item or tab, an item ticket
   no folder.
3. The origin.
4. The pairing for `(app, token, origin)`; none, or an item pairing asked for the workspace (a workspace pairing
   covers the item scope, never the reverse): the live pairing request for that `(app, token, origin, scope)` is
   reused or a new one opened, logged `pairing-requested { via: 'mint', reused }`, answered `428`.
5. Access, asked of the index as the owner, never by a share code: a workspace ticket with a folder needs the folder
   to be the owner's or a joined team's (`404`; `503 index_unavailable`); an item ticket takes the owner's level now
   (`404 not_found`, `410 <word>_trashed`, `503 index_unavailable`). The level is capped at `view` for a read-only
   token.
6. `mintTicket` stores the hash, 60 s; the pairing gone between the reads is `409 pairing_changed`.
7. Logged `ticket-minted`; the URL is `<app base>/embed/workbench?d=<id>#ticket=<ticket>` or
   `<app base>/embed/workbench/explorer[/folder/<id>]#ticket=<ticket>` (the ticket in the fragment, never sent to a
   server by the browser).

### Redeeming a ticket

`consumeTicket` marks it used only on the app it was minted for (another app's address sees it as unknown and leaves
it unspent). Then the token must still be live (`401 unknown`), an item ticket re-asks the owner's access now and
takes the lower level (refusal logged `session-refused { reason: 'access' }`), read-only caps it at `view`, and
`openSession` writes the session while its pairing stands, expiring at the earlier of 8 hours and the token's expiry.
The answer carries the person's name and colour from their profile. Logged `session-opened { sessionPrefix }` (the
id's first 8 characters, never the secret).

### Pairing

- `openPairingRequest`: an expired pending request for the same four values is deleted, then the live one reused
  (taking a given name) or a new one inserted, 10 minutes; the partial unique index `wb_pairing_requests_live` keeps
  one.
- `answerPairingRequest`: once. Approving a workspace request on an origin paired for items widens that pairing in
  place (same id, its name kept unless the request names one); an item approval never narrows a workspace pairing.
  Logged `paired` or `pairing-declined`.
- `listPairings`: every pairing is checked against live tokens in one read; one whose token no longer works is ended
  as it is found (`endAccess({ tokenId }, 'revoked')`, logged on failure).

### The apps' servers' doors (client credentials, each for its own app)

| Route                                          | Body                                        | Answer                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/account/internal/workbench/session` | `{ session }`                               | `{ sessionId, ownerId, tokenId, pairingId, scope, itemId, folderId, tabId, origin, level, expiresAt, teams }`, or `404 invalid_session { reason: unknown \| revoked \| expired }`; another app's session is unknown |
| `POST /api/account/internal/workbench/rooms`   | `{ ownerId, sessionId, itemId }`            | `204` when noted on a live workspace session of this app; `404`; `400 invalid_owner`, `400 invalid_value`                                                                                                           |
| `POST /api/account/internal/allowance`         | `{ personId, kind, max, windowMs, count? }` | `{ taken }`; `400 invalid_person`, `invalid_kind` (`^[a-z][a-z0-9-]{0,39}$`), `invalid_allowance` (max 1 to 1,000, window up to 7 days), `invalid_count`                                                            |

`403 client_has_no_app` for a client with no app; `503 workbench_unavailable`. A session check reads the store's row,
then the token and the teams in parallel: the level is `view` for a read-only token, the expiry the earlier of the
session's and the token's. A workspace session notes at most 500 rooms.

`takeQuota`: drops this kind's uses older than the window, then inserts as many of `count` as fit under `max`, each
row with `until = at + windowMs`, and answers how many.

### Ending access

| Trigger                                                                      | Steps                                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Unpair (`DELETE pairings/:id`)                                               | `endAccess({ pairingId }, 'unpaired')`: the rooms its sessions had open are read, the pairing deleted (tickets, sessions and rooms cascade) |
| A token revoked (`DELETE /api/account/tokens/:id`, `internal/tokens/revoke`) | `endTokenWorkbench`: `endAccess({ tokenId }, 'revoked')` also deletes the token's pairing requests; never fails the revoke                  |
| A token found dead while listing                                             | as revoked                                                                                                                                  |
| An account closed                                                            | `closeAccountWorkbench`: `close()` ends every pairing, answers the rooms, and `deleteAll()` drops the store                                 |
| A session ending itself                                                      | `endSession`: the row only                                                                                                                  |

The delete is the change: every later check of a removed session already fails. The rooms then close through the
index (`POST <INDEX_URL>/internal/workbench-close` over the `INDEX` binding), which holds each app's key and calls the
app ([index.md](../../004-index/blueprints/index.md)); best effort, after the response where it can be, failures logged
`[workbench] room close failed`.

### The alarm

`#schedule` sets the alarm for the earliest of the next ticket or request expiry, session expiry plus 24 hours, and
allowance `until`, or clears it when nothing will lapse (pairings never lapse). `alarm()` deletes tickets and requests
past expiry, sessions past their grace, allowance rows past `until`; a store left with nothing deletes itself
(`deleteAll`), any other re-arms. The grace keeps an expired session's refusal reading `expired` rather than
`unknown`.

## Data and persistence

The store's SQLite, made on its first write (`CREATE TABLE IF NOT EXISTS`, with `wb_meta('person')` naming the owner):

| Table                 | Key                                    | Indexes                                                                                                                                | Written by                       | Read by                            |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------- |
| `wb_pairing_requests` | `code`                                 | `wb_pairing_requests_live` UNIQUE `(app, token_id, origin, scope) WHERE status = 'pending'`; `wb_pairing_requests_expiry (expires_at)` | open, answer, token end, alarm   | read, poll, alarm                  |
| `wb_pairings`         | `id`; UNIQUE `(app, token_id, origin)` | `wb_pairings_token (token_id)`                                                                                                         | approve, widen, end              | mint, list, unpair, session open   |
| `wb_tickets`          | `ticket_hash`                          | `wb_tickets_expiry`, `wb_tickets_pairing`; cascades from `wb_pairings`                                                                 | mint, consume (`used_at`), alarm | consume                            |
| `wb_sessions`         | `id`; `secret_hash` UNIQUE             | `wb_sessions_pairing`, `wb_sessions_expiry`; cascades from `wb_pairings`                                                               | redeem, end, alarm               | every session check                |
| `wb_session_rooms`    | `(session_id, item_id)`                | cascades from `wb_sessions`                                                                                                            | `workbench/rooms`                | ending access                      |
| `wb_quota`            | (rowid)                                | `wb_quota_kind (kind, at)`, `wb_quota_until (until)`                                                                                   | `takeQuota`, alarm               | `takeQuota`, the alarm's next time |
| `wb_meta`             | `key`                                  |                                                                                                                                        | first write                      | the owner                          |

`scope` is CHECKed `item` or `workspace`, `status` `pending`, `approved` or `declined`; tickets and sessions CHECK that
a workspace row has no item and an item row no folder. `role` holds the level. The Durable Object is declared in
`liveworkspace/apps/accounts/wrangler.toml` (`new_sqlite_classes` migration `v1`).

## Errors and edge cases

| Case                                           | Answer                                              |
| ---------------------------------------------- | --------------------------------------------------- |
| A ticket presented on another app's address    | `401 invalid_ticket unknown`; still spendable there |
| A ticket used twice                            | `401 invalid_ticket used`                           |
| Unpaired between the pairing read and the mint | `409 pairing_changed`                               |
| The index down                                 | `503 index_unavailable`, never a guess              |
| The item trashed                               | `410 <word>_trashed`                                |
| A forged store suffix                          | unknown; no store is created                        |
| The room close failing                         | logged; the sessions already fail every check       |

## Security and trust

- Tickets and sessions are stored only as SHA-256; plaintext is returned once.
- A ticket travels in the URL fragment; a session is a bearer the frame holds in memory.
- Access is always the owner's own, re-checked at mint, at redemption, and by each app on each request through
  `workbench/session` (with teams now); a share code never grants a workbench.
- A workbench session can't mint tickets or open pairings (`workbench_confined`); pairings are answered only by the
  signed-in owner.
- Mints and pairing requests share `WORKBENCH_LIMITER` per token.

## Performance and limits

One Durable Object per person, so no shared hot row. A session check is one indexed read in the store plus two D1
reads in parallel. The alarm runs only while something will lapse, and an empty store deletes itself, so an idle
person costs nothing. Figures are in [workbench.md "Performance"](../workbench.md#performance).

## Observability

`[workbench]` logs: `mint-refused`, `pairing-requested`, `ticket-minted`, `session-refused`, `session-opened`,
`session-ended`, `paired`, `pairing-declined`, `index access failed`, `folder lookup failed`, `room close failed`,
`dead token cleanup failed`, and the two `ending … failed` errors in `revoke.ts`. Sessions are logged by
`sessionPrefix` only.

## Testing

| Test                                                               | Pins                                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/workbench/workbench.test.ts` (22) | pairing; tickets and sessions; an app's server checking a session; ending access; the allowance; a store at rest; round trips |
| `packages/workbench/src/bindings.test.ts`                          | the frame's bindings                                                                                                          |

## Constants and configuration

| Constant                         | Value                                     | File                       |
| -------------------------------- | ----------------------------------------- | -------------------------- |
| `WORKBENCH_TICKET_TTL_MS`        | 60 s                                      | `routes.ts`                |
| `WORKBENCH_SESSION_TTL_MS`       | 8 h                                       | `routes.ts`                |
| `WORKBENCH_TICKETS_PER_MINUTE`   | 30 (the limiter's own figure)             | `routes.ts`                |
| `WORKBENCH_NAME_MAX_LENGTH`      | 40                                        | `routes.ts`                |
| `WORKBENCH_ORIGIN_MAX_LENGTH`    | 255                                       | `routes.ts`                |
| `WORKBENCH_POLL_INTERVAL_S`      | 5                                         | `routes.ts`                |
| `ID_MAX`                         | 64                                        | `routes.ts`, `internal.ts` |
| `WORKBENCH_SESSION_PREFIX`       | `'lvw_'`                                  | `store.ts`                 |
| `WORKBENCH_TICKET_BYTES`         | 16                                        | `store.ts`                 |
| `WORKBENCH_PAIRING_CODE_BYTES`   | 16                                        | `store.ts`                 |
| `WORKBENCH_SESSION_SECRET_BYTES` | 32                                        | `store.ts`                 |
| `WORKBENCH_PAIRING_TTL_MS`       | 10 min                                    | `store.ts`                 |
| `WORKBENCH_SESSION_GRACE_MS`     | 24 h                                      | `store.ts`                 |
| `WORKBENCH_QUOTA_MAX`            | 1,000                                     | `store.ts`                 |
| `WORKBENCH_SESSION_ROOMS_MAX`    | 500                                       | `store.ts`                 |
| `WORKBENCH_TICKET_PATTERN`       | `/^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/`     | `store.ts`                 |
| `WORKBENCH_SESSION_PATTERN`      | `/^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/` | `store.ts`                 |
| `WORKBENCH_CODE_PATTERN`         | `/^[A-Za-z0-9_-]{22}$/`                   | `store.ts`                 |
| `KIND`                           | `/^[a-z][a-z0-9-]{0,39}$/`                | `internal.ts`              |

Config: `WORKBENCH` (Durable Object `WorkbenchStore`), `WORKBENCH_LIMITER` namespace `1103` (staging `2103`), 30 per
60 s; `INDEX` and `INDEX_URL` for access and room closes.

## Defaults ledger

- `WB1`: an expired session's row is kept 24 hours so its refusal reads `expired` rather than `unknown`.
- `WB2`: an allowance window is at most 7 days and its cap at most 1,000 uses; anything larger is refused as a mistake.
- `WB3`: a workspace session notes at most 500 rooms; more is treated as a runaway frame.
