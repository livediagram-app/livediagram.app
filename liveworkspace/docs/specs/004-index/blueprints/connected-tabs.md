# Connected tabs: blueprint

Derived from [connected-tabs.md](../connected-tabs.md). The spec decides; this file adds the engineering detail.
Defaults are cited as `IDXn`. Paths are relative to the repository root.

## Build order

Built in five parts, each its own PR that leaves main working, nothing reachable before its entry point lands:

| Part | What lands                                                                                                                                                                                                                                                        | State   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | This spec and blueprint; the shared contract in `packages/index-client/src/connections.ts` (`TabConnection`, the readers, the doors' paths, the limits and the default role)                                                                                      | on main |
| 2    | The index: the `connections` table, `POST /items/:id/connections`, `GET /connections/:id`, the take-back, the app's confirm and removal doors, the sweep, purges, the pass's mark in `GET /items/:id/share`, the error codes, the index-client calls              | on main |
| 3    | Each app (livediagram, liveplanner, livedocuments, livedesign, livehuddle) keeps a connected tab: the `tabs.connection` column, its summaries and reads, the internal door for the reverse tab, telling the index on removal, scope redaction, copies and exports | planned |
| 4    | The shared UI, not yet mounted: the connected tab in `packages/workbench`'s tab strip, the Connect picker (Recent across apps, the role, both ways) and the opening states, in `packages/explorer` or `packages/workbench`                                        | planned |
| 5    | Every editor mounts it: connected tabs in the tab bar, Connect liveworkspace File at the very bottom of the start screen's sidebar, Remove and Connect Again, help articles, telemetry with its chart                                                             | planned |

## Scope, by file

| File                                                        | Role                                           | Part |
| ----------------------------------------------------------- | ---------------------------------------------- | ---- |
| `packages/index-client/src/connections.ts`                  | the shapes and readers every side shares       | 1    |
| `liveworkspace/apps/index/src/connections.ts`               | the routes: make, open, take back              | 2    |
| `liveworkspace/apps/index/src/connection-doors.ts`          | the app's confirm and removal doors, the sweep | 2    |
| `liveworkspace/apps/index/src/connection-rows.ts`           | dropping connections, purges' statements, href | 2    |
| `liveworkspace/apps/index/src/own-grants.ts`                | checking a grant the index signed              | 2    |
| `liveworkspace/apps/index/migrations/0010_connections.sql`  | the `connections` table                        | 2    |
| `<app>/apps/api/migrations/NNNN_tab_connection.sql`         | `tabs.connection` in each app                  | 3    |
| `<app>/apps/api/src/routes/internal-connected-tabs.ts`      | each app's door for the reverse tab            | 3    |
| `packages/workbench/src/components/chrome/ConnectedTab.tsx` | the tab: the target app's logo and name        | 4    |

## Domain and naming

| Term           | Identifier                                                      | Meaning                                                 |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| Connection     | `connections` row; `TabConnection { id, app, itemId }` on a tab | One connected tab's record                              |
| Connection id  | `cn_` + 16 to 64 letters and digits (`isConnectionId`)          | Made by the index: 24 random letters and digits (IDX22) |
| Host, host tab | `host_item_id`, `host_tab_id`                                   | Where the connected tab is                              |
| Target         | `target_item_id` (its app from `items.app`)                     | What it stands for                                      |
| Pass           | `share_code`, a `share_links` row                               | The link made for the connection; null once deleted     |
| Pair           | `pair_id`                                                       | The other connection made with it both ways             |

## Behaviour and state

### Checking the host's grant (`own-grants.ts`)

`X-Index-Grant` (`ITEM_GRANT_HEADER`) is verified against the index's own signing key (`signingKey`), ES256, its
issuer `grantIssuer`, unexpired, with `iss`, `sub`, `exp`, `iat` and `jti`; else it is no grant. A grant names its
item, level, tab, subject and the link it came through (`link`). A public link's grant is always `view`, so every door
that needs `edit` refuses it by level; the open door, which needs only `view`, looks the link up and refuses a
public one.

### Making (`POST /items/:id/connections`, the person's token and the host's grant)

Body `ConnectionInput { targetId, tabId, level?, both? }` (`readConnectionInput`; else `400 invalid_body`).

1. A person, by their own token: none is `401 unauthorized`; an app acting for one (an API token's, the Drive
   mirror, the data export) is `403 forbidden`, since agents never make connections.
2. `targetId === id`: `400 connection_self`.
3. The host grant must verify, be for this item and the host's app, name this person, be at `edit`, and its tab (if
   scoped) be `tabId`: else `403 forbidden`. The host must be live: else `404 not_found`.
