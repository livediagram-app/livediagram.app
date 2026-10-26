# Default folders: blueprint

Derived from [one-explorer-contracts.md "Folders, favourites, defaults"](../one-explorer-contracts.md#folders-favourites-defaults).
The spec decides; this file only adds engineering precision, read from the code. Defaults are cited as `IDXn`.
Paths are relative to the repository root.

Scope, by file:

| File                                                | Role                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/personal.ts`          | `GET /placement-defaults`, `PUT`/`DELETE /placement-defaults/:key`        |
| `liveworkspace/apps/index/src/default-placement.ts` | `defaultPlacement`: where a create with no place lands                    |
| `packages/index-client/src/constants.ts`            | `placementDefaultKey`, `placementDimensionKey`, `placementDefaultKeysFor` |

## Domain and naming

| Term        | Identifier                                                                   | Meaning                                                         |
| ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Default key | `<app>`, `<app>:kind:<kind>`, `<app>:template:<family>`, `<app>:mode:<mode>` | One per app and part of a creation intent                       |
| Intent      | `<mode>:<kind>[:<family>]`, or one word (a family)                           | What the item was made as (`draw:diagram`, `plan:board:kanban`) |
| Default     | `placement_defaults (person_id, default_key, folder_id)`                     | Per person; the folder may be a joined team's                   |

## Behaviour and state

### The routes (a person; `401` without)

| Route                             | Effect                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /placement-defaults`         | `{ defaults: [{ key, folderId }] }`, by key, at most 200 (one bounded answer)                                                                                  |
| `PUT /placement-defaults/:key`    | `{ folderId }`: an id (`400 invalid_folder`) of a folder the person can file into (`404 folder_not_found`, revealing nothing); upsert with `updated_at`; `204` |
| `DELETE /placement-defaults/:key` | `204` whether or not it existed                                                                                                                                |

A key is at most 100 characters of `^[A-Za-z0-9][A-Za-z0-9:_.-]*$` (`400 invalid_key`).

### Filing a create (`defaultPlacement`)

Consulted by `POST /items` only when the body has no `folderId` key at all, no `teamId`, and an intent; an explicit
`folderId: null` is the root on purpose.

1. `placementDefaultKeysFor(app, intent)`: split on `:`; one part is a family, else mode, kind, family. Each part
   matching `^[A-Za-z0-9_.-]+$` gives a key, in order kind, template, mode; then the app's own key.
2. One read: the person's defaults among those keys joined to their folders (a folder deleted takes its default with
   it through the cascade).
3. The first key, in order, whose folder's scope the person reaches now wins: `{ folderId, teamId, scope }`. A team
   folder files the item into that team.
4. None: the root of the person's own space.

## Data and persistence

| Table                | Key                        | Indexes                                 | Written by                       | Read by                   |
| -------------------- | -------------------------- | --------------------------------------- | -------------------------------- | ------------------------- |
| `placement_defaults` | `(person_id, default_key)` | `placement_defaults_folder (folder_id)` | `PUT`; merge moves; purge clears | `GET`, `defaultPlacement` |

`folder_id` references `folders (id) ON DELETE CASCADE`; `updated_at` the last write.

## Errors and edge cases

| Case                                 | Behaviour                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- |
| The default's folder deleted         | the default goes with it                                                |
| A team the person has left           | that default skipped; the next key tried                                |
| An intent part with other characters | that part has no key                                                    |
| A guest merged into an account       | defaults the account already has win ([guest-merge.md](guest-merge.md)) |

## Testing

| Test                                                         | Pins                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `liveworkspace/apps/index/src/default-placement.test.ts` (5) | the key order, a gone or unreachable folder, explicit root |
| `liveworkspace/apps/index/src/personal.test.ts` (9)          | the placement defaults routes among folders and favourites |

## Constants and configuration

`DEFAULT_KEY_MAX` 100 (`personal.ts`); the 200-row answer bound (`personal.ts`); `INTENT_PART`
`/^[A-Za-z0-9_.-]+$/` (`packages/index-client/src/constants.ts`).

## Defaults ledger

- `IDX13`: with no working default an item lands at the root of the person's own space, never a team's.
