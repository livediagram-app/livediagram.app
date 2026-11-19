# Libraries blueprint

Spec: [Libraries](../libraries.md).

## Files

```
packages/media/src/library.ts                 constants, types, title/folder rules, kinds, actor parsing, role checks
packages/media/src/library-client.ts          the service's calls on the media client (`client.library.*`)
packages/media/src/library-door.ts            handleLibraryDoor: each app's /api/library, validated, forwarded
packages/media/src/library-legacy-door.ts     handleLegacyShapeLibrariesDoor: livediagram's and livehuddle's internal read
liveworkspace/apps/media/migrations/0004_library.sql    library_items, library_legacy_copies
liveworkspace/apps/media/src/library/routes.ts          handleLibrary: list, save, place, rename, rename-folder, delete
liveworkspace/apps/media/src/library/store.ts           D1 reads and writes, the per-scope cap, owner merge and delete
liveworkspace/apps/media/src/library/pictures.ts        copying pictures between galleries (team grant)
liveworkspace/apps/media/src/library/legacy.ts          reading the old shape libraries in place, the lazy copy
liveworkspace/apps/media/src/library/deleted-teams.ts   the daily run's deleted teams: asked of accounts, their Library and gallery deleted
packages/workbench/src/components/library/              LibraryProvider, SaveToLibraryDialog, SaveToLibraryButton,
                                                        LibraryPaletteTab, LibraryTile, library-icons
packages/workbench/src/lib/library/                     library-api (the editor's calls), library-groups, library-draft
packages/workbench/src/hooks/canvas/useLibraryItemInsert.ts   placing an item, shared with livediagram's shape libraries
<app>/apps/api/src/routes/library.ts                    each app's door: kinds, clean (migrate + isValidElement), preview
<app editor>/lib/library-draft.ts                       the editor's binding of libraryDraft (libraryApiOver takes its api core)
<app editor>/components/primitives/EditorLibraryProvider.tsx
```

## Tables (MEDIA_DB)

`library_items`: `id` (PK, a random UUID), `scope` (`personal` | `team`), `scope_id` (the media owner, or the team
id), `folder`, `title`, `width`, `height`, `kinds` (JSON array), `elements` (JSON), `images` (JSON array of gallery
ids), `preview` (SVG text or null), `app`, `created_by`, `legacy_ref` (`<app>~<library>~<item>` for a copied old item,
else null), `created_at`, `updated_at`. Index `(scope, scope_id, created_at DESC)`.

`library_legacy_copies`: `(owner, legacy)` primary key, `copied_at`; `legacy` is `<app>~<library>`. WITHOUT ROWID.

