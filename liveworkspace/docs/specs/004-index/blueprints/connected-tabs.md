# Connected tabs: blueprint

Derived from [connected-tabs.md](../connected-tabs.md). The spec decides; this file adds the engineering detail.
Defaults are cited as `IDXn`. Paths are relative to the repository root.

## Build order

Built in five parts, each its own PR that leaves main working, nothing reachable before its entry point lands:

| Part | What lands                                                                                                                                                                                                                                                        | State   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | This spec and blueprint; the shared contract in `packages/index-client/src/connections.ts` (`TabConnection`, the readers, the doors' paths, the limits and the default role)                                                                                      | on main |
| 2    | The index: the `connections` table, `POST /items/:id/connections`, `GET /connections/:id`, the app's removal door, purges, the pass's mark in `GET /items/:id/share`, the error codes, the index-client calls                                                     | planned |
| 3    | Each app (livediagram, liveplanner, livedocuments, livedesign, livehuddle) keeps a connected tab: the `tabs.connection` column, its summaries and reads, the internal door for the reverse tab, telling the index on removal, scope redaction, copies and exports | planned |
| 4    | The shared UI, not yet mounted: the connected tab in `packages/workbench`'s tab strip, the Connect picker (Recent across apps, the role, both ways) and the opening states, in `packages/explorer` or `packages/workbench`                                        | planned |
| 5    | Every editor mounts it: connected tabs in the tab bar, Connect liveworkspace File at the very bottom of the start screen's sidebar, Remove and Connect Again, help articles, telemetry with its chart                                                             | planned |

## Scope, by file

| File                                                        | Role                                           | Part |
| ----------------------------------------------------------- | ---------------------------------------------- | ---- |
| `packages/index-client/src/connections.ts`                  | the shapes and readers every side shares       | 1    |
| `liveworkspace/apps/index/src/connections.ts`               | the routes: make, open, the app's removal door | 2    |
| `liveworkspace/apps/index/migrations/NNNN_connections.sql`  | the `connections` table                        | 2    |
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

### Making (`POST /items/:id/connections`, the person's token and the host's grant)

Body `ConnectionInput { targetId, tabId, level?, both? }` (`readConnectionInput`; else `400 invalid_body`).

1. The host grant must be the index's own, for this item, at `edit`, not through a public link, its tab (if
   scoped) `tabId`: else `403 forbidden`.
2. `targetId === id`: `400 connection_self`. The target must be live and managed by the person
   (`loadItem(edit, { manage })`): else `404 not_found`.
3. `level` defaults to `connectionDefaultLevel(target app)`; one not in `connectionLevels(target app)` is
   `400 level_not_offered`.
4. The host's connections, counted, under `CONNECTIONS_PER_ITEM`: else `409 connection_limit`. A connection already
   on `(host, tabId)` is replaced (Connect Again): its pass deleted in the same batch.
5. One batch: the pass (`share_links`, `expiry: never`, not public, counted against `SHARE_LINKS_PER_ITEM`:
   `409 share_link_limit`), the `connections` row, the `shared` Timeline event, as any link.
6. `both`: the host must be managed by the person too (`403 forbidden`). The reverse pass and row are written in the
   same batch with `pair_id` set both ways; then `POST <target app>/api/internal/items/:target/connected-tabs`
   (`itemConnectedTabsPath`, the app's `INDEX_KEY`) with `{ name: host title, connection }`. A non-2xx, or no answer
   within 5 s, deletes the reverse row and pass (`reverse: { state: 'unreached' }`); `200 { tabId }` records
   `host_tab_id` on the reverse row.
7. `201 ConnectionMade { connection, name: target title, level, reverse }`.

### Opening (`GET /connections/:id`, the host's grant in `X-Index-Grant`)

Rate limited per caller (IDX23). The grant must verify, be for the row's host, its tab null or the row's
`host_tab_id`, and not through a public link: else `404 not_found`, the same answer as an unknown id. A target in
the Trash or purged: `410 connection_target_gone`. A null or lapsed pass for a reader who does not reach the target
themselves: `410 connection_link_removed`. Else `200 ConnectionOpen`: `via: 'item'` with
`${site}${itemPath}<id>` when the grant's person manages the target, else `via: 'link'` with
`${site}${sharePath}<code>` and the pass's level (`packages/sites` `APP_ITEMS`). `Cache-Control: no-store`.

### Removing (`DELETE /app/items/:id/connections/:cid?tab=` with the host app's key)

`appConnectionPath`. Deletes the row and its pass only when `host_item_id = :id`, `host_tab_id = tab` and the key's
app is the host's; the pass's sessions are told `revoke` as for any deleted link. Anything else, and a second call,
answers `204` and changes nothing. The pair's row keeps its own pass; its `pair_id` is cleared.

### Elsewhere

- `DELETE /share/:code` on a pass sets the row's `share_code` to null, so the tab offers Connect Again.
- Purging an item deletes the rows where it is host or target, and their passes with its links.
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

| Table         | Key  | Columns                                                                                                                  | Indexes                                                                                                                |
| ------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `connections` | `id` | `host_item_id`, `host_tab_id`, `target_item_id`, `share_code` (null once deleted), `pair_id`, `created_by`, `created_at` | `connections_host (host_item_id, host_tab_id)`, `connections_target (target_item_id)`, `connections_code (share_code)` |

Both item columns cascade from `items`; `share_code` is set to null when its link goes.

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

- Making: one batch of at most six statements, plus one call to the target app when both ways.
- Opening: one indexed read of the row joined to its link and target, and one grant check against cached keys.
- Each app's summary reads `tabs.connection` beside `name`, a column under 200 bytes, parsed only when not null; the
  tab body is never read for it.
- `CONNECTIONS_PER_ITEM` 50 bounds every host's rows.

## Testing

| Test                                            | Pins                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/index-client/src/connections.test.ts` | the id, the readers keep exactly their fields and refuse the malformed, the column's round trip, the default role, paths |

Parts 2 to 5 add theirs: the index's routes against each refusal above; each app's column, door, scope redaction and
removal call; the UI's states and roles (Editor, Participant, Viewer each see and open a connected tab; only an Editor
removes or connects).

## Constants and configuration

`CONNECTIONS_PER_ITEM` 50, `CONNECTION_DEFAULT_LEVEL` `'edit'`, `CONNECTION_ID_PREFIX` `'cn_'`,
`TAB_CONNECTION_TEXT_MAX` 512 (`packages/index-client` `connections.ts`). No new secret: the reverse write uses each
app's `INDEX_KEY`, as revocations do.

## Defaults ledger

- `IDX22`: a connection id is `cn_` and 24 random letters and digits.
- `IDX23`: the open door allows 60 opens a minute per caller.
- `IDX24`: the reverse write waits at most 5 seconds for the target app before taking the reverse back.
- `IDX25`: Connect Again on a tab that still has a connection replaces it, deleting the old pass.
- `IDX26`: a connected tab's name follows the target's title on open; it is not renamed by hand.
