# Connected tabs: blueprint

Derived from [connected-tabs.md](../connected-tabs.md). The spec decides; this file adds the engineering detail.
Defaults are cited as `IDXn`. Paths are relative to the repository root.

## Build order

Built in five parts, each its own PR that leaves main working, nothing reachable before its entry point lands:

| Part | What lands                                                                                                                                                                                                                                                        | State   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | This spec and blueprint; the shared contract in `packages/index-client/src/connections.ts` (`TabConnection`, the readers, the doors' paths, the limits and the default role)                                                                                      | on main |
| 2    | The index: the `connections` table, `POST /items/:id/connections`, `GET /connections/:id`, the take-back, the app's confirm and removal doors, the sweep, purges, the pass's mark in `GET /items/:id/share`, the error codes, the index-client calls              | on main |
| 3    | Each app (livediagram, liveplanner, livedocuments, livedesign, livehuddle) keeps a connected tab: the `tabs.connection` column, its summaries and reads, the internal door for the reverse tab, telling the index on removal, scope redaction, copies and exports | on main |
| 4    | The shared UI, not yet mounted: the connected tab in `packages/workbench`'s tab strip, the Connect picker (Recent across apps, the role, both ways), the opening states and the Share dialog's "Connected from", in `packages/workbench` and `packages/explorer`  | on main |
| 5    | Every editor mounts it: connected tabs in the tab bar, Connect liveworkspace File at the very bottom of the start screen's sidebar, Remove and Connect Again, help articles, telemetry with its chart                                                             | on main |

## Scope, by file

| File                                                        | Role                                           | Part |
| ----------------------------------------------------------- | ---------------------------------------------- | ---- |
| `packages/index-client/src/connections.ts`                  | the shapes and readers every side shares       | 1    |
| `liveworkspace/apps/index/src/connections.ts`               | the routes: make, open, take back              | 2    |
| `liveworkspace/apps/index/src/connection-doors.ts`          | the app's confirm and removal doors, the sweep | 2    |
| `liveworkspace/apps/index/src/connection-rows.ts`           | dropping connections, purges' statements, href | 2    |
| `liveworkspace/apps/index/src/own-grants.ts`                | checking a grant the index signed              | 2    |
| `liveworkspace/apps/index/migrations/0010_connections.sql`  | the `connections` table                        | 2    |
| `packages/index-app/src/connected-tabs.ts`                  | the column, the reverse write, confirm, remove | 3    |
| `packages/index-app/src/internal.ts` (`connectedTab`)       | the internal door for the reverse tab          | 3    |
| `<app>/apps/api/src/<room>/<item>-schema.ts`                | `tabs.connection`, a schema step in each app   | 3    |
| `<app>/apps/api/src/<room>/connected-tab.ts`                | each app's reverse tab and its room op         | 3    |
| `packages/workbench/src/components/chrome/ConnectedTab.tsx` | the tab: the target app's logo and name        | 4    |
| `packages/workbench/src/components/connect/`                | the tab's page, the Connect list, their calls  | 4    |
| `packages/explorer/src/dialogs/share/ActivePass.tsx`        | "Connected from <host>" on a pass              | 4    |
| `packages/workbench/src/components/connect/` (part 5 files) | mounting: the page, the list, the store, doors | 5    |
| `<app>/apps/<editor>/components/connect/`                   | each editor's thin doors: host, start entry    | 5    |

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

The shared part is `packages/index-app` `connected-tabs.ts`; each app binds it to its own tables and room.

- **The column.** `tabs.connection TEXT NULL`, the `tabConnectionText` of the tab's connection, added by a schema step
  in the item's Durable Object SQLite (`TAB_CONNECTION_SCHEMA`, a plain `ALTER`, run once by the schema's version
  row; the apps have no D1, so no migration file). Read with `parseTabConnectionText` (`storedTabConnection`) into
  `TabSummary.connection` and the full tab's `connection` (the wire shape `TabConnectionWire`,
  `@liveworkspace/api-schema/tab-connection`); never in `tabs.data`: every body write drops a `connection` field.
- **The editor's add.** Each app's editor adds a tab with the whole-tab save (`PUT /api/<items>/:id/tabs/:tabId`),
  which a token never makes. Its `connection` (`tabConnectionOf`, exactly `{ id, app, itemId }`) is kept, in the same
  batch as the body, onto a tab that is new or already connected (Connect Again, `connectionToKeep`), never onto a tab
  of content; left out, the stored one stays. A connection that differs from the stored one is confirmed to the index
  after the write (`confirmTabConnection`, `confirmConnection(host, cid, tabId)`, off the response path). The answer
  echoes the tab's connection.
