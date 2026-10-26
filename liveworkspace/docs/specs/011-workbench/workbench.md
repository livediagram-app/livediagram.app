# Workbenches

A **workbench** is a developer tool (an agent workbench first, VS Code later) that shows one of our editors in a frame
beside an agent, signed in as the person. The tool and the person pair once, approved in the person's own browser;
then the tool mints one-minute tickets, each opening a signed-in session confined to one item (the item scope) or the
person's Explorer (the workspace scope). What a workbench embed is, and what the frame does, is each app's spec
(`<app>/docs/specs/013-workspace/workbench-embeds.md`). This page is the part every app shares: pairing, tickets,
sessions, revocation and the sweep, built once on the platform.

## Where it runs: the accounts Worker

The workbench service is part of the accounts Worker (`liveworkspace-accounts`), not a Worker of its own:

- **Pairings belong to API tokens**, and tokens are accounts'. Hosting the store beside them means a token revoked
  (on liveworkspace.app, by the CLI's `auth logout`, or with its account) ends its pairings and sessions in the same
  request, with no polling. Each app's store used to ask accounts every five minutes which tokens still worked.
- **The person's name and colour** (the session's `person`) and their teams are accounts' too, read in-process.
- **No new moving parts.** No new Worker, deploy, port, route or secret: one Durable Object class and a rate limiter
  in an existing Worker. Accounts already reaches the index (the `INDEX` service binding and `INDEX_MERGE_KEY`).

The index would have been the other host (it holds grants and access), but every token check and revocation would
then be a call to accounts, and revocation would need a feed from accounts to the index or the five-minute poll kept.

```
apps/accounts/src/workbench/
  store.ts            the per-person store (WorkbenchCore): pairing requests, pairings, tickets, sessions, rooms,
                      the notification allowance, the sweep
  durable-object.ts   the Durable Object class (WorkbenchStore), bound as WORKBENCH
  routes.ts           /api/account/workbench/*: the CLI's, the frame's, the pairing page's and Settings' doors
  internal.ts         /api/account/internal/workbench/* and /allowance: the apps' servers' doors
  apps.ts             each app's dialect (its word for an item, its frame's address)
  index-access.ts     the owner's access to an item or folder, asked of the index for the person
  revoke.ts           ending what hangs off a token or an account, and closing rooms through the index
apps/site/app/workbench/pair/   the one pairing page, liveworkspace.app/workbench/pair?code=
```

## Addresses

Every app keeps `/api/workbench/*` on its own address, with the same requests and answers as before, so its CLI, its
editor and its Settings change nothing. The app's router forwards the path to accounts
(`@liveworkspace/sites` `WORKBENCH_ROUTE`: `/api/workbench/*` → `/api/account/workbench/*`), stamping the app's name in
`X-Liveworkspace-Proxy`. The app's API Worker forwards it too, for a caller that reaches the API without the router
(the CLI against `wrangler dev`, an editor built with `NEXT_PUBLIC_API_BASE`). On liveworkspace.app itself the routes
are `/api/account/workbench/*`, and a request names its app in the body (`app`) or the query.

The app named is only a choice of dialect and of which items the ticket reaches: a token is good on every app, so
naming another app gives nothing that app's own address would not.

| Route                                             | Who                                  | What                                                  |
| ------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `POST tickets`                                    | an API token (`lwt_`)                | mint a ticket, or `428 pairing_required` with the URL |
| `POST sessions`                                   | nobody: the ticket is the credential | redeem a ticket for a session (`lvw_`)                |
| `DELETE sessions/current`                         | a session (`lvw_`)                   | end that session                                      |
| `POST pairing-requests`                           | an API token                         | ask to pair, or `paired` when already                 |
| `GET pairing-requests/:code/status`               | the token that asked                 | the CLI's wait                                        |
| `GET pairing-requests/:code`                      | the token's owner, signed in         | the pairing page's question                           |
| `POST pairing-requests/:code/approve`, `/decline` | the token's owner, signed in         | the answer, once                                      |
| `GET pairings`, `DELETE pairings/:id`             | the owner, signed in                 | Settings > API tokens; Unpair                         |
| `POST /api/account/internal/workbench/session`    | an app's server (client credentials) | check a session (`lvw_`) for that app                 |
| `POST /api/account/internal/workbench/rooms`      | an app's server                      | a workspace session joined an item's room             |
| `POST /api/account/internal/allowance`            | an app's server                      | take from a sender's notification email allowance     |