Pictures an item places are referenced in `image_refs` with app `library` and document the item id, so the unused
sweep keeps them while the item exists; `usageOf` (the gallery's "Used in") answers them apart, as `library` (the
owner's images a Library item holds), so the gallery counts them used without naming a document.

## Routes (media Worker, `/api/media/app/library/<route>`, POST, app key)

| Route           | Checks                                                    | Writes                                               |
| --------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| `list`          | actor                                                     | none; legacy doors fanned out in parallel (3 s each) |
| `save`          | actor, scope use, sizes, cap (pre-count + guarded insert) | item row, its image refs, team picture copies        |
| `place`         | actor may see the item's scope                            | team picture copies into the placer's gallery        |
| `rename`        | tidy right (owner, or team admin); legacy copies first    | title                                                |
| `rename-folder` | tidy right; matching legacy libraries copied first        | folder on every matching row                         |
| `delete`        | tidy right; legacy copies first                           | row and its refs                                     |

Owner merge (`POST /owners/merge`) re-keys Personal rows; owner delete removes them with their refs.

## Deleted teams (the daily cron, `sweepDeletedTeams`)

Runs before the unused-image sweep. Needs the `ACCOUNTS` service binding and `ACCOUNTS_KEY_MEDIA`; either unset, it
logs `[library] deleted teams skipped` and does nothing.

1. The teams held: `SELECT DISTINCT scope_id FROM library_items WHERE scope = 'team'`, and the team galleries'
   owners, `images.owner` between `team:` and `team;` (a range, so the owner index serves it), the `team:` cut off.
   Sorted, at most `DELETED_TEAMS_ASK_MAX` (5,000) a run.
2. Asked in chunks of `DELETED_TEAMS_CHUNK` (100): `POST https://accounts/api/account/media/teams-deleted { ids }`
   through the binding with `Bearer ACCOUNTS_KEY_MEDIA`, 10 s each. Anything but `200 { deleted: string[] }` stops
   the run (logged `[library] deleted teams not answered`); what was already found is still deleted. An id in
   `deleted` that wasn't asked is ignored.
3. Each deleted team (`deleteTeamLibrary`): its items' ids, then `deleteRows` (rows and their `library` refs), then
   `deleteOwnerRows('team:<id>')` and the bytes from R2, 1,000 keys a call. Idempotent: a second run finds nothing.
   A run that deleted any logs `[library] deleted a team's library` once, with counts, never names.

Accounts' side (`liveworkspace/apps/accounts/src/account-api/media-door.ts`): `POST` only (else `404`), the bearer
compared with `sameSecret` (else `401`), `ids` an array of at most `MAX_DELETED_TEAM_IDS` (100) strings (else `400
too_many_ids`); answers `{ deleted }`, the ids whose `team` row has `deletedAt` set, in one query.

## Constants

`LIBRARY_TITLE_MAX` 200, `LIBRARY_FOLDER_MAX` 80, `LIBRARY_ITEMS_PER_SCOPE_MAX` 500, `LIBRARY_ITEM_BYTES_MAX` 256 KB,
`LIBRARY_ITEM_ELEMENTS_MAX` 500, `LIBRARY_PREVIEW_BYTES_MAX` 32 KB (a 10-element item draws in 3.6 KB, a one-picture
item in 4.6 KB), `LIBRARY_PICTURE_EDGE` 128, `LIBRARY_PICTURES_BYTES_MAX` 24 KB, `LIBRARY_PICTURES_MAX` 12 (the
editor's), `LIBRARY_LEGACY_TIMEOUT_MS` 3000,
`LEGACY_PREVIEWS_MAX_BYTES` 600 KB per legacy answer, `LIBRARY_ACTOR_TEAMS_MAX` 50, `LIBRARY_INSERT_GAP` 24.

## Log lines

Service: `[library] saved`, `[library] renamed`, `[library] deleted`, `[library] renamed a folder`, `[library] copied a
shape library on first write`, `[library] legacy door failed` (app, status or timeout), `[library] corrupt elements`,
`[library] picture bytes missing`. App door: `[library] door refused` (with the reason), `[library] saved`, `[library]
preview failed`; the legacy door: `[library] legacy door read`, `[library] legacy preview failed`. Editor: `[library]
insert refused`, `[library] inserted` (debug), `[library] list failed`, `[library] action refused`.

## Editor

The provider loads the list on first need (the palette's Library opening, or Save to Library), never on editor open.
Save copies the selection with the editor's own duplicate, moved to the origin, so ids are fresh before they leave
the canvas. The palette's tiles show the stored preview through a data URL in an `<img>` (inert); livediagram's own
shape library items draw with its LibraryItemThumbnail and keep their drag.

Every other tile drags `application/x-liveworkspace-library-item` `{ id }` (`lib/library/library-dnd.ts`). Each
editor's `usePaletteDrop` takes it as `onDropLibraryItem(id, at)`, and its `useInsertCanvasProps` binds that to the
workbench's `useLibraryDrop`: the item from the list the provider holds, `place` (the door), then the editor's own
insert at the drop point in one commit. A failed place inserts nothing, sets the Library’s notice and hands the same words to the provider’s `onPlaceFailed`, which each editor’s door shows as an error toast.

Saving reads each picture the selection places through the app's `pictures` source (its `apiFetchImageBlobUrl`, the
copy the canvas already holds) and draws it at `pictureEdge` (its share of the item's longest side, 16 to 128 px) as a
JPEG on white (`lib/library/library-pictures.ts`), largest first, within the budget; the door keeps only copies of the
item's own pictures that are base64 still images (`libraryPreviewPictures`) and hands them to the renderer as
`resolveImageHref`. Measured: a 128 px copy of a photo is 2.3 to 3.1 KB.

Each app's door reads the caller's teams with `createTeamAccess().currentTeams` (accounts' `teams/of`, kept 2 s,
merged over the claim, never narrowed) before building the actor, so a team joined a moment ago lists and saves at
once; the provider's `requestSave` asks for the list on every opening of Save to Library (no poll), so an editor that
loaded it earlier still offers the new team. The provider's `onSaved` and `onPlaced` carry the app's `Library·Created` and `Library·Added` telemetry, typed
`Personal` or `Team`; the site's chart is `_shared/library-metrics.ts`.

**Preview size, measured (Work Tracker 1128).** A list of 100 items, a quarter of them with a picture, is 410 KB of
JSON before compression. Previews stay inline in the list: one request, cached by the provider for the session. If
Libraries grow past a few hundred items, serve each preview as a cached URL (`GET /api/library/:id/preview?v=<updated>`,
`Cache-Control: private, max-age=31536000, immutable`) and lazy-load tiles in view.

## Defaults ledger

- MED4: an item's folder suggestions in the Save dialog are the destination's existing folders, sorted.
- MED5: a legacy library is copied whole on its first tidy, not item by item, so its folder stays one folder.

## Testing

`packages/media/src/library*.test.ts` (rules, door, client, legacy door), `liveworkspace/apps/media/src/library/*.test.ts`
(roles: member saves, member can't tidy, admin tidies, Personal is its owner's; kinds hidden; pictures copied under
the team; legacy read-through and lazy copy; owner merge and delete; a deleted team's Library and gallery go while
another team's and Personal stay, a live or unknown team untouched, no key or no answer deleting nothing, a second run
a no-op), each app's `routes/library.test.ts`, and the
workbench's library tests (groups, api, provider, dialog, palette tab, insert hook).