- **The reverse write.** `POST /api/internal/items/:id/connected-tabs` (`handleInternalItems`' `connectedTab`, the
  index's key alone) reads `readConnectedTabWrite`, else `400`. `appendConnectedTab` makes one read (the tab already
  holding this connection id, the number of connected tabs, the next place) and one batch: an empty tab named `name`,
  loose, at the end, stored as the app stores any new tab, then its column. The same connection id answers `200
{ tabId }` and adds nothing; past `CONNECTIONS_PER_ITEM`, `409 connection_limit`; an item not started `404`; a
  failure `503`; else `201 { tabId }`. The room then sends its tab outline as an ordered `document-meta` op (each
  app's own outline op), carrying the tab's connection, so open editors place it.
- **Removing.** The tab delete (`DELETE /api/<items>/:id/tabs/:tabId`) reads the tab's connection with its body in
  the delete itself and, once the tab has left, tells the index (`tellConnectionLeft`, `removeConnection`), off the
  response path. One item per Durable Object, so a tab leaving its item has left its last one.
- **Redaction.** A tab outside a tab-scoped visitor's scope drops `connection` with its name (the document read and
  the room's outline op are rebuilt from id and position alone). A Community visitor's document and tab reads drop
  it, and a copy through a Community link keeps none.
- **Never elsewhere.** `createTabShares`' `copyOf` answers a connected tab as no such tab, so it is never shared into
  another item. Its body is empty, so it renders nothing and counts nothing in stats. Changesets and agent writes
  never touch the column; a token's create drops it.
- **Copies and exports.** The copy door, the Drive file's envelope and its import, and an editor's create (an Offline
  Mode sync) keep exactly `{ id, app, itemId }` in the column; the index refuses it outside its host and tab.

### The shared UI (part 4)

Built in `packages/workbench`, mounted by no screen until part 5. Every module is a subpath, no barrel.

- **`components/chrome/ConnectedTab.tsx`**: the tab. `TabFrame` with `lead` (a new slot before the name, drawn at
  full opacity, unlike `lockIcon`) holding the target app's `BrandMark` at `size-3.5`; `afterName` holding the
  arrow (`lucideArrowUpRight`, 11px) when `connection.app !== hostApp`, else nothing, or the amber dot when
  `broken`; an `sr-only` phrase after the name (`connectedTabPhrase`). No `onRequestRename` (IDX26). `menu`,
  `presence`, `caret`, `dragging` and `dragHandlers` pass through, so a connected tab drags, folders and shows
  avatars as any tab.
- **`components/connect/ConnectedTabCard.tsx`**: the tab's page, one card per `ConnectedTabView` (`opening`,
  `opened`, `gone`, `link_removed`, `copy`, `offline`, `failed`) with the spec's words (`connectedTabCopy`) and
  actions. `canEdit` (the session's `can('edit')`, never `readOnly` alone) shows Remove and Connect Again; Open Again
  (an anchor, `target="_blank" rel="noopener"`) and Try Again are everyone's. The logo turns while opening
  (`BrandMark spinning`), still under reduced motion.
- **`components/connect/connected-tab-view.ts`**: `connectedTabViewOf(error)` maps the open door's refusal
  (`IndexError`): `410 connection_target_gone` to `gone`, `410 connection_link_removed` to `link_removed`,
  `404 not_found` to `copy`, anything else to `failed`. `connectedTabCopy(view, name, app)` gives each state's title
  and line.
- **`components/connect/open-connected-tab.ts`**: `openConnectedTab` asks `openConnection(id, grant)` and, given the
  answer, goes there: the same app by `location.assign`, another by `window.open(href, '_blank', 'noopener')`. It
  answers the view to show (`opened` with the href, or the refusal's) and the name the index answered, so an
  Editor's editor can rename the tab to match (IDX26).
- **`components/connect/connect-file.ts`**: `connectFile` runs one connect: `makeConnection(host, { targetId,
tabId, level, both }, grant)`, then the app's `addTab(made)` (its whole-tab save); when `addTab` throws it calls
  `takeBackConnection(made.connection.id, grant)` (#571), ignoring that call's own failure, and throws the first
  error. It answers the `ConnectionMade` so the app can say when the reverse was `unreached`.
- **`components/connect/connect-words.ts`**: the picker's words: `connectRoleLine(level, hostKind)`,
  `bothWaysLine`, `rowBlock(item, level)` (why a row cannot be picked: not managed, "Only its owner can share it";
  the role not offered, "<app> has no <Role> role"; else null), `connectErrorWords(error, hostKind)` for each
  refusal (`connection_limit`, `share_link_limit`, `forbidden`, `level_not_offered`, `connection_self`,
  `rate_limited`, `not_found`, else the network line).
- **`components/connect/useRecentFiles.ts`**: one `listItems({ view: 'recent', limit: CONNECT_RECENT_LIMIT })`
  with no `app`, so every app's items come back, newest first; the host left out. States `loading`, `ready`,
  `failed` with `retry`. An unmount aborts it.
- **`components/connect/ConnectPicker.tsx`**: the list in a start panel's content area, painted from `ink` (the
  start panel's palette: `text`, `muted`, `border`, `surface`, `column`, `accent`) through CSS variables, else the
  app's light or dark look. The role is a `radiogroup` of three (`ConnectRolePicker`), Editor chosen; the both-ways
  `SwitchRow`, disabled with its reason when `hostManaged` is false; Find a file (a plain substring match on the
  lower-cased title, no regex); then the rows (`ConnectRow`). One connect at a time: while a row is busy every other
  row is `aria-disabled`. A row in `connected` (a `Map<itemId, tabId>` from the host's tabs) shows Connected and
  calls `onGoTo(tabId)`.

Accessibility (part 4): the tab is a plain button in the strip's toolbar like any tab, its app and where it opens in
its `sr-only` phrase. The role picker is a `radiogroup` (the arrows, Home and End move and choose); the both-ways
switch is the house `SwitchRow`, its reason in `aria-describedby`; each row is one button named by the file, its app
and its state, `aria-disabled` with the reason in its description when it cannot be picked; a connect in progress is
`aria-busy`; a failure and an empty filter are announced (`role="status"`). Every word on the tinted paper is
checked at 4.5:1 by the start panel's own palette; the default look uses slate 600 (light) and 400 (dark) muted ink.
The logo's turn and the rows' placeholders stop under `prefers-reduced-motion`.

Testing for part 4 is in `packages/workbench`: `connected-tab-view.test.ts`, `connect-words.test.ts`,
`connect-file.test.ts`, `open-connected-tab.test.ts`, `ConnectedTab.test.tsx`, `ConnectedTabCard.test.tsx` (each
state; Editor, Participant and Viewer), `ConnectPicker.test.tsx` (loading, empty, failed, rows, blocked rows, the
role, both ways, the filter, busy, a failure on the row, Connected going to its tab), and in `packages/explorer`
the Share dialog's "Connected from" line.

### The editors (part 5)

Every editor mounts the shared UI through thin doors of its own; the shared parts are in `packages/workbench`
`components/connect/`, each a subpath.

- **`tab-connection.ts`**: the connection rides on an editor's own tab object as the wire carries it (`TabRecord` and
  `TabSummary` `connection`, the outline op's), so a whole-tab save sends it back untouched and no document package
  changes. `connectionOf(tab)` reads exactly `{ id, app, itemId }` (`readTabConnection`), `withConnection` puts one
  on, `carryConnection(tab, summary)` brings a summary's onto a placeholder or a local tab (a summary without one, an
  agent's rename relay, leaves the tab's own), `connectedTargets(tabs)` is the Connect list's Connected map.
- **`connected-tab-store.ts`**: one page-wide store. `pickConnectedTab(tabId)` records a person's press on a connected
  tab (`ConnectedTab` calls it before the bar's select, so pressing the open tab opens it again); a page acts on a
  press it has not seen, or on one made under `CONNECTED_PICK_FRESH_MS` (10 s) before it mounted (its code loads on the
  first one). `setConnectedTabBroken(connectionId, broken)` holds what the last open found, for the tab's amber dot
  (`ConnectedTab` reads it when no `broken` is passed) and its menu's Connect Again (`connectedTabBroken`).
- **`ConnectedTabPage.tsx`**: in the canvas's place while the open tab is connected. Starts `ready` (Open), or
  `opening` for a fresh press, or `offline` for a This Browser host. Each open aborts the one before, asks the host's
  grant, runs `openConnectedTab`, marks the tab broken or mended, shows the answer's view and, for an Editor
  (`canEdit`: may change the tabs), renames the tab to the answered name (IDX26). Keyed by tab and connection id, so
  Connect Again starts it afresh. `Tab·Opened·Connected` per open.
- **`ConnectFilePanel.tsx`**: the start panel's content once Connect liveworkspace File is chosen: a heading over
  `ConnectPicker`, painted with the start palette (`accent` the palette's chosen label colour). Mounted only then, so
  the one `listItems` waits for the choice. `useTickingNow` (one `setInterval`, `CONNECT_CLOCK_MS` 60 s, cleared on
  unmount) keeps "Opened 2 minutes ago" true. A press: the host's grant, a tab id from the editor, `connectFile` with
  the editor's add, `Tab·Added·Connected` or `·ConnectedBoth`, then `onConnected`.
- **`ConnectRailEntry.tsx`**: the rail's last row, stuck to its bottom under a hairline (`sm:sticky sm:bottom-0
sm:mt-auto` inside the rail's scroller), the other apps' logos fanned at its end; on a phone, the last chip.
- **`useConnectedTabActions.ts`**: the doors every editor shares, generic over its tab type: `grant` (stable), the
  `connected` map, `addConnectedTab(made, tabId, replacing?)` (the app's whole-tab save awaited, then one commit
  appending the tab and dropping the empty start tab `replacing` unless it is the only one), `showConnected` (the new
  tab opens, ready; an `unreached` reverse is a toast, `reverseUnreachedWords`), `connectAgainTab(tabId)`
  (`connect-again.ts`: the target app's default role, one way, the save, a success or `connectErrorWords` toast,
  `Tab·Added·ConnectedAgain`) and `goTo`.
- **Each editor** (`<editor>/components/connect/`): `ConnectedTabHost` (the page through `next/dynamic`, from the
  editor's context: `canEdit` is `!isStructureReadOnly`, Remove is its tab delete, the rename its tab rename) and
  `useConnectStart` (the start panel's `connect` render through `next/dynamic`, or nothing when the person is a guest,
  the item is a This Browser one, or the session may not change its tabs: a viewer, a tab-scoped link, an embed, a
  workbench). `hostManaged` is a session with no share link (its owner or a team member). Its editor state adds
  `activeTabConnected` (an edit blocker beside the tab lock) and `connectedTabs`; its view shows `ConnectedTabHost` in
  the canvas's place; its start screens stand down on a connected tab; its placeholders and outline op carry the
  connection; its tab pill draws `ConnectedTab`; its tab menu's connected mode keeps Remove Tab, Organise in Tab Folder
  and Connect Again (when broken); its Duplicate refuses a connected tab.

Part 5's tests: the shared modules' (`tab-connection.test.ts`, `connected-tab-store.test.ts`,
`ConnectedTabPage.test.tsx`: ready, a fresh and a stale press, the rename for an Editor only, broken and mended,
offline, `ConnectFilePanel.test.tsx`, `ConnectRailEntry.test.tsx`, `useConnectedTabActions.test.tsx`: the add, the
replace, the toast, Connect Again and its failure) and each editor's (the outline op keeps and carries a connection,
the tab menu's connected mode for an Editor, nothing for a Viewer).

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
- Each app's tab save adds no read (the stored tab is already read for its revision) and one statement to its batch
  only when it carries a connection; a tab delete reads the connection in its own `RETURNING`. The reverse write is
  one read of three scalar subqueries over the item's tabs (at most a few hundred rows, the connection id matched with
  `json_extract` only on the non-null rows) and one batch.
- `CONNECTIONS_PER_ITEM` 50 bounds every host's rows.

## Testing

| Test                                                    | Pins                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/index-client/src/connections.test.ts`         | the id, the readers keep exactly their fields and refuse the malformed, the column's round trip, the default role, paths                                                                                                                                                 |
| `liveworkspace/apps/index/src/connections.test.ts`      | making (each refusal; roles: a link Editor or Viewer of the host, and a link Editor of the target, may not), both ways (made, unreached, the caps), Connect Again, opening (item, link, gone, removed, copies, scoped and public grants, agents, the limit), taking back |
| `liveworkspace/apps/index/src/connection-doors.test.ts` | the confirm and removal doors (wrong app, host, tab; twice), the pair kept, the sweep, purges of host and target, the Share dialog's mark                                                                                                                                |

| `packages/index-app/src/connected-tabs.test.ts` | the reverse write (appended once, the cap, a fresh id), the column, what a save keeps, confirm and removal calls, the door's answers |
| `packages/index-app/src/tab-shares.test.ts` | a connected tab is never shared into another item |
| `<app>/apps/api/src/routes/connected-tabs.test.ts` | each app: the save keeps and confirms, autosave and Connect Again, a tab of content refused, removal told, a token's create, the reverse write and its room op, scope and Community redaction, copies and the Drive file, the roles (Editor adds and removes; all read) |

Parts 4 and 5 add theirs: the UI's states and roles (Editor, Participant, Viewer each see and open a connected tab;
only an Editor removes or connects).

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
- `IDX36`: a connected tab opens its file only on a person's press (its tab, or Open on its page); shown any other
  way it waits, ready.
- `IDX37`: connecting from an empty tab's start screen replaces that tab, unless it is the item's only tab.
- `IDX35`: the Connect list shows the person's 40 most recent items across every app (`CONNECT_RECENT_LIMIT`,
  `packages/workbench` `connect/useRecentFiles.ts`), enough to fill the start panel twice without paging.
