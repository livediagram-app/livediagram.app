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
sweep keeps them while the item exists; `usageOf` (the gallery's "Used in") leaves those references out.

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

## Constants

`LIBRARY_TITLE_MAX` 200, `LIBRARY_FOLDER_MAX` 80, `LIBRARY_ITEMS_PER_SCOPE_MAX` 500, `LIBRARY_ITEM_BYTES_MAX` 256 KB,
`LIBRARY_ITEM_ELEMENTS_MAX` 500, `LIBRARY_PREVIEW_BYTES_MAX` 16 KB (a 10-element item draws in about 4 KB), `LIBRARY_LEGACY_TIMEOUT_MS` 3000,
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

## Defaults ledger

- MED4: an item's folder suggestions in the Save dialog are the destination's existing folders, sorted.
- MED5: a legacy library is copied whole on its first tidy, not item by item, so its folder stays one folder.

## Testing

`packages/media/src/library*.test.ts` (rules, door, client, legacy door), `liveworkspace/apps/media/src/library/*.test.ts`
(roles: member saves, member can't tidy, admin tidies, Personal is its owner's; kinds hidden; pictures copied under
the team; legacy read-through and lazy copy; owner merge and delete), each app's `routes/library.test.ts`, and the
workbench's library tests (groups, api, provider, dialog, palette tab, insert hook).