"Signed in" is the liveworkspace.app session cookie (same-origin writes only), or, on an app's address, an account's
access token for that app. A token, a workbench session or a guest never answers a pairing or unpairs.

The body and answer of each public route are the app's own (`<app>/packages/api-schema/src/workbench.ts`): its word
for an item (`project`, `document`, `design`) as the item scope, and `<word>Id` for the item. `apps.ts` holds the
four, taken from `APP_ITEMS[app].apiNoun` in `@liveworkspace/sites`. The store itself keeps the scope as `item` or
`workspace`.

## The four copies, and how they were reconciled

The four apps' copies (routes, store wrapper, access checks, CLI, editor) were the same code with the product's name
and its word for an item. Compared with those folded:

| Difference                               | livediagram                         | liveplanner, livedocuments, livedesign      | Now                                                                                                            |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| The item scope's word, and its id field  | `document`, `documentId`            | `project`/`projectId`, `document`, `design` | kept per app (the dialect)                                                                                     |
| An item in the Trash, at mint/redemption | `410 document_trashed`              | `404`                                       | `410 <word>_trashed` for all: it says why                                                                      |
| Checking a workspace ticket's folder     | one `folderPreviews` request        | up to five pages of `listFolders`           | `folderPreviews`, one request                                                                                  |
| The ticket's tab                         | checked in the item's room          | the same                                    | not checked at mint (the CLI resolves `--tab` first; the frame opens the first tab when the asked one is gone) |
| The confinement allow-list               | images, icons, shape libraries, Q&A | items and card types (planner), images      | stays in each app: it is what the app's API serves                                                             |
| `WORKBENCH_ERROR_CODES`                  | listed                              | listed, except livedesign                   | unchanged (the app's schema)                                                                                   |
| The room's close code                    | `WORKBENCH_ENDED_CLOSE` 4006        | 4006 in all three                           | unchanged, in each room                                                                                        |

## The store

One SQLite-backed Durable Object per person (`idFromName(personId)`), in the accounts Worker:

```sql
wb_pairing_requests (code PK, app, token_id, origin, name, scope, status, created_at, expires_at, answered_at)
wb_pairings         (id PK, app, token_id, origin, name, scope, created_at, UNIQUE (app, token_id, origin))
wb_tickets          (ticket_hash PK, app, token_id, pairing_id → wb_pairings ON DELETE CASCADE, scope, item_id,
                     folder_id, tab_id, origin, role, created_at, expires_at, used_at)
wb_sessions         (id PK, secret_hash UNIQUE, app, token_id, pairing_id → wb_pairings ON DELETE CASCADE, scope,
                     item_id, folder_id, tab_id, origin, role, created_at, expires_at)
wb_session_rooms    (session_id → wb_sessions ON DELETE CASCADE, item_id)
wb_quota            (kind, at, until)   -- the notification email allowance, `<app>:notify-email`
wb_meta             (key, value)        -- whose store it is
```

- **A pairing is per app**, as it was: one token and one origin, for one app's items, approved once. Approving the
  workspace scope widens an item pairing in place; an item approval never narrows a workspace one.
- **Secrets** are stored as SHA-256 only. A ticket is `<22 base64url>.<store id>` and a session
  `lvw_<43 base64url>.<store id>`, the same shapes as before, so a redemption or a session check reaches the store
  from the secret; a forged suffix reaches a store that knows nothing of it.
- **No copy of tokens.** A token's state is accounts' own `api_token` row, read where it matters: the mint (the
  presented token), the redemption and every session check (live, by id). The store keeps only token ids.
- **Idle at no cost.** The alarm is set only while something will lapse: a ticket, a pairing request or a session
  (expired sessions are kept a day so a refusal reads "expired"). It is set for the earliest such moment, the sweep
  deletes what has lapsed, and once nothing is left to lapse the alarm is cleared. A store holding only pairings sits
  with no alarm and no timers; a store left with nothing at all deletes itself. There are no WebSockets.

## The handoff

1. **Mint** (`POST tickets`). The token is checked in accounts' D1 (one indexed read), limited to
   `WORKBENCH_TICKETS_PER_MINUTE` (the `WORKBENCH_LIMITER` binding, keyed by token). The store finds the pairing for
   the app, token and origin; without one covering the scope it opens (or reuses) a pairing request and answers 428
   with `pairingUrl`, `https://www.liveworkspace.app/workbench/pair?code=<code>`. With one, the index is asked for the
   owner's access as the person (delegated, with accounts' key: the item's grant, or the folder's preview), the
   level is capped by the token (a read-only token gives `view`), and the ticket is written. The frame's URL is the
   app's canonical origin (`appOrigins` in `@liveworkspace/sites`).