4. The target must be live and managed by the person (`loadItem(edit, { manage })`, a link's access refused):
   `404 not_found` or `403 forbidden`, as for its Share.
5. `level` defaults to `connectionDefaultLevel(target app)`; one not in `connectionLevels(target app)` is
   `400 level_not_offered`.
6. `both`: the host must be managed by the person too (`403 forbidden`).
7. A connection already on `(host, tabId)` is replaced (Connect Again, IDX25): its row, its pass and the pass's Shared
   with me rows are deleted first in the same batch, and the old target's app told `revoke`.
8. One batch: the pass (`share_links`, `expiry: never`, not public), inserted only while the target has fewer than
   `SHARE_LINKS_PER_ITEM` links and the host fewer than `CONNECTIONS_PER_ITEM` connections; the `connections` row,
   only when the pass is there; the `shared` Timeline event on the target, as any link. Both ways adds, each only when
   the step before it wrote: the reverse pass on the host (under the host's link cap and the target's connection cap),
   the reverse row (`pair_id` the forward's, `host_tab_id` null) and the forward's `pair_id`. Nothing written is
   `409 connection_limit` when the host is full, else `409 share_link_limit`.
9. Both ways, once written: `POST <target app>/api/internal/items/:target/connected-tabs` (`itemConnectedTabsPath`,
   the app's `INDEX_KEY`) with `ConnectedTabWrite { name: host title, connection }`, waiting at most 5 s (IDX24).
   `2xx { tabId }` sets the reverse row's `host_tab_id` and `confirmed_at` and writes the `shared` event on the host;
   anything else (or a reverse the caps refused) deletes the reverse row and pass: `reverse: { state: 'unreached' }`.
10. The app's first-share notice (`tellApp`, `shared`) for the target, and for the host when the reverse was made.
11. `201 ConnectionMade { connection, name: target title, level, reverse }`.

### Confirming (`PUT /app/items/:id/connections/:cid?tab=` with the host app's key)

`appConnectionPath`. The host app calls it once the connected tab is in the host (the room's tab add from an editor).
Sets `confirmed_at` only when `host_item_id = :id`, `host_tab_id = tab` and the key's app is the host's. Always `204`.

### Taking back (`DELETE /connections/:id`, the host's grant in `X-Index-Grant`)

The editor's call when its tab add failed after the index made the connection (Work Tracker #571). The grant must
verify, be for the row's host and its app at `edit`, its tab null or the row's `host_tab_id`: else `404 not_found`.
Deletes the row and its pass only while unconfirmed (a confirmed one goes by removing its tab), with an `unshared`
event and the target's app told `revoke`. Otherwise `204`, changing nothing.

### Opening (`GET /connections/:id`, the host's grant in `X-Index-Grant`)

An app acting for a person is refused (`404 not_found`): agents read a tab's app and name, never where it leads.
Rate limited per caller (IDX23, `CONNECTION_OPEN_LIMITER`, keyed by the person, else the caller's network as
share-password guesses are; no key, no limit): `429 rate_limited` with `Retry-After`. The grant must verify, be for
the row's host and its app, its tab null or the row's `host_tab_id`, and not through a public link: else
`404 not_found`, the same answer as an unknown id. A target in the Trash or purged (`target_item_id` null):
`410 connection_target_gone`. A reader who reaches the target themselves (the token's person is its owner or in its
team) gets `via: 'item'` with `${origin}${itemPath}<id>`. Else a null or lapsed pass is
`410 connection_link_removed`, and a live one `via: 'link'` with `${origin}${sharePath}<code>` and the pass's level.
`origin` is the target app's site for the index's `ENVIRONMENT`: `https://www.<site>` in production,
`https://staging.<site>` on staging, `http://localhost:<port>` in development (`packages/sites` `APP_ITEMS`,
`LOCAL_PORTS`). `Cache-Control: private, no-store`.

### Removing (`DELETE /app/items/:id/connections/:cid?tab=` with the host app's key)

`appConnectionPath`. Deletes the row and its pass only when `host_item_id = :id`, `host_tab_id = tab` and the key's
app is the host's, with the pass's Shared with me rows and an `unshared` event on the target; the target's app is told
`revoke` as for any deleted link. Anything else, and a second call, answers `204` and changes nothing. The pair's row
keeps its own pass; its `pair_id` is cleared (`ON DELETE SET NULL`).

### The sweep (every 15 minutes, `sweepUnconfirmedConnections`)

Connections still unconfirmed `CONNECTION_CONFIRM_GRACE_MS` (an hour, IDX27) after they were made, at most
`CONNECTION_SWEEP_MAX` (200) a run, oldest first, on the partial index `connections_unconfirmed`: their rows, passes
and the passes' Shared with me rows go in one batch of three statements, and each target's app is told `revoke`. No
Timeline event: a tab that never appeared is not news.

### Elsewhere

- Deleting a pass anywhere (`DELETE /share/:code`, `DELETE /items/:id/share`) sets the row's `share_code` to null
  (`ON DELETE SET NULL`), so the tab offers Connect Again.
- Purging the host deletes its rows (`ON DELETE CASCADE`) and, in the same batch first, their passes and the passes'
  Shared with me rows (`hostedPassStatements`, two statements a chunk, in `purgeRows` and an account's purge). The
  passes' visitors leave when their grant lapses (`GRANT_LIFETIME_S`); no app is called, so a purge of thousands of
  items stays bounded.
- Purging the target deletes its passes with its links and sets the rows' `target_item_id` to null: they stay,
  opening `410 connection_target_gone`, until their tab is removed or their host purged (at most
  `CONNECTIONS_PER_ITEM` a host).
- `GET /items/:id/share` marks a pass `connection: { hostItemId, hostApp, hostTitle }` for the Share dialog.

### Each app (part 3)

- `tabs.connection TEXT NULL`, the `tabConnectionText` of the tab's connection, read with `parseTabConnectionText`
  into `TabSummary.connection` and the full tab's `connection`; never in `tabs.data`.
- Written only by the room's tab add from an editor and by the internal door; REST tab writes, changesets and
  imports drop it (`readTabConnection` for everything read).
- A tab outside a tab-scoped visitor's scope drops `connection` with its name. A connected tab is never linked into
  another document, duplicated within one, rendered, counted in stats or exported as an image.
- When a tab with a connection leaves its last document, the server calls the removal door after the write.
- Copies and exports keep `{ id, app, itemId }`; the index refuses it outside its host and tab.

## Data and persistence

| Table         | Key  | Columns                                                                                                                                                                                | Indexes                                                                                                                                                                                                                 |
| ------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connections` | `id` | `host_item_id`, `host_tab_id` (null while a reverse waits for its app), `target_item_id` (null once purged), `share_code` (null once deleted), `pair_id`, `created_at`, `confirmed_at` | `connections_host (host_item_id, host_tab_id)`, `connections_target (target_item_id)`, `connections_code (share_code)`, `connections_pair (pair_id)`, `connections_unconfirmed (created_at) WHERE confirmed_at IS NULL` |

`host_item_id` cascades from `items`; `target_item_id`, `share_code` (from `share_links`) and `pair_id` (from
`connections`) are set to null when theirs goes. Who made a connection is on the Timeline's `shared` event, not the
row, so closing an account leaves nothing naming them here. `connections` is a child of `items` and of
`share_links`: a migration that rebuilds either ([items.md](items.md#rebuilding-items)) copies it aside and back too.
Migration `0010_connections.sql`, local only (`wrangler d1 migrations apply --local`); CI applies it remotely.

## Errors and edge cases

| Case                                     | Answer                                       |
| ---------------------------------------- | -------------------------------------------- |
| Connecting an item to itself             | `400 connection_self`                        |
| A 51st connected tab                     | `409 connection_limit`                       |
| A role the target's app does not offer   | `400 level_not_offered`                      |
| The target's 101st link                  | `409 share_link_limit`                       |
| Both ways without managing the host      | `403 forbidden`                              |
| The target app's door fails              | `201`, `reverse: { state: 'unreached' }`     |
| A copy's tab, a duplicate, an unknown id | open `404 not_found`; removal `204`, nothing |
| An agent (an app acting for a person)    | make `403 forbidden`; open `404 not_found`   |
| Over 60 opens a minute                   | open `429 rate_limited`                      |
| A confirmed connection taken back        | `204`, nothing                               |
| The target in the Trash or purged        | open `410 connection_target_gone`            |
| The pass deleted or lapsed               | open `410 connection_link_removed`           |

## Security and trust

- The pass's code is answered only by the open door, `no-store`, to a grant for the connection's host and tab, never
  through a public link. No app stores it.
- Making checks the person's token and the host's grant on the index, never a flag from the editor.
- The reverse write is the only write into another app: one shape (`ConnectedTabWrite`), the app's own key, append
  only, idempotent by connection id, capped at `CONNECTIONS_PER_ITEM`, the name from the index's title.
- `href` is built from `packages/sites` and stored ids; a tab's content never names an address.
- Removal deletes only a matching host and tab's row, and only ever takes access away.

## Performance and limits

- Making: three reads (the host, the target, the tab's current connection), one batch of at most eleven
  statements (eight one way), plus one call to the target app and one batch after it when both ways.
- Opening: one indexed read of the row joined to its link and target (and the grant's link when it came through
  one), and one grant check against the index's own cached key.
- The sweep: one indexed read and one batch of three statements, at most 200 rows, every 15 minutes.
- Purges: two statements more per chunk of items, whatever the number of connections.
- Each app's summary reads `tabs.connection` beside `name`, a column under 200 bytes, parsed only when not null; the
  tab body is never read for it.
- `CONNECTIONS_PER_ITEM` 50 bounds every host's rows.

## Testing

| Test                                                    | Pins                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/index-client/src/connections.test.ts`         | the id, the readers keep exactly their fields and refuse the malformed, the column's round trip, the default role, paths                                                                                                                                                 |
| `liveworkspace/apps/index/src/connections.test.ts`      | making (each refusal; roles: a link Editor or Viewer of the host, and a link Editor of the target, may not), both ways (made, unreached, the caps), Connect Again, opening (item, link, gone, removed, copies, scoped and public grants, agents, the limit), taking back |
| `liveworkspace/apps/index/src/connection-doors.test.ts` | the confirm and removal doors (wrong app, host, tab; twice), the pair kept, the sweep, purges of host and target, the Share dialog's mark                                                                                                                                |

Parts 2 to 5 add theirs: the index's routes against each refusal above; each app's column, door, scope redaction and
removal call; the UI's states and roles (Editor, Participant, Viewer each see and open a connected tab; only an Editor
removes or connects).

## Constants and configuration

`CONNECTIONS_PER_ITEM` 50, `CONNECTION_DEFAULT_LEVEL` `'edit'`, `CONNECTION_ID_PREFIX` `'cn_'`,
`TAB_CONNECTION_TEXT_MAX` 512 (`packages/index-client` `connections.ts`). `CONNECTION_REVERSE_TIMEOUT_MS` 5000,
`CONNECTION_CONFIRM_GRACE_MS` one hour, `CONNECTION_SWEEP_MAX` 200, `CONNECTION_OPEN_RETRY_AFTER_S` 60
(`liveworkspace/apps/index/src/config.ts`). One new binding, `CONNECTION_OPEN_LIMITER` (60 a minute; namespace 1109,
staging 2109). No new secret: the reverse write uses each app's `INDEX_KEY`, as revocations do.

## Defaults ledger

- `IDX22`: a connection id is `cn_` and 24 random letters and digits.
- `IDX23`: the open door allows 60 opens a minute per caller.
- `IDX24`: the reverse write waits at most 5 seconds for the target app before taking the reverse back.
- `IDX25`: Connect Again on a tab that still has a connection replaces it, deleting the old pass.
- `IDX26`: a connected tab's name follows the target's title on open; it is not renamed by hand.
- `IDX27`: a connection unconfirmed an hour after it was made is swept with its pass, at most 200 every 15 minutes.
