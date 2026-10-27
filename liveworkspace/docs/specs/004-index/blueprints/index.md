# The index service: blueprint

Derived from [index-service.md](../index-service.md), [one-explorer.md](../one-explorer.md) and
[one-explorer-contracts.md](../one-explorer-contracts.md). The spec decides; this file only adds engineering
precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md)
and cited as `IDXn`. Paths are relative to the repository root.

This file holds the Worker as a whole: routing, who may call, the access rule, grants, the Drive flag, the crons,
the tables, configuration, logs and tests. Each feature has its own file:

| Feature                      | Blueprint                                |
| ---------------------------- | ---------------------------------------- |
| Items, folders, lists, opens | [items.md](items.md)                     |
| Share links and passwords    | [sharing.md](sharing.md)                 |
| What items push; the Inbox   | [inbox.md](inbox.md)                     |
| The Timeline                 | [timeline.md](timeline.md)               |
| The Trash, purges, closing   | [trash.md](trash.md)                     |
| Default folders              | [default-folders.md](default-folders.md) |
| Guest merge and the handoff  | [guest-merge.md](guest-merge.md)         |

## Domain and naming

| Term       | Identifier                                                         | Meaning                                                                       |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| App        | `App`: `livediagram`, `liveplanner`, `livedocuments`, `livedesign` | Each makes one `Kind`: `canvas`, `plan`, `document`, `design`                 |
| Item       | `items` row, id a UUID (or one the client minted)                  | One Canvas, Plan, Document or Design; its content stays in its app            |
| Scope      | `p:<owner id>` or `t:<team id>`                                    | The space an item or folder lives in; every list walks an index starting here |
| Person     | `Person { id, kind, teams, app?, drive? }`                         | Who a request acts for                                                        |
| Access     | `Access { level, tabId, via, code, public? }`                      | `via`: `owner`, `team` or `link`                                              |
| Level      | `view` < `participate` < `edit`                                    | `levelAtLeast(have, need)`                                                    |
| Grant      | ES256 JWT, 10 minutes                                              | The index's word that someone may open an item                                |
| Share code | 14 characters of `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`                | A link; any `[A-Za-z0-9]{4,64}` is read, upper-cased                          |
| Id         | `^[A-Za-z0-9_-]{1,128}$` (`isId`)                                  | Items, folders, teams, people; a part id (`isPartId`) is any 1 to 128 chars   |
| Cursor     | base64url of `[at, id]`, at most 400 chars                         | Keyset paging                                                                 |

## Behaviour and state

### Routing (`index.ts`), in order

1. Outside `/api/index` is a bare `404 Not found`; `INDEX_ENABLED` `false`/`0`/`off` answers `404 not_found`;
   a path segment that won't percent-decode is `404`.
