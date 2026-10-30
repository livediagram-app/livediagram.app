# Items, folders and lists: blueprint

Derived from [one-explorer-contracts.md "Items"](../one-explorer-contracts.md#items) and
["Folders, favourites, defaults"](../one-explorer-contracts.md#folders-favourites-defaults). The spec decides; this
file only adds engineering precision, read from the code. The Worker as a whole (callers, access, grants) is in
[index.md](index.md); defaults are cited as `IDXn` from [DEFAULTS.md](DEFAULTS.md). Paths are relative to the
repository root.

Scope, by file:

| File                                              | Role                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/items.ts`           | Filters and list specs; create, read, update, copy, open, grant; `insertItem`, use days, `sharedWithUpsert`       |
| `liveworkspace/apps/index/src/lists.ts`           | `buildListQuery`, `filterClauses`, `buildMostUsedQuery`, `buildMineCountQuery`, `buildAnyQuery`, `listItems`      |
| `liveworkspace/apps/index/src/rows.ts`            | `ItemRow`, `ITEM_COLUMNS`, `directAccess`, `toItem`, `LIVE_LINK`, `decorate`                                      |
| `liveworkspace/apps/index/src/folders.ts`         | Folder routes, `reachableFolder`, `teamFilter`, `readName`                                                        |
| `liveworkspace/apps/index/src/folder-previews.ts` | `GET /folders/previews`                                                                                           |
| `liveworkspace/apps/index/src/personal.ts`        | Favourites, Hide from Recent (placement defaults: [default-folders.md](default-folders.md))                       |
| `liveworkspace/apps/index/src/visitors.ts`        | Opened and Copied by a Visitor                                                                                    |
| `liveworkspace/apps/index/src/notices.ts`         | `tellApp`, the first-visit check, `GET /app/people/:id/count`                                                     |
| `packages/index-client/src/client.ts`             | `listItems`, `createItem`, `getItem`, `updateItem`, `copyItem`, `recordOpen`, `grant`, folder and favourite calls |

## Domain and naming

| Term    | Identifier                                                                           | Meaning                                                                 |
| ------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| View    | `ITEM_VIEWS`: `all`, `recent`, `favourites`, `shared`, `trash`, `unsorted`, `search` | Which list                                                              |
| Filters | `ListFilters { apps, words, source, since, owner, intent, modes, space }`            | The Explorer's lens; values of one combine with or                      |
| Source  | `ITEM_SOURCES`: `person`, `ai`, `import`, `template`                                 | How it was made                                                         |
| Intent  | `<mode>:<kind>[:<family>]`, ≤ 100 chars                                              | What it was made as; its last word is the `intent` filter               |
| Use day | `use_days (person, item, day, opens)`                                                | A UTC day the person opened or edited it, and how many opens: Most Used |
| Open    | `opens (person, item, last_opened_at, hidden)`                                       | Recent; `hidden = 1` is Hide from Recent                                |

`Item` on the wire: `{ id, app, kind, title, ownerId, teamId, folderId, source, intent, createdAt, updatedAt,
trashedAt, trashReason, summary, access, favourite, lastOpenedAt, hiddenFromRecent, hasLinks, sharedVia }`.
`Folder`: `{ id, name, parentId, teamId, ownerId, createdAt, updatedAt }`.

## Behaviour and state

### Making an item (`POST /items`), in order

1. A body object; `app` an `App` (`400 invalid_app`); a delegate may make only its own app (`403 wrong_app`).
2. `title` absent is `Untitled`; else trimmed, 1 to 500 (`400 invalid_title`).
3. `teamId`, `folderId` an id or null (`invalid_team`, `invalid_folder`); `id` if sent an id (`invalid_body`);
   `intent` a string ≤ 100; `source` one of `ITEM_SOURCES`.
4. A team must be joined now (`403 not_team_member`); a folder must be in the item's scope (`404 folder_not_found`).
5. No `folderId` key, no team and an intent: the person's default folder ([default-folders.md](default-folders.md)).
6. No signing key: `503 grants_unavailable` before any row.
7. `insertItem`: the row and its `created` event (`synced` when `synced: true`, an offline item put back) in one
   batch; a taken id is `409 item_exists`. A non-`person` source puts `{ source }` in the event's detail.
8. `201 { item, grant }` (an `edit` grant for the maker); logged `[index] created { app, team, filed }`.

### Reading and changing

| Route                   | Need             | Effect                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /items/:id`        | `view`           | `{ item, tabId, publicCode }` (the tab a link confines to; the public code when that is the way in)                                                                                                                                                                                                                                                               |
| `PATCH /items/:id`      | `edit`           | `title` (trimmed ≤ 500); `folderId`, `teamId` only for owner or team (`403` through a link). Into or out of a team needs both teams joined; leaving one makes it the mover's own; changing team clears the folder. A rename moves `updated_at`; a move doesn't. Events: `renamed { from }`, `moved { folderName, teamId }` after moving its events' scopes.       |
| `POST /items/:id/copy`  | `view`, a person | New row `"<title> (copy)"` (≤ 500) or `title`; own or team's stays in place, a link's lands in the root of the copier's space; `created { copiedFrom }`; then the app's `POST /items/:from/copy-to/:to { tabId, by, code, ip }`. The app failing deletes the row: `502 copy_failed`. Through a link: `copied_by_visitor` on the owner's Timeline. `201 { item }`. |
| `POST /items/:id/open`  | `view`           | `204`. No person: nothing. Debounced per isolate (60 s, 5,000 keys) and in SQL (`opens` rewritten only after 60 s); the day's open counted (`use_days` upserted, `opens + 1`), pruned once a UTC day per person to the last 14 days. Through a non-public link: `shared_with` upserted and, the first time, the app told `{ type: 'joined', personId, level }`.   |
| `POST /items/:id/grant` | `view`           | `mintGrant` with `sub` the person or `link:<code>`, `trashed` and `link` set; `503` without a key; through a non-public link, `opened_by_visitor` once per visitor, item and UTC day                                                                                                                                                                              |

`DELETE /items/:id` and `POST /items/:id/restore` are in [trash.md](trash.md).

### Lists (`GET /items?view=`, `GET /trash`)

`parseListSpec`: `app` (`invalid_app`), `limit` 1 to 200 (default 50), `cursor` (`invalid_cursor`), `team`
(`personal`, a joined team, or all), `folder` (an id the person can file into, else `404 folder_not_found`), `deep=1`
with a folder only, the filters, `used` 1 to 8 on `recent`, `mine` 1 to 200, `any=1` (never the mirror). The mirror's
lists are its personal scope only.

| View         | From                                             | Where                                                         | Sort                       |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------- | -------------------------- |
| `all`        | `items i`                                        | the scopes (or `folder_id =` / the subtree with `deep`), live | `updated_at DESC, id DESC` |
| `unsorted`   | `items i`                                        | the scopes, live, `folder_id IS NULL`                         | the same                   |
| `trash`      | `items i`                                        | the scopes, trashed                                           | the same                   |
| `search`     | the scopes' live items `UNION` live links' items | live                                                          | the same                   |
| `recent`     | `opens o JOIN items i`                           | the person, `hidden = 0`, live, reachable                     | `last_opened_at DESC`      |
| `favourites` | `favourites f JOIN items i`                      | the person, live, reachable                                   | `updated_at DESC`          |
| `shared`     | `shared_with` and live `share_links`             | the person, live, not in their own scopes                     | `updated_at DESC`          |

Filters (`filterClauses`): each search word (≤ 16 words, ≤ 200 chars) in the title or the name of one of the
person's folders (`LIKE` with `\` escapes); `apps`, `source`, `intent` (`intent = w OR intent LIKE '%:' || w`, each
`^[a-z0-9-]{1,32}$`) up to 8 values; `modes` (the same word rule, up to 8: `json_extract(i.summary, '$.mode')` in
the list, the mode the item's app last reported, such as livediagram's `diagram`, `draw`, `workshop`; read from the
row the page already holds, so no index); `since` (`updated_at >=`); `owner` `me`/`others`; `space` (`mine`, `shared`,
`team:<id>`, teams joined now else `403 not_team_member`). The answer is `{ items, nextCursor }` plus, on a first
page: `mostUsed` (items opened in the last 14 days with `useOpens` and `useDays`, by opens in the window, then last open,
then id, hidden ones left out), `mine { count, more }` (the live items in every scope the person has: their own and
each joined team's, each item in one scope so counted once) and `any`. One batch; the page and Most Used decorated together.

### Folders

| Route                               | Effect                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /folders?team=&limit=&cursor=` | the scopes' folders by `created_at, id` ascending, `limit` default 200                                                                                                  |
| `POST /folders`                     | `name` trimmed 1 to 500 (`invalid_name`); `id` optional (`409 folder_exists`); `teamId` joined; `parentId` in the same scope (`404 folder_not_found`); `201 { folder }` |
| `PATCH /folders/:id`                | the whole body checked first; a move's cycle check is inside its `UPDATE` (a recursive walk up), `409 cycle`; then the name                                             |
| `DELETE /folders/:id`               | its folders and items move up to its parent, then it goes; `204`                                                                                                        |
| `GET /folders/previews?ids=&app=`   | ≤ 60 ids of the person's folders; per folder its 4 newest live items and a count capped at 1000; one batch                                                              |

Every folder route needs a folder the person can file into (their own scope or a joined team's), else `404`.

### Favourites and Hide from Recent

- `GET /favourites` pages `{ favourites: [{ itemId, createdAt }], nextCursor }`, newest first.
- `PUT /favourites/:itemId`: the item must be reachable (`404` otherwise, as missing); `INSERT OR IGNORE` and a
  `favourited` event on the person's own scope only, written only when the row is new and the item reachable.
- `DELETE /favourites/:itemId`: `204`.
- `PUT /recent-hidden/:itemId`: `opens` row with `hidden = 1` (`last_opened_at 0` if never opened).
- `DELETE /recent-hidden/:itemId`: removes a never-opened row, else clears `hidden`.

## Data and persistence

| Table        | Key                         | Indexes                                                                                                                                                                                                                                                                                                                                   | Written by                                                          | Read by                             |
| ------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `items`      | `id`                        | `items_live (scope, updated_at DESC, id DESC) WHERE live`; `items_live_app (scope, app, …) WHERE live`; `items_trash … WHERE trashed`; `items_unsorted … WHERE live AND folder_id IS NULL`; `items_folder (folder_id, …) WHERE folder_id IS NOT NULL`; `items_trashed_at`; `items_empty (updated_at) WHERE live AND empty`; `items_owner` | create, update, delete, restore, copy, summary push, merge, purges  | every list, access, Inbox, Timeline |
| `folders`    | `id`                        | `folders_scope (scope, created_at, id)`; `folders_parent`; `folders_owner`                                                                                                                                                                                                                                                                | folder routes, merge, purge                                         | lists, search, defaults, previews   |
| `favourites` | `(person_id, item_id)`      | `favourites_person_created (person_id, created_at DESC, item_id DESC)`; `favourites_item`                                                                                                                                                                                                                                                 | favourites, merge, purge                                            | `favourites` view, `decorate`       |
| `opens`      | `(person_id, item_id)`      | `opens_recent (person_id, last_opened_at DESC, item_id DESC) WHERE hidden = 0`; `opens_item`                                                                                                                                                                                                                                              | open, Hide from Recent, merge                                       | `recent`, Most Used, `decorate`     |
| `use_days`   | `(person_id, item_id, day)` | `use_days_person_day (person_id, day)`; `use_days_item`                                                                                                                                                                                                                                                                                   | open (`opens + 1`), `edited` reports (the day only), merge (summed) | Most Used                           |

`items` columns: `id`, `app` (CHECK the four), `kind` (CHECK the four), `owner_id`, `team_id`, `scope`, `folder_id`
(`ON DELETE SET NULL`), `title`, `source` (CHECK), `intent`, `summary` (JSON ≤ 2 KB, default `'{}'`), `created_at`,
`updated_at`, `trashed_at`, `trash_reason` (CHECK `deleted`/`empty`), `empty_swept_for`. Foreign keys from
`favourites`, `opens`, `use_days` cascade.

## Errors and edge cases

| Case                               | Answer                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| A link editor moving an item       | `403 forbidden` (rename only)                              |
| A folder in another scope          | `404 folder_not_found`                                     |
| A folder move into its own subtree | `409 cycle`, even with two crossing moves                  |
| Starring an item out of reach      | `404`, as a missing id                                     |
| The app can't copy                 | the row deleted, `502 copy_failed`                         |
| A public link's visitor            | not added to Shared, no visitor events, the owner not told |

## Performance and limits

A page is one statement on an index starting with the person, a scope or a folder; `search` gathers the reachable ids
first. Decoration is one batch of four statements. Home's three reads (`used`, `mine`, `any`) ride on the first page.
A folder preview is two statements for up to 60 folders.

## Testing

| Test                                                       | Pins                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/items.test.ts` (35)          | who gets in; making and reading; renaming and moving; the Trash; copies; opens; grants; tokens |
| `liveworkspace/apps/index/src/lists.test.ts` (17)          | views and filters (the `modes` lens included); search; query plans; at 2,000 items             |
| `liveworkspace/apps/index/src/home-reads.test.ts` (5)      | Home's reads beside the first page, and their bound                                            |
| `liveworkspace/apps/index/src/most-used.test.ts` (8)       | recording use days; Most Used beside Recent; the bound; Hide from Recent                       |
| `liveworkspace/apps/index/src/personal.test.ts` (9)        | folders, tags, favourites, placement defaults                                                  |
| `liveworkspace/apps/index/src/folder-previews.test.ts` (4) | `GET /folders/previews`                                                                        |
| `liveworkspace/apps/index/src/visitors.test.ts` (2)        | visitors on the Timeline                                                                       |
| `liveworkspace/apps/index/src/notices.test.ts` (6)         | notices; a person's count of items made                                                        |

## Constants and configuration

`LIST_LIMIT_DEFAULT` 50, `LIST_LIMIT_MAX` 200, `TITLE_MAX` 500, `FOLDER_NAME_MAX` 500, `SEARCH_MAX` 200,
`SEARCH_WORDS_MAX` 16, `FILTER_VALUES_MAX` 8, `INTENT_WORD` `/^[a-z0-9-]{1,32}$/`, `OPEN_DEBOUNCE_MS` 60 s,
`USE_WINDOW_DAYS` 14, `MOST_USED_MAX` 8, `FOLDER_PREVIEW_IDS_MAX` 60, `FOLDER_PREVIEW_ITEMS` 4,
`FOLDER_PREVIEW_COUNT_CAP` 1000 (`packages/index-client/src/constants.ts`); `INTENT_MAX` 100, `ID_MAX` 128,
`OPEN_MEMORY_MAX` 5,000 (`liveworkspace/apps/index/src/config.ts`); `DEFAULT_TITLE` `'Untitled'` (`items.ts`).

## Defaults ledger

- `IDX4`: a copy reached through a link lands at the root of the copier's own space, in no team.
- `IDX5`: a move leaves `updated_at` alone; only a rename or a content push moves it.
