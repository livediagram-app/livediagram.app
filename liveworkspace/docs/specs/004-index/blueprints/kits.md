# Project kits: blueprint

Derived from [kits.md](../kits.md). The spec decides; this file adds the engineering detail. Paths are relative to
the repository root.

## Scope, by file

| File                                                            | Role                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/index-client/src/kits.ts`                             | the catalogue (`KITS`), the run's wire shapes and readers, `kitPassLevel` |
| `packages/index-client/src/client.ts` (`startKit`, `removeKit`) | the browser's two calls                                                   |
| `liveworkspace/apps/index/src/kits.ts`                          | `POST /kits` and `POST /kits/remove`: the folder, the items, removal      |
| `liveworkspace/apps/index/src/kit-connections.ts`               | every part connected to every other, both ways                            |
| `packages/index-app/src/template-item.ts`                       | the apps' shared door: the template's file through the import's path      |
| `packages/index-app/src/internal.ts` (`fromTemplate`)           | `POST /api/internal/items/from-template`                                  |
| `<app>/apps/api/src/routes/internal-template.ts`                | each app's file of a template, and its catalogue test                     |
| `liveworkspace/apps/site/app/kits/page.tsx`                     | the page at `/kits`                                                       |
| `liveworkspace/apps/site/components/kits/`                      | the kit screen: the picker, the setup, the run's states                   |
| `packages/explorer/src/hero/WorkKinds.tsx`                      | Home's **Start a Project** link under All Apps                            |

## The run on the wire

`POST /api/index/kits`, the person's own token. Body `KitStartInput` (`readKitStartInput`, else `400 invalid_body`):

```ts
{ kit: KitId; level: Level; name: string; folderId?: string; made?: Record<slot, itemId> }
```

`folderId` and `made` come only with a retry. Answer `200 KitRun`:

```ts
{
  folderId: string;
  parts: {
    slot;
    app;
    itemId: string | null;
  }
  [];
  connections: {
    made: number;
    failed: number;
  }
  complete: boolean;
}
```

`complete` is every part made and every connection standing. `POST /api/index/kits/remove` takes
`{ folderId, made }` and answers `204`.

## Making a run (`liveworkspace/apps/index/src/kits.ts`)

1. A person by their own token (`401` without); a guest is `403 sign_in_required`; an app acting for a person
   (`person.app`, `drive`, `export`) is `403 forbidden`.
2. The kit, the level (`LEVELS`) and the name (`KIT_NAME_MAX`, 60, trimmed, not empty) are read whole before anything
   is written.
3. The folder: a retry's `folderId` must be a folder in the person's personal scope (`404 folder_not_found` else);
   otherwise a new one is inserted at the top of their personal tree, as `POST /folders` makes one.
4. A retry's `made`: each id kept only when its row is live (not trashed, not archived), owned by the person, in the
   folder and of the slot's app. Anything else is made again.
5. The missing parts, all at once (`eachLimited`, `APP_CALL_CONCURRENCY`): `POST <app>/api/internal/items/from-template`
   with the app's `INDEX_KEY` (`callAppForJson`), `{ owner, folderId, name: "<project> <part>", template }`, waiting
   at most `KIT_CREATE_TIMEOUT_MS` (20 s). A `201 { id }` whose row the index now holds, owned by the person in the
   folder, is made; anything else is a failed part, logged with its app and status.
6. The connections (`kit-connections.ts`): the made parts' existing confirmed connections among themselves are read in
   one query; for every ordered pair `(host, target)` without one, in the kit's order:
   - one batch: the pass on the target (`insertPass`, at `kitPassLevel(target app, level)`), the row
     (`insertConnection`, `host_tab_id` null), the target's `shared` event, and, when both directions are new, the two
     rows' `pair_id`s;
   - `POST <host app>/api/internal/items/:host/connected-tabs` (`ConnectedTabWrite { name: target title, connection }`,
     `CONNECTION_REVERSE_TIMEOUT_MS`), the connected tabs' reverse write; a tab id sets `host_tab_id` and
     `confirmed_at`; anything else drops the row and its pass (`dropStatements`) and counts as failed.
     Each host's tabs are written one after another, in the kit's order, so its tab bar reads in that order; hosts run
     at once.
7. No first-share notice goes to the apps (`tellApp`): the person shared their own items with each other, so nobody
   new is in.

## Removing (`POST /kits/remove`)

Same identity rules. The folder must be the person's personal folder; every id in `made` must be the person's own
item in it (others are skipped, never touched). The items are purged as a permanent delete is (`purgeRows`, with the
person as actor, then `drainTombstonesSoon` in `waitUntil`), which drops their connections and the passes they hosted;
then the folder is deleted when it holds no item and no folder.

## The apps' door

`handleInternalItems` routes `POST /api/internal/items/from-template` (the index's key alone) to
`handlers.fromTemplate(TemplateInput)`:

- body `{ owner, folderId, name, template }`: `owner` an account id, `folderId` an id or null, `name` 1 to
  `IMPORT_NAME_MAX`, `template` 1 to 100 characters; else `400`.
- `{ status: 'ok', id }` is `201 { id }`; `unknown_template` is `404 { error: 'unknown_template' }`; a throw is `503`.

`itemFromTemplate` (`template-item.ts`) is the whole handler bar the app's two parts: the file of a template
(`fileOf(template, name)`, the app's envelope text, null for an unknown kind) and the app's import
(`importXFor(env, input, 'template')`, `importItemAs` with source `template`). Each app's `internal-template.ts`
builds the file from its own templates package as its `/new?template=` and its MCP do: the template's tabs
(`buildTemplateTabs` where the app has templates of several tabs, else `buildTemplateTab`), named by the template.
liveplanner adds the card types the template's boards bring (`catalogueWithBoardTypes`) and its template Sheets
(`materialiseTemplateSheets`).

## Tests

- `packages/index-client/src/kits.test.ts`: the catalogue's shape (unique ids and slots, 2 to `KIT_PARTS_MAX` parts,
  distinct apps), the reader's refusals, `kitPassLevel`.
- Each app's `internal-template.test.ts`: every kit part of the app names a template its file builder makes, and the
  file reads back through the app's import reader.
- `packages/index-app/src/template-item.test.ts` and `internal.test.ts`: the door's body checks and answers.
- `liveworkspace/apps/index/src/kits.test.ts`: a whole run (folder, items, twelve connections, each pass at the
  chosen role, livehuddle's nearest role), a guest and a delegate refused, a failed part and a failed tab, a retry
  making only what is missing, a removal touching only the person's own items.
- `liveworkspace/apps/site/components/kits/*.test.tsx`: the screen's states.