2. `app/…` goes to `handleApp` (an app's key, or the Drive key for `/app/people/:id/drive`).
3. `internal/merge`, `internal/timeline`, `internal/purge-person`, `internal/workbench-close`: accounts' `MERGE_KEY`.
4. `callerOf`: a delegate header refused is `401`; the Drive mirror naming a guest is `403 forbidden`; no caller is
   `401 unauthorized`.
5. An app acting for a person: on `items`, `trash`, `shared`, `inbox`, `timeline` (one segment) the query's `app` is
   forced to that app.
6. The Drive mirror reaches only `items`, `trash` and `folders`, never `items/:id/share*` (`404`).
7. `jwks`, `share/:code…`, `items…`, then the person routes (`folders`, `favourites`, `recent-hidden`,
   `placement-defaults`, `shared`, `inbox`, `trash`, `timeline`), each `401` without a person.
8. After the answer, the people whose personal items or folders changed are signalled to Drive (`waitUntil`).

### Who may call (`auth.ts`)

| Caller                  | Proof                                                                                                                  | Person                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A person                | `Bearer` access or guest token, verified offline against `${ACCOUNTS_URL}/api/auth`, audience any of `INDEX_AUDIENCES` | account: `{ id, teams }` from the claim; guest: `{ id, teams: [] }`      |
| An app for an account   | `Bearer INDEX_KEY_<APP>`, `X-Index-App`, `X-Index-Person`, optional `X-Index-Teams` (≤ 50 ids)                         | `{ id, kind: 'account', teams, app }`; a guest, `:` or bad id is refused |
| Accounts for an account | `Bearer MERGE_KEY`, `X-Index-App`, `X-Index-Person` (a workbench token's)                                              | as an app's                                                              |
| The Drive mirror        | `Bearer INDEX_KEY_DRIVE`, `X-Index-App: drive`, `X-Index-Person`                                                       | `{ id, teams: [], drive: true }`; a guest is `403`                       |
| A link visitor          | `X-Share-Code` (and `X-Share-Password`), with or without a person                                                      | `share: { code, password, visitor }`                                     |
| An app's server         | `Bearer INDEX_KEY_<APP>` and `X-Index-App` (`callerApp`)                                                               | none                                                                     |
| Accounts                | `Bearer MERGE_KEY` (`isMergeCaller`)                                                                                   | none                                                                     |

Every key comparison is `timingSafeEqual` (both sides hashed). A verifier is kept per issuer and audience list for
the isolate.

### The access rule (`access.ts`, `rows.ts`)

1. `directAccess`: the owner of a personal item (`team_id IS NULL`) or a member of its team (from the claim): `edit`,
   no tab. A team item's maker reaches it only as a member.
2. A team the claim lacks: `inTeamNow` asks accounts (`POST ${ACCOUNTS_URL}/api/account/index/teams { userId }`,
   `MERGE_KEY`, 3 s), remembered by `@liveworkspace/index-app` `createTeamAccess` (an answer lacking the team reused for
   2 s, one holding it for 30 s); accounts unreachable leaves the claim standing. Only for accounts, never a delegate or the mirror.
3. No person and no share: `401`. A trashed item: `404` to anyone else.
4. A live link (`expires_at IS NULL OR expires_at > now`): the code sent, else the one the person opened it through
   (`shared_with`). None: `404`.
5. `linkAccess`: a public link behind a password is `404`; a password needed and none sent is `401
password_required`; a guess this isolate hasn't seen right is counted (`429 rate_limited`, `Retry-After: 60`); a
   wrong one is `403 password_invalid`; else the link's level and tab.
6. `loadItem(need, { manage })`: an app delegate reaches its own app's items only, the mirror its own personal
   items only (`404` otherwise); `manage` refuses a link (`403`); a level below `need` is `403 forbidden`.

### Grants (`grants.ts`)

`mintGrant` signs `{ item, level, tab, team, owner, trashed?, link? }` with `iss = ${ACCOUNTS_URL}/api/index`, `aud =
<app>`, `sub = <person id>` or `link:<code>`, `iat`, `exp = iat + 600`, `jti` a UUID, header `{ alg: ES256, kid, typ:
JWT }`; answers `{ grant, level, tabId, expiresAt (ms), trashed? }`. The key is `GRANT_SIGNING_KEY` (a private P-256
JWK with `kid`), cached by its text, a bad one retried next request. Development with no key signs with an ephemeral
`dev-<8 hex>` key per isolate. Production without one: `503 grants_unavailable` on create and grant, and `GET /jwks`
answers `503`. `GET /jwks` answers `{ keys: [publicJwk] }`, `Cache-Control: public, max-age=300`.

### The Drive flag and signal (`drive.ts`)

`touchItem` collects the owner of any personal item or folder a request changed. After the answer, one read of
`drive_people` for those ids (guests skipped), then `POST https://drive/app/changes { personId, at }` with
`DRIVE_KEY_INDEX` through the `DRIVE` binding, 6 at a time; failures are logged, never thrown. Without the binding
nothing is read. A summary push signals the owner when `updated_at` moved on. `/app/people/:id/drive` with
`INDEX_KEY_DRIVE`: `PUT` sets the flag (`ON CONFLICT DO NOTHING`, keeping `since`), `DELETE` clears, `GET` answers `{
mirrored }`; a guest is `403`, a bad id `400`.

### The crons (`scheduled`)

Each step runs in `step()`: a throw is logged `[index] cron step failed: <name>` and the next step runs. Off: nothing.

| Cron           | Steps, in order                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*/15 * * * *` | 1. `purges` (`continuePurges`): up to 20 recorded person purges oldest first within 30 s / 300 D1 calls; then up to 300 tombstones never tried or not tried for an hour; then `drainPersonNotices`. 2. `person merges` (`drainPersonMerges`). |
| `23 4 * * *`   | 1. `sweep`: the empty clean-up (≤ 1000), items 30 days in the Trash purged (≤ 500), Drive signals, up to 200 tombstones drained, loose events swept (≤ 1000). 2. `expiring links` (`sweepExpiringLinks`, ≤ 2000 items).                       |

Details are in [trash.md](trash.md), [guest-merge.md](guest-merge.md) and [timeline.md](timeline.md).

## Interfaces and contracts

Every answer is JSON with `Cache-Control: private, no-store` (but `GET /jwks`); a refusal is `{ "error": <code> }`
from `INDEX_ERRORS`. A body over 512 KiB, cut off mid-read, or not a JSON object is `400 invalid_body` (an empty body
is `{}`).

| Path (under `/api/index`)                                                                                                              | Methods                       | Blueprint                                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `/jwks`                                                                                                                                | GET                           | this file                                        |
| `/items`, `/items/:id`, `/items/:id/{restore,copy,open,grant}`                                                                         | GET, POST, PATCH, DELETE      | [items.md](items.md)                             |
| `/folders`, `/folders/:id`, `/folders/previews`                                                                                        | GET, POST, PATCH, DELETE      | [items.md](items.md)                             |
| `/favourites`, `/favourites/:itemId`, `/recent-hidden/:itemId`                                                                         | GET, PUT, DELETE              | [items.md](items.md)                             |
| `/items/:id/share`, `/items/:id/share-password`, `/share/:code`, `/share/:code/extend`, `/shared`, `/shared/:itemId`                   | GET, POST, PUT, PATCH, DELETE | [sharing.md](sharing.md)                         |
| `/inbox`                                                                                                                               | GET                           | [inbox.md](inbox.md)                             |
| `/timeline` (`?team=` for a team's Team Activity), `/timeline/seen`, `/timeline/dismiss`                                               | GET, POST                     | [timeline.md](timeline.md)                       |
| `/trash`                                                                                                                               | GET, DELETE                   | [trash.md](trash.md)                             |
| `/placement-defaults`, `/placement-defaults/:key`                                                                                      | GET, PUT, DELETE              | [default-folders.md](default-folders.md)         |
| `/app/items/:id/{summary,events,collab/:tab,forms/:tab,forms/:tab/seen}`, `/app/forms/:code`, `/app/items/:id/forms/:tab/seen/:person` | PUT, GET                      | [inbox.md](inbox.md), [timeline.md](timeline.md) |
| `/app/people/events`                                                                                                                   | PUT                           | [timeline.md](timeline.md)                       |
| `/app/people/:id/count`                                                                                                                | GET                           | [sharing.md](sharing.md) (notices)               |
| `/app/people/:id/drive`                                                                                                                | GET, PUT, DELETE              | this file                                        |
| `/app/migration/handoff`                                                                                                               | POST                          | [guest-merge.md](guest-merge.md)                 |
| `/internal/merge`                                                                                                                      | POST                          | [guest-merge.md](guest-merge.md)                 |
| `/internal/purge-person`                                                                                                               | POST                          | [trash.md](trash.md)                             |
| `/internal/timeline`                                                                                                                   | POST                          | [timeline.md](timeline.md)                       |
| `/internal/workbench-close`                                                                                                            | POST                          | this file                                        |

`POST /internal/workbench-close { app, pairingId (^[A-Za-z0-9_-]{1,64}$), itemIds (≤ 500 ids) }` with `MERGE_KEY`:
each distinct item gets `POST <app>/api/internal/items/:id/workbench-close { pairingId }`, 10 at a time; `200 {
closed, unreached }`.

### Calls out to the apps (`callApp`)

`<APP_ORIGIN_<APP>>/api/internal<path>` with `Authorization: Bearer INDEX_KEY_<APP>` and `X-Index-App`, 10 s (the
handoff 30 s). A `DELETE` answered `404` counts as done. Unconfigured is `app_not_configured`; else `status_<n>` or
the error's name. Doors (`@liveworkspace/index-app` `internal.ts`): `DELETE /items/:id`, `POST /items/purge {ids}`,
`POST /items/:id/revoke {codes, reason?}`, `POST /items/:id/notices`, `POST /items/:id/workbench-close`, `POST
/items/:from/copy-to/:to`, `POST /people/:id/purge {items}`, `POST /people/:guest/merge {into, legacy?}`, `PUT
/items/:id/migration`; and for previews and Drive, `GET /items/:id/export` and `POST /items/import`.

## Errors and edge cases

| Case                              | Answer                                                 |
| --------------------------------- | ------------------------------------------------------ |
| Off                               | every route `404`, crons idle                          |
| No audiences configured           | no token verifies: `401`                               |
| A delegate header without the key | `401` (never read as nobody)                           |
| An item the caller can't reach    | `404`, as if missing                                   |
| A team made since the token       | accounts asked once; unreachable, the claim stands     |
| No signing key in production      | `503 grants_unavailable` before any row is made        |
| An app unreachable                | logged; tombstones, notices and merges retried by cron |
| A cron step throws                | logged; later steps still run                          |

## Security and trust

- Access is decided here once and handed to the app as a grant; apps check it offline against `/jwks`.
- Every delegate is narrowed: an app to its own items, the Drive mirror to the person's personal items and folders,
  never a link or a team.
- Ids are a fixed charset, so nothing a caller sends reaches a path, a scope or a key unescaped; search patterns
  escape `%`, `_` and `\`.
- Share passwords are PBKDF2-SHA256 hashes (see [sharing.md](sharing.md)); guesses are limited at the edge.
- Secrets: `GRANT_SIGNING_KEY`, `MERGE_KEY`, `INDEX_KEY_<APP>`, `INDEX_KEY_DRIVE`, `DRIVE_KEY_INDEX`.

## Performance and limits

Every list is keyset-paged and walks an index that starts with the person, a scope or a folder; the query plans are
pinned by `lists.test.ts` "query plans". Decorating a page is one batch of four statements. Opens are debounced in
memory (5,000 keys) and in SQL (once a minute). Measured numbers are in
[index-service.md "Performance"](../index-service.md#performance).

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                                         | Where                  |
| ------- | --------------------------------------------------- | ---------------------- |
| `warn`  | `[account-app] activity_failed`                     | `activity.ts`          |
| `error` | `[grant] index unreachable`                         | `service.ts`           |
| `warn`  | `[grant] refused`                                   | `service.ts`           |
| `warn`  | `[index-app] images_report_failed`                  | `person-events.ts`     |
| `log`   | `[index] GRANT_SIGNING_KEY is unset: signing grant` | `grants.ts`            |
| `warn`  | `[index] copy failed`                               | `items.ts`             |
| `error` | `[index] create failed`                             | `request.ts`           |
| `log`   | `[index] created`                                   | `items.ts`             |
| `error` | `[index] cron step failed: …`                       | `index.ts`             |
| `log`   | `[index] emptied trash`                             | `items.ts`             |
| `warn`  | `[index] malformed stored share password refused`   | `password-hash.ts`     |
| `log`   | `[index] merged a guest`                            | `merge.ts`             |
| `log`   | `[index] migration handoff`                         | `migration-handoff.ts` |
| `warn`  | `[index] migration handoff not taken`               | `migration-handoff.ts` |
| `warn`  | `[index] notice not delivered`                      | `notices.ts`           |
| `warn`  | `[index] person merge not taken`                    | `person-merges.ts`     |
| `log`   | `[index] person merges`                             | `index.ts`             |
| `warn`  | `[index] person merges failed`                      | `merge.ts`             |
| `warn`  | `[index] person merges given up`                    | `person-merges.ts`     |
| `warn`  | `[index] person notice not taken`                   | `person-notices.ts`    |
| `warn`  | `[index] person notices`                            | `account-purge.ts`     |
| `warn`  | `[index] person notices given up`                   | `person-notices.ts`    |
| `warn`  | `[index] purge: apps unreachable, kept for the nex` | `purge.ts`             |
| `error` | `[index] purge: tombstone drain failed`             | `purge.ts`             |
| `log`   | `[index] purged`                                    | `items.ts`             |
| `log`   | `[index] purged a closed account`                   | `account-purge.ts`     |
| `log`   | `[index] purges`                                    | `index.ts`             |
| `warn`  | `[index] revoke not delivered`                      | `sharing.ts`           |
| `log`   | `[index] sweep: … empty items to the Tras`          | `index.ts`             |
| `error` | `[index] unreachable`                               | `lists.ts`             |
| `warn`  | `[index] visitor copy not recorded`                 | `visitors.ts`          |
| `warn`  | `[index] visitor open not recorded`                 | `visitors.ts`          |
| `log`   | `[index] … items wi`                                | `index.ts`             |
| `error` | `[internal] copy-to failed`                         | `internal.ts`          |
| `error` | `[internal] import failed`                          | `internal.ts`          |
| `warn`  | `[internal] import refused`                         | `internal.ts`          |
| `warn`  | `[internal] import undo failed`                     | `import-item.ts`       |
| `error` | `[internal] import write failed`                    | `import-item.ts`       |
| `info`  | `[internal] imported`                               | `internal.ts`          |
| `info`  | `[internal] migrated`                               | `internal.ts`          |
| `error` | `[internal] migration failed`                       | `internal.ts`          |
| `warn`  | `[internal] migration refused`                      | `internal.ts`          |
| `warn`  | `[internal] notice failed`                          | `internal.ts`          |
| `warn`  | `[internal] person merge failed`                    | `internal.ts`          |
| `warn`  | `[notify-email] skipped … ${String(emails`          | `notifier.ts`          |
| `warn`  | `[notify-email] the sender allowance could not be`  | `notify-claims.ts`     |
| `warn`  | `[room-purge] did not reach the room`               | `purge.ts`             |
| `info`  | `[room-purge] purged`                               | `purge.ts`             |
| `warn`  | `[tab-shares] leave failed`                         | `tab-shares.ts`        |
| `warn`  | `[tab-shares] send failed`                          | `tab-shares.ts`        |
| `warn`  | `[teams] accounts unreachable; the claim stands`    | `teams.ts`             |
| `error` | `[teams] create_failed`                             | `teams.ts`             |
| `warn`  | `[teams] create_refused`                            | `teams.ts`             |
| `info`  | `[teams] created`                                   | `teams.ts`             |
| `warn`  | `index: drive-signal failed`                        | `drive.ts`             |
| `error` | `index: drive-signal failed`                        | `drive.ts`             |

## Files

| File                                                | Role                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/access.ts`            | The access rule (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): the owner, and every joined member of the item's team, edit everything; anyone else n…     |
| `liveworkspace/apps/index/src/account-purge.ts`     | Closing an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account"): accounts calls POST /internal/purge-person with its own key once the account is go…     |
| `liveworkspace/apps/index/src/app-calls.ts`         | The index calling an app's internal routes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): copy an item's content, drop a purged item's content, tell an item a link was r…     |
| `liveworkspace/apps/index/src/app-routes.ts`        | What an item pushes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"), from its app's server with the app's key: the summary derived from its content, …     |
| `liveworkspace/apps/index/src/auth.ts`              | Who is asking (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Reaching the index"): - a person, by an accounts access token or a guest token, checked offline against accou…     |
| `liveworkspace/apps/index/src/codec.ts`             | Small encodings: list cursors, share codes, search patterns, page sizes, base64url.                                                                                                             |
| `liveworkspace/apps/index/src/collab-push.ts`       | What an item pushes for the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"), from its app's server with the app's key: each tab's comment threads and actions…     |
| `liveworkspace/apps/index/src/config.ts`            | The Worker's settings                                                                                                                                                                           |
| `liveworkspace/apps/index/src/context.ts`           |                                                                                                                                                                                                 |
| `liveworkspace/apps/index/src/default-placement.ts` | Filing on create: where a new item lands when it is made without a place                                                                                                                        |
| `liveworkspace/apps/index/src/drive.ts`             | The Google Drive mirror's side of the index (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"): the per-person `drive_mirrored` flag (`/app/people/:id/drive`), and the…     |
| `liveworkspace/apps/index/src/env.ts`               |                                                                                                                                                                                                 |
| `liveworkspace/apps/index/src/folder-previews.ts`   | What a folder card shows of what is inside (`GET /folders/previews?ids=…`): for each of up to 60 of the person's folders, its newest few items and how many it holds, for …                     |
| `liveworkspace/apps/index/src/folders.ts`           | Folders (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Folders, favourites, defaults"): one tree per person and one per team, holding items from any app                        |
| `liveworkspace/apps/index/src/fresh-teams.ts`       | A team made or joined since the caller's access token was minted (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Teams"): the token's `teams` claim is up to an hour old, s…     |
| `liveworkspace/apps/index/src/grants.ts`            | Grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): ES256 JWTs saying who may open an item at what level, valid for ten minutes, signed with the index's own k…     |
| `liveworkspace/apps/index/src/http.ts`              | Responses and request bodies                                                                                                                                                                    |
| `liveworkspace/apps/index/src/inbox.ts`             | The Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"): across every app, open actions and cards assigned to or by me, unresolved threads (an element's or a car…     |
| `liveworkspace/apps/index/src/index.ts`             | liveworkspace's index (liveworkspace/docs/specs/004-index/index-service.md): one Worker on liveworkspace.app/api/index holding where every Canvas, Plan, Document and Design is and who ca…     |
| `liveworkspace/apps/index/src/items.ts`             | Items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Items"): listing, making, reading, renaming and moving, the Trash, copies, opens and grants.                               |
| `liveworkspace/apps/index/src/lists.ts`             | The Explorer's lists (`GET /items`, `GET /trash`): one query per page, keyset-paged, each driven by an index that starts with the person (their scopes, their opens, favou…                     |
| `liveworkspace/apps/index/src/merge.ts`             | A guest becoming an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Becoming an account"): accounts calls this with its own key, and everything the guest had moves…     |
| `liveworkspace/apps/index/src/migration-handoff.ts` | The migration's handoff (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The migration's handoff", docs/migration.md step 6): livediagram's api splits a browser's Local onl…     |
| `liveworkspace/apps/index/src/notices.ts`           | What the index tells an item's app for its notification emails, and the one count it answers for them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Notices"): someone ma…     |
| `liveworkspace/apps/index/src/password-hash.ts`     | Share-password storage, as liveplanner keeps it (liveplanner/apps/api/src/auth/share-password-hash.ts): `pbkdf2-sha256$<iterations>$<salt>$<hash>`                                              |
| `liveworkspace/apps/index/src/person-merges.ts`     | Telling the apps a guest became an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Becoming an account"): the merge moves the index's own rows, but each app may ke…     |
| `liveworkspace/apps/index/src/person-notices.ts`    | Telling the apps about a closed account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account"): the index anonymises its own rows, but the person's name is a…     |
| `liveworkspace/apps/index/src/personal.ts`          | A person's own things about items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Folders, favourites, defaults"): favourites, what they hid from Recent, and the folder Ne…     |
| `liveworkspace/apps/index/src/purge.ts`             | Purging (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Purging"): a permanent delete, emptying the Trash, or the daily sweep of items 30 days in it                             |
| `liveworkspace/apps/index/src/rows.ts`              | Item rows and their wire shape                                                                                                                                                                  |
| `liveworkspace/apps/index/src/share-expiry.ts`      | Share Link Expiring (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): a warning on an item owner's Timeline before its share links stop working                        |
| `liveworkspace/apps/index/src/share-guesses.ts`     | Share-password guesses (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): each try at an item's password that this isolate hasn't already found right is…     |
| `liveworkspace/apps/index/src/sharing.ts`           | Sharing (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): share links, the share password, what a link opens, and Shared with me                             |
| `liveworkspace/apps/index/src/timeline.ts`          | The Timeline (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): what happened to the items a person reaches as owner or team member, newest first, in every app or…     |
| `liveworkspace/apps/index/src/visitors.ts`          | Opened by a Visitor and Copied by a Visitor (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): who came in to an item through one of its share links, on its owner…     |
| `liveworkspace/apps/index/src/workbench-close.ts`   | Accounts' workbench service ending a pairing's access (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"): it asks here, with its merge key, to tell an app to close the roo… |
| `packages/index-client/src/browser/fake-window.ts`  | A window for node tests: the two storages, a location whose assign and replace are recorded, and globals to set.                                                                                |
| `packages/index-client/src/browser/guest-token.ts`  | A guest's identity is liveworkspace's, the same guest in every app (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests")                                                      |
| `packages/index-client/src/browser/index.ts`        | The browser side of an app on the index: what every editor needs to be a guest, hold an item's grant, and read the person's teams from their token                                              |
| `packages/index-client/src/browser/item-grants.ts`  | The index's grant on an item (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an editor holds it: a ten-minute token naming the item, the level and the tab, wh…     |
| `packages/index-client/src/browser/token-teams.ts`  | The teams an access token names (its `teams` claim, liveworkspace/docs/specs/003-accounts/accounts.md "Teams"), read without checking the signature: for the Explorer's team list               |
| `packages/index-client/src/client.ts`               | The index as the Explorer and the editors call it (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): one typed method per call                                                     |
| `packages/index-client/src/constants.ts`            | The index's fixed names and numbers (liveworkspace/docs/specs/004-index/one-explorer-contracts.md)                                                                                              |
| `packages/index-client/src/grant.ts`                | Checks a grant inside an app (its api Worker or an item's Durable Object): an ES256 JWT the index signed, saying who may open which item at what level                                          |
| `packages/index-client/src/index.ts`                | The One Explorer index's shared contract (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): the names and limits, the wire types, a typed client for browsers and apps' serve…     |
| `packages/index-client/src/notices.ts`              | What the index tells an item's app, and asks of it, for the app's notification emails (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Notices")                                  |
| `packages/index-client/src/testing.ts`              | Test helpers                                                                                                                                                                                    |
| `packages/index-client/src/types.ts`                | The index's wire shapes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md)                                                                                                          |
| `packages/index-app/src/activity.ts`                | The owner's newest save, reported to the liveworkspace accounts Worker for its onboarding series (whether they have made anything yet, and when they were last active, in …                     |
| `packages/index-app/src/anonymise.ts`               | A closed account's name off the work they leave in other people's items (liveworkspace/docs/one-explorer- contracts.md "Closing an account"): the index anonymises its own…                     |
| `packages/index-app/src/cards.ts`                   | An item's cards in the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): the open cards assigned to someone, and every card's comment thread, pu…     |
| `packages/index-app/src/forms.ts`                   | A public form's code, as an app's Worker finds the item behind it (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes")                                          |
| `packages/index-app/src/image-grants.ts`            | Which images an item may serve, answered in the item's own SQLite (its Durable Object): placement grants (liveworkspace/docs/specs/006-media/media.md "References"; an app's images spec, …     |
| `packages/index-app/src/import-item.ts`             | The import door's work every app shares (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"): read the file, make the index's item as its owner's personal item in the fol…     |
| `packages/index-app/src/index.ts`                   | The server side every app on liveworkspace's index shares (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): its grants and clients, the index's doors into its items, purgin…     |
| `packages/index-app/src/internal.ts`                | /api/internal/items/**: the index's doors into an app's items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md).                                                                   |
| `packages/index-app/src/item-db.ts`                 | An item's own SQLite behind the D1 surface, for an app whose items each live in a Durable Object (a plan, a document, a design)                                                                 |
| `packages/index-app/src/item-head.ts`               | An item's owner and team, as its Durable Object keeps them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants")                                                              |
| `packages/index-app/src/lists.ts`                   | What the routes an API client (the MCP server, the CLI, any script with an `lwt_` token) still calls on an app's api share, answering from the index: its refusals as the …                     |
| `packages/index-app/src/migration-door.ts`          | The migration door's body (docs/migration.md "The apps' migration door"; @liveworkspace/migration contract.ts MigrationRoomPayload): checked field by field before anythin…                     |
| `packages/index-app/src/migration-room.ts`          | The migration door's write into one item's Durable Object (docs/migration.md "The apps' migration door"; the contract is @liveworkspace/migration contract.ts): an old liv…                     |
| `packages/index-app/src/notifier.ts`                | The notification emails every app sends about its items, written once (docs/specs/014-identity/ profile-and-email-notifications.md in each app): the two milestones (the t…                     |
| `packages/index-app/src/notify-claims.ts`           | The once-only rules of an item's notification emails (@liveworkspace/auth-client notify.ts holds the numbers), for every app: - Once per key: someone joined (one email p…                      |
| `packages/index-app/src/outbox.ts`                  | What an item's Durable Object owes the index (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): its summary (`PUT /app/items/:id/summary`), each change…     |
| `packages/index-app/src/person-events.ts`           | Timeline events about a person rather than an item (docs/one-explorer-contracts.md "Timeline"): images uploaded, one entry per person, app and day whose count grows with …                     |
| `packages/index-app/src/purge.ts`                   | Dropping items' content for good (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Purging"): the index has already removed the rows (a permanent delete, the Trash's sweep, …     |
| `packages/index-app/src/request.ts`                 | The index's grant on the item a request is about (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an app's worker settles it before the request goes to the ite…     |
| `packages/index-app/src/room-ticket.ts`             | The ticket a socket joins an item's room with (`…/ws?t=`), and renews its session with: the index's grant itself (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants")        |
| `packages/index-app/src/service.ts`                 | An app's api reaching liveworkspace's index (liveworkspace/docs/specs/004-index/one-explorer.md, one-explorer-contracts.md): where every item is and who may open it                            |
| `packages/index-app/src/tab-link.ts`                | "Add to <Item>": `POST /api/<items>/:target/tabs/:tabId/link {from}` shares a tab of another of the caller's items (`from`) into `target` (tab-shares.ts)                                       |
| `packages/index-app/src/tab-shares.ts`              | A tab shared between items: one tab in several of a person's items at once, an edit in any reaching the others (each app's "Add to <Item>", its `tab-<item>-many-to-many.m…                     |
| `packages/index-app/src/tabs.ts`                    | An item's tabs alone (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "An item's tabs"): `GET /api/<items>/:id/tabs` answers `{ tabs: [{ id, name, kind }] }`, in the item's …     |
| `packages/index-app/src/teams.ts`                   | Team access for an app on the index (liveworkspace/docs/specs/003-accounts/accounts.md "Teams"): an app keeps no copy of teams.                                                                 |
| `packages/index-app/src/testing.ts`                 | Tests only (`@liveworkspace/index-app/testing`): node:sqlite stand-ins for what the kit's Durable Objects run on.                                                                               |
| `packages/index-app/src/timing-safe.ts`             | Constant-time string comparison for keys and share secrets: both sides are hashed (so length is hidden and the compared buffers are always 32 bytes) and the digests diffe…                     |
| `packages/index-app/src/worker-http.ts`             | Small pieces every liveworkspace service Worker answers with (index, media, Community, telemetry), kept once.                                                                                   |

## Constants and configuration: the Worker

`liveworkspace/apps/index/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                                  | Value                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Worker name                              | `liveworkspace-index`                                              |
| Route                                    | `www.liveworkspace.app/api/index*`, `liveworkspace.app/api/index*` |
| D1 `INDEX_DB`                            | `liveworkspace-index`, migrations `migrations`                     |
| Service `DRIVE`                          | `liveworkspace-drive`                                              |
| Rate limit `MIGRATION_LIMITER`           | 60 per 60 s                                                        |
| Rate limit `SHARE_GUESS_VISITOR_LIMITER` | 10 per 60 s                                                        |
| Rate limit `SHARE_GUESS_ITEM_LIMITER`    | 30 per 60 s                                                        |
| Crons                                    | `23 4 * * *`, `*/15 * * * *`                                       |
| Var `ENVIRONMENT`                        | `production`                                                       |
| Var `ACCOUNTS_URL`                       | `https://www.liveworkspace.app`                                    |
| Var `INDEX_AUDIENCES`                    | `https://livediagram.app/api,https://liveplanner.…`                |
| Var `APP_ORIGIN_LIVEDIAGRAM`             | `https://www.livediagram.app`                                      |
| Var `APP_ORIGIN_LIVEPLANNER`             | `https://www.liveplanner.app`                                      |
| Var `APP_ORIGIN_LIVEDOCUMENTS`           | `https://www.livedocuments.app`                                    |
| Var `APP_ORIGIN_LIVEDESIGN`              | `https://www.livedesign.app`                                       |

**`env.staging`**

| Setting                                  | Value                                                  |
| ---------------------------------------- | ------------------------------------------------------ |
| Worker name                              | `liveworkspace-index-staging`                          |
| Route                                    | `staging.liveworkspace.app/api/index*`                 |
| D1 `INDEX_DB`                            | `liveworkspace-index-staging`, migrations `migrations` |
| Service `DRIVE`                          | `liveworkspace-drive-staging`                          |
| Rate limit `MIGRATION_LIMITER`           | 60 per 60 s                                            |
| Rate limit `SHARE_GUESS_VISITOR_LIMITER` | 10 per 60 s                                            |
| Rate limit `SHARE_GUESS_ITEM_LIMITER`    | 30 per 60 s                                            |
| Crons                                    | `23 4 * * *`, `*/15 * * * *`                           |
| Var `ENVIRONMENT`                        | `staging`                                              |
| Var `ACCOUNTS_URL`                       | `https://staging.liveworkspace.app`                    |
| Var `INDEX_AUDIENCES`                    | `https://staging.livediagram.app/api,https://stag…`    |
| Var `APP_ORIGIN_LIVEDIAGRAM`             | `https://staging.livediagram.app`                      |
| Var `APP_ORIGIN_LIVEPLANNER`             | `https://staging.liveplanner.app`                      |
| Var `APP_ORIGIN_LIVEDOCUMENTS`           | `https://staging.livedocuments.app`                    |
| Var `APP_ORIGIN_LIVEDESIGN`              | `https://staging.livedesign.app`                       |

Env fields (`env.ts`): `ACCOUNTS_URL`, `APP_ORIGIN_LIVEDESIGN`, `APP_ORIGIN_LIVEDIAGRAM`, `APP_ORIGIN_LIVEDOCUMENTS`, `APP_ORIGIN_LIVEPLANNER`, `DRIVE_KEY_INDEX`, `ENVIRONMENT`, `GRANT_SIGNING_KEY`, `INDEX_AUDIENCES`, `INDEX_ENABLED`, `INDEX_KEY_DRIVE`, `INDEX_KEY_LIVEDESIGN`, `INDEX_KEY_LIVEDIAGRAM`, `INDEX_KEY_LIVEDOCUMENTS`, `INDEX_KEY_LIVEPLANNER`, `MERGE_KEY`.

## Data and persistence

One D1 database (`INDEX_DB`). Each table's indexes, and what writes and reads it, are in the feature file that owns
it: items, folders, favourites, opens and use days in [items.md](items.md); links, passwords and Shared with me in
[sharing.md](sharing.md); the collab tables in [inbox.md](inbox.md); the Timeline's four in [timeline.md](timeline.md);
tombstones, purges and notices in [trash.md](trash.md); placement defaults in [default-folders.md](default-folders.md);
person merges in [guest-merge.md](guest-merge.md); `drive_people` above. Foreign keys to `items` cascade, so a purged
item takes every row about it.

Migrations, in order:

- `0001_index.sql`
- `0002_person_app_notices.sql`
- `0003_person_app_merges.sql`
- `0004_form_codes.sql`
- `0005_drive_people.sql`
- `0006_person_app_merges_legacy.sql`

| Table                   | Columns                                                                                                                                                                                                                             | Created in                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `collab_actions`        | `app`, `item_id`, `tab_id`, `tab_name`, `element_id`, `action_id`, `element_label`, `name`, `description`, `status`, `assignee_id`, `assignee_name`, `assigner_id`, `assigner_name`, `team_id`, `card`, `created_at`, `updated_at`  | `0001_index.sql`              |
| `collab_form_reads`     | `person_id`, `item_id`, `tab_id`, `seen`                                                                                                                                                                                            | `0001_index.sql`              |
| `collab_forms`          | `app`, `item_id`, `tab_id`, `heading`, `board_tab_id`, `responses`, `latest_at`, `code (0004)`                                                                                                                                      | `0001_index.sql`              |
| `collab_thread_people`  | `app`, `item_id`, `tab_id`, `element_id`, `person_id`                                                                                                                                                                               | `0001_index.sql`              |
| `collab_threads`        | `app`, `item_id`, `tab_id`, `tab_name`, `element_id`, `element_label`, `resolved`, `comment_count`, `participant_ids`, `mentioned_ids`, `latest_text`, `latest_author_name`, `latest_author_color`, `card`, `first_at`, `latest_at` | `0001_index.sql`              |
| `drive_people`          | `person_id`, `since`                                                                                                                                                                                                                | `0005_drive_people.sql`       |
| `favourites`            | `person_id`, `item_id`, `created_at`                                                                                                                                                                                                | `0001_index.sql`              |
| `folders`               | `id`, `name`, `parent_id`, `owner_id`, `team_id`, `scope`, `created_at`, `updated_at`                                                                                                                                               | `0001_index.sql`              |
| `items`                 | `id`, `app`, `kind`, `owner_id`, `team_id`, `scope`, `folder_id`, `title`, `source`, `intent`, `summary`, `created_at`, `updated_at`, `trashed_at`, `trash_reason`, `empty_swept_for`                                               | `0001_index.sql`              |
| `opens`                 | `person_id`, `item_id`, `last_opened_at`, `hidden`                                                                                                                                                                                  | `0001_index.sql`              |
| `person_app_merges`     | `guest_id`, `user_id`, `app`, `created_at`, `attempts`, `last_attempt_at`, `legacy (0006)`                                                                                                                                          | `0003_person_app_merges.sql`  |
| `person_app_notices`    | `person_id`, `app`, `item_id`, `created_at`, `attempts`, `last_attempt_at`                                                                                                                                                          | `0002_person_app_notices.sql` |
| `person_purges`         | `person_id`, `team_ids`, `requested_at`, `finished_at`, `runs`                                                                                                                                                                      | `0001_index.sql`              |
| `placement_defaults`    | `person_id`, `default_key`, `folder_id`, `updated_at`                                                                                                                                                                               | `0001_index.sql`              |
| `purge_tombstones`      | `item_id`, `app`, `created_at`, `attempts`, `last_attempt_at`, `last_error`                                                                                                                                                         | `0001_index.sql`              |
| `share_links`           | `code`, `item_id`, `level`, `tab_id`, `expiry`, `expires_at`, `created_at`, `public`                                                                                                                                                | `0001_index.sql`              |
| `share_passwords`       | `item_id`, `hash`, `updated_at`                                                                                                                                                                                                     | `0001_index.sql`              |
| `shared_with`           | `person_id`, `item_id`, `share_code`, `last_seen`                                                                                                                                                                                   | `0001_index.sql`              |
| `timeline_dismissals`   | `person_id`, `event_id`, `created_at`                                                                                                                                                                                               | `0001_index.sql`              |
| `timeline_event_scopes` | `scope`, `event_id`, `app`, `occurred_at`                                                                                                                                                                                           | `0001_index.sql`              |
| `timeline_events`       | `id`, `app`, `item_id`, `actor_id`, `actor_name`, `type`, `title`, `detail`, `occurred_at`                                                                                                                                          | `0001_index.sql`              |
| `timeline_scope_state`  | `person_id`, `last_seen_at`                                                                                                                                                                                                         | `0001_index.sql`              |
| `use_days`              | `person_id`, `item_id`, `day`                                                                                                                                                                                                       | `0001_index.sql`              |

## Constants and configuration: named constants

| Constant                        | Value                                                                    | File                                  |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| `ANONYMISED_PERSON`             | `'deleted'`                                                              | `account-purge.ts`                    |
| `CHUNK`                         | `500`                                                                    | `account-purge.ts`                    |
| `LINGER_MS`                     | `2 * 60 * 60 * 1000`                                                     | `account-purge.ts`                    |
| `FREQUENT_CRON`                 | `'*/15 * * * *'`                                                         | `account-purge.ts`                    |
| `TOMBSTONES_PER_FREQUENT_RUN`   | `300`                                                                    | `account-purge.ts`                    |
| `TOMBSTONE_RETRY_AFTER_MS`      | `60 * 60 * 1000`                                                         | `account-purge.ts`                    |
| `CALL_BUDGET`                   | `{ ms: 5_000, calls: 300 }`                                              | `account-purge.ts`                    |
| `CRON_BUDGET`                   | `{ ms: 30_000, calls: 300 }`                                             | `account-purge.ts`                    |
| `DRIVE_DELEGATE`                | `'drive'`                                                                | `auth.ts`                             |
| `SHARE_CODE_LENGTH`             | `14`                                                                     | `codec.ts`                            |
| `D1_COMPOUND_MAX`               | `5`                                                                      | `packages/api-kit/src/d1-compound.ts` |
| `API_PATH`                      | `INDEX_API_PATH`                                                         | `config.ts`                           |
| `MAX_BODY_BYTES`                | `512 * 1024`                                                             | `config.ts`                           |
| `ID_MAX`                        | `128`                                                                    | `config.ts`                           |
| `INTENT_MAX`                    | `100`                                                                    | `config.ts`                           |
| `DEFAULT_KEY_MAX`               | `100`                                                                    | `config.ts`                           |
| `JWKS_MAX_AGE_S`                | `300`                                                                    | `config.ts`                           |
| `SWEEP_ITEMS_MAX`               | `500`                                                                    | `config.ts`                           |
| `TOMBSTONES_PER_RUN`            | `200`                                                                    | `config.ts`                           |
| `EMPTY_SWEEP_MAX`               | `1000`                                                                   | `config.ts`                           |
| `PURGE_NOW_MAX`                 | `25`                                                                     | `config.ts`                           |
| `APP_CALL_CONCURRENCY`          | `6`                                                                      | `config.ts`                           |
| `APP_CALL_TIMEOUT_MS`           | `10_000`                                                                 | `config.ts`                           |
| `HANDOFF_MAX_BYTES`             | `32 * 1024 * 1024`                                                       | `config.ts`                           |
| `HANDOFF_APP_TIMEOUT_MS`        | `30_000`                                                                 | `config.ts`                           |
| `INBOX_LIMIT_DEFAULT`           | `100`                                                                    | `config.ts`                           |
| `OPEN_MEMORY_MAX`               | `5_000`                                                                  | `config.ts`                           |
| `PASSWORD_MEMORY_MAX`           | `1_000`                                                                  | `config.ts`                           |
| `SHARE_GUESS_RETRY_AFTER_S`     | `60`                                                                     | `config.ts`                           |
| `SHARE_PASSWORD_ITERATIONS`     | `100_000`                                                                | `password-hash.ts`                    |
| `PERSON_ITEMS_PER_CALL`         | `100`                                                                    | `person-notices.ts`                   |
| `NOTICE_RETRY_AFTER_MS`         | `60 * 60 * 1000`                                                         | `person-notices.ts`                   |
| `NOTICE_GIVE_UP_MS`             | `7 * 24 * 60 * 60 * 1000`                                                | `person-notices.ts`                   |
| `LOOSE_EVENTS_SWEEP_MAX`        | `1000`                                                                   | `purge.ts`                            |
| `ITEM_COLUMNS`                  | `'i.id, i.app, i.kind, i.owner_id, i.team_id, i.scope, i.fold…`          | `rows.ts`                             |
| `LIVE_LINK`                     | `(alias: string) =>`                                                     | `rows.ts`                             |
| `EXPIRY_SWEEP_MAX`              | `2_000`                                                                  | `share-expiry.ts`                     |
| `FUTURE_SLACK_MS`               | `5 * 60 * 1000`                                                          | `timeline.ts`                         |
| `WORKBENCH_CLOSE_MAX_ITEMS`     | `500`                                                                    | `workbench-close.ts`                  |
| `WORKBENCH_CLOSE_CONCURRENCY`   | `10`                                                                     | `workbench-close.ts`                  |
| `GUEST_TOKEN_REFRESH_BEFORE_MS` | `30 * 24 * 3600 * 1000`                                                  | `guest-token.ts`                      |
| `GUEST_HANDOFF_BACKOFF_MS`      | `5 * 60_000`                                                             | `guest-token.ts`                      |
| `GRANT_RENEW_BEFORE_MS`         | `60_000`                                                                 | `item-grants.ts`                      |
| `GRANT_REFUSAL_MEMORY_MS`       | `30_000`                                                                 | `item-grants.ts`                      |
| `GRANT_RETRY_MS`                | `15_000`                                                                 | `item-grants.ts`                      |
| `GRANTS_HELD_MAX`               | `32`                                                                     | `item-grants.ts`                      |
| `APPS`                          | `['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const` | `constants.ts`                        |
| `KINDS`                         | `['canvas', 'plan', 'document', 'design'] as const`                      | `constants.ts`                        |
| `APP_KINDS`                     | `(object or list, see file)`                                             | `constants.ts`                        |
| `LEVELS`                        | `['view', 'participate', 'edit'] as const`                               | `constants.ts`                        |
| `FOLDER_PREVIEW_IDS_MAX`        | `60`                                                                     | `constants.ts`                        |
| `FOLDER_PREVIEW_ITEMS`          | `4`                                                                      | `constants.ts`                        |
| `FOLDER_PREVIEW_COUNT_CAP`      | `1000`                                                                   | `constants.ts`                        |
| `INDEX_API_PATH`                | `'/api/index'`                                                           | `constants.ts`                        |
| `INDEX_API_URL`                 | `https://www.liveworkspace.app${INDEX_API_PATH}`                         | `constants.ts`                        |
| `INDEX_APP_HEADER`              | `'X-Index-App'`                                                          | `constants.ts`                        |
| `INDEX_PERSON_HEADER`           | `'X-Index-Person'`                                                       | `constants.ts`                        |
| `INDEX_TEAMS_HEADER`            | `'X-Index-Teams'`                                                        | `constants.ts`                        |
| `DELEGATED_TEAMS_MAX`           | `50`                                                                     | `constants.ts`                        |
| `ITEM_GRANT_HEADER`             | `'X-Index-Grant'`                                                        | `constants.ts`                        |
| `SHARE_CODE_HEADER`             | `'X-Share-Code'`                                                         | `constants.ts`                        |
| `SHARE_PASSWORD_HEADER`         | `'X-Share-Password'`                                                     | `constants.ts`                        |
| `GRANT_LIFETIME_S`              | `600`                                                                    | `constants.ts`                        |
| `GRANT_RENEW_BEFORE_S`          | `60`                                                                     | `constants.ts`                        |
| `GRANT_ALG`                     | `'ES256'`                                                                | `constants.ts`                        |
| `GRANT_ISSUER`                  | `INDEX_API_URL`                                                          | `constants.ts`                        |
| `GRANT_JWKS_URL`                | `${INDEX_API_URL}/jwks`                                                  | `constants.ts`                        |
| `LIST_LIMIT_DEFAULT`            | `50`                                                                     | `constants.ts`                        |
| `LIST_LIMIT_MAX`                | `200`                                                                    | `constants.ts`                        |
| `SUMMARY_MAX_BYTES`             | `2048`                                                                   | `constants.ts`                        |
| `COLLAB_MAX_THREADS`            | `500`                                                                    | `constants.ts`                        |
| `COLLAB_MAX_ACTIONS`            | `500`                                                                    | `constants.ts`                        |
| `COLLAB_CARDS_TAB`              | `'~cards'`                                                               | `constants.ts`                        |
| `TITLE_MAX`                     | `500`                                                                    | `constants.ts`                        |
| `FOLDER_NAME_MAX`               | `500`                                                                    | `constants.ts`                        |
| `SHARE_PASSWORD_MAX`            | `256`                                                                    | `constants.ts`                        |
| `SHARE_PASSWORD_MIN`            | `6`                                                                      | `constants.ts`                        |
| `SHARE_LINKS_PER_ITEM`          | `100`                                                                    | `constants.ts`                        |
| `SEARCH_MAX`                    | `200`                                                                    | `constants.ts`                        |
| `SEARCH_WORDS_MAX`              | `16`                                                                     | `constants.ts`                        |
| `FILTER_VALUES_MAX`             | `8`                                                                      | `constants.ts`                        |
| `INTENT_WORD`                   | `/^[a-z0-9-]{1,32}$/`                                                    | `constants.ts`                        |
| `ITEM_OWNERS`                   | `['me', 'others'] as const`                                              | `constants.ts`                        |
| `TRASH_RETENTION_MS`            | `30 * 24 * 60 * 60 * 1000`                                               | `constants.ts`                        |
| `EMPTY_ITEM_STALE_MS`           | `30 * 24 * 60 * 60 * 1000`                                               | `constants.ts`                        |
| `OPEN_DEBOUNCE_MS`              | `60 * 1000`                                                              | `constants.ts`                        |
| `USE_WINDOW_DAYS`               | `90`                                                                     | `constants.ts`                        |
| `MOST_USED_MAX`                 | `8`                                                                      | `constants.ts`                        |
| `ITEM_TIMELINE_EVENT_TYPES`     | `(object or list, see file)`                                             | `constants.ts`                        |
| `PERSON_TIMELINE_EVENT_TYPES`   | `['image_uploaded', 'taken_offline'] as const`                           | `constants.ts`                        |
| `ACCOUNT_TIMELINE_EVENT_TYPES`  | `(object or list, see file)`                                             | `constants.ts`                        |
| `TIMELINE_EVENT_TYPES`          | `(object or list, see file)`                                             | `constants.ts`                        |
| `APP_TIMELINE_EVENT_TYPES`      | `['edited'] as const`                                                    | `constants.ts`                        |
| `APP_PERSON_EVENT_TYPES`        | `['image_uploaded'] as const`                                            | `constants.ts`                        |
| `TIMELINE_PLATFORM`             | `'liveworkspace' as const`                                               | `constants.ts`                        |
| `ACCOUNT_EVENT_SCOPES_MAX`      | `250`                                                                    | `constants.ts`                        |
| `SHARE_EXPIRY_WARNING_MS`       | `7 * 24 * 60 * 60 * 1000`                                                | `constants.ts`                        |
| `ACCOUNT_EVENT_AHEAD_MS`        | `8 * 24 * 60 * 60 * 1000`                                                | `constants.ts`                        |
| `COLLAB_EVENTS_MAX`             | `100`                                                                    | `constants.ts`                        |
| `TIMELINE_PAGE`                 | `30`                                                                     | `constants.ts`                        |
| `TIMELINE_LIMIT_MAX`            | `100`                                                                    | `constants.ts`                        |
| `APP_EVENTS_MAX`                | `100`                                                                    | `constants.ts`                        |
| `TIMELINE_DISMISS_MAX`          | `100`                                                                    | `constants.ts`                        |
| `TIMELINE_NEW_CAP`              | `99`                                                                     | `constants.ts`                        |
| `SHARE_LINK_EXPIRIES`           | `['never', 'week', 'month', 'sixMonths'] as const`                       | `constants.ts`                        |
| `SHARE_LINK_EXPIRY_MS`          | `(object or list, see file)`                                             | `constants.ts`                        |
| `DEFAULT_LINK_LEVEL`            | `'edit'`                                                                 | `constants.ts`                        |
| `ITEM_SOURCES`                  | `['person', 'ai', 'import', 'template'] as const`                        | `constants.ts`                        |
| `ITEM_VIEWS`                    | `(object or list, see file)`                                             | `constants.ts`                        |
| `INDEX_ERRORS`                  | `(object or list, see file)`                                             | `constants.ts`                        |
| `OWNED_COUNT_MAX`               | `1000`                                                                   | `notices.ts`                          |
| `ANONYMISED_PERSON`             | `'deleted'`                                                              | `anonymise.ts`                        |
| `ANONYMISED_NAME`               | `'Deleted account'`                                                      | `anonymise.ts`                        |
| `FORM_PLACE_TTL_MS`             | `60_000`                                                                 | `forms.ts`                            |
| `FORM_PLACE_CACHE_MAX`          | `1_000`                                                                  | `forms.ts`                            |
| `IMAGE_GRANT_SCHEMA`            | `(object or list, see file)`                                             | `image-grants.ts`                     |
| `JOINED_TELEMETRY_TYPE`         | `(object or list, see file)`                                             | `internal.ts`                         |
| `EXPORT_FORMATS`                | `['svg', 'file'] as const`                                               | `internal.ts`                         |
| `IMPORT_MAX_BYTES`              | `32 * 1024 * 1024`                                                       | `internal.ts`                         |
| `IMPORT_NAME_MAX`               | `1000`                                                                   | `internal.ts`                         |
| `PERSON_ITEMS_MAX`              | `100`                                                                    | `internal.ts`                         |
| `MIGRATION_MAX_BYTES`           | `IMPORT_MAX_BYTES`                                                       | `internal.ts`                         |
| `LIST_PAGES`                    | `5`                                                                      | `lists.ts`                            |
| `NOTIFY_QUOTA_KIND`             | `'notify-email'`                                                         | `notify-claims.ts`                    |
| `FLUSH_IDLE_MS`                 | `2_000`                                                                  | `outbox.ts`                           |
| `FLUSH_MIN_GAP_MS`              | `60_000`                                                                 | `outbox.ts`                           |
| `FLUSH_RETRY_MS`                | `60_000`                                                                 | `outbox.ts`                           |
| `DRAIN_TABS`                    | `50`                                                                     | `outbox.ts`                           |
| `PUSH_CONCURRENCY`              | `6`                                                                      | `outbox.ts`                           |
| `ROOM_PURGE_TIMEOUT_MS`         | `3_000`                                                                  | `purge.ts`                            |
| `ROOM_PURGE_CONCURRENCY`        | `10`                                                                     | `purge.ts`                            |
| `BULK_PURGE_MAX`                | `100`                                                                    | `purge.ts`                            |
| `ROOM_GRANT_MAX_LENGTH`         | `8192`                                                                   | `room-ticket.ts`                      |
| `GRANT_CACHE_MAX`               | `1000`                                                                   | `service.ts`                          |
| `MAX_TAB_HOLDERS`               | `20`                                                                     | `tab-shares.ts`                       |
| `DRAIN_SHARES`                  | `50`                                                                     | `tab-shares.ts`                       |
| `ITEM_TABS_SEGMENT`             | `'tabs'`                                                                 | `tabs.ts`                             |
| `MISS_RECHECK_MS`               | `2_000`                                                                  | `teams.ts`                            |
| `FRESH_TEAMS_MS`                | `30_000`                                                                 | `teams.ts`                            |
| `TEAM_NAME_MAX`                 | `80`                                                                     | `teams.ts`                            |
| `TEAM_ORGANISATION_MAX`         | `80`                                                                     | `teams.ts`                            |

## Testing

The Worker's suites run against an in-memory SQLite that refuses what D1 refuses (`compound.test.ts`). Each
feature file names the suites that pin it; these pin the Worker as a whole:

| Test                                                   | Pins                                                                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/delegate.test.ts` (5)    | an app acting for a person: its own items only, refused without the key or for a guest                                                                          |
| `liveworkspace/apps/index/src/drive.test.ts` (11)      | the Drive mirror's reach, the `drive_mirrored` flag, the change signal                                                                                          |
| `liveworkspace/apps/index/src/fresh-teams.test.ts` (2) | a team made or joined since the token was minted                                                                                                                |
| `liveworkspace/apps/index/src/workbench.test.ts` (5)   | accounts acting for a workbench token's account; `POST /internal/workbench-close`                                                                               |
| `liveworkspace/apps/index/src/http.test.ts` (3)        | `readObject`: oversized, cut off, not an object                                                                                                                 |
| `liveworkspace/apps/index/src/codec.test.ts` (5)       | `isId`, `isPartId`, ids on the wire                                                                                                                             |
| `liveworkspace/apps/index/src/compound.test.ts` (2)    | the test database refuses what D1 refuses, and runs a nested union of any length (`unionAll` itself: `packages/api-kit/src/d1-compound.test.ts`)                |
| `liveworkspace/apps/index/src/app.test.ts` (15)        | app pushes, the Inbox, the guest merge, the daily purge, the empty clean-up, merges told to apps                                                                |
| `packages/index-client/src/*.test.ts`                  | the client's routes and errors, the constants, grant verification, browser guest tokens, held grants, token teams                                               |
| `packages/index-app/src/*.test.ts`                     | each app's side: doors, outbox, grants on requests, room tickets, teams, purges, tabs, tab shares, forms, notifier, migration door, import, export, timing-safe |

## Defaults ledger

- `IDX1`: the spec names no isolate memory for opens or checked passwords; the code bounds them at 5,000 and 1,000
  keys, oldest out first.
- `IDX2`: the spec leaves the cron minutes open; the daily run is `23 4 * * *` and the frequent one `*/15 * * * *`.
- `IDX3`: a cron step that throws is logged and the run goes on to the next step.