2. **Redeem** (`POST sessions`). The ticket is consumed once; its token must still be live; an item ticket's
   access is asked of the index again and caps the level. The session lasts `WORKBENCH_SESSION_TTL_MS` or until the
   token's expiry. The answer carries the person's name and colour (accounts' profile).
3. **Use.** The frame sends `Bearer lvw_…` to its app's API. The app checks it with accounts
   (`@liveworkspace/auth-client` `createWorkbenchSessionChecker`, client credentials) and keeps each answer: a live
   session for up to a minute (never past its expiry), an unknown one for ten seconds, up to 1,000 per isolate, as it
   keeps API tokens. A session minted for another app is refused. The app then confines the request to the
   session's scope (its own `workbenchRouteVerdict`), exactly as before.
4. **Rooms.** A session's room ticket is sealed to its pairing and level by the app (`<grant>~<pairing>~<cap>~<hmac>`,
   @liveworkspace/index-app `room-ticket.ts`); room messages never touch the workbench service. A workspace session
   that joins a room tells accounts once per isolate (`POST internal/workbench/rooms`), off the response's path, so
   ending its access closes that room too.

## Ending access

- **Unpair** (`DELETE pairings/:id`) removes one pairing; **a token revoked** (`DELETE /api/account/tokens/:id`, the
  CLI's self-revoke) removes every pairing and request of that token; **an account closed** removes the whole store.
- Each removes the rows first (every later request of those sessions fails at the next check), then closes the rooms
  their sessions had open: accounts asks the index (`POST /api/index/internal/workbench-close`, accounts' key), which
  calls each app's `POST /api/internal/items/:id/workbench-close { pairingId }` with the app's key, the door the index
  already uses for revoked links. The room closes the pairing's sockets with `WORKBENCH_ENDED_CLOSE` (4006).
- What an app still holds of a session it checked runs out within a minute. A room is closed at once.

## Performance

Measured in the tests named, against node:sqlite and stubbed services:

| Operation                | Before (in each app)                                                                                           | Now                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Ticket mint              | token check at accounts (cached a minute), 3 Durable Object calls (pairing, tab, mint), 1 index grant (cached) | 1 D1 token read, 2 Durable Object calls, 1 index call through the service binding |
| Ticket redemption        | 2 Durable Object calls, 1 index grant, 1 profile read at accounts (cached)                                     | 2 Durable Object calls, 1 index call, 2 D1 reads (token, profile)                 |
| A request bearing `lvw_` | 1 Durable Object call, every request                                                                           | none from cache; at most one accounts call per session per minute per isolate     |
| A room message           | none                                                                                                           | none                                                                              |
| A workspace room joined  | 1 Durable Object call, every room ticket                                                                       | 1 accounts call per session and room per isolate, off the response's path         |
| An idle person           | the alarm every five minutes while a session lived, daily otherwise                                            | no alarm unless a ticket, request or session will lapse                           |

The mint and redemption now go from the app's router to liveworkspace.app (a fetch inside Cloudflare's network)
instead of the router's service binding to the app's API: one more public hop on each, which happens once a minute at
most per frame. The editor's hot path (saves, room messages) gains nothing; its `lvw_` checks drop from one
Durable Object call per request to one accounts call a minute.

## Deploying

CI's deploy creates everything: the accounts Worker's `wrangler.toml` declares the `WORKBENCH` Durable Object
(a `new_sqlite_classes` migration) and the `WORKBENCH_LIMITER` rate limiter, and the index needs no new setting.
Each app's `wrangler.toml` drops its own `WorkbenchStore` with a `deleted_classes` migration.

### Pairings from the historical livediagram.app

The historical livediagram.app (on its previous account, [docs/migration.md](../../../../docs/migration.md)) keeps its
pairings and sessions in its D1 tables (`workbench_pairing_requests`, `workbench_pairings`, `workbench_tickets`,
`workbench_sessions`), each tied to a livediagram API token (`lvd_`). The migration carries the tokens over (step 1),
but not the pairings: pairings here live in each person's Durable Object and are approved on liveworkspace.app, so
each person runs `livediagram workbench pair` once more. The old tables go with the old deployment.

## Locally

Nothing new to run: `corepack pnpm dev:workspace` runs accounts on :8787 behind the site on :3000, and each app's
router (`WORKSPACE_ORIGIN=http://localhost:3000`) forwards `/api/workbench/*` there. The pairing page is
`http://localhost:3000/workbench/pair?code=…`.
