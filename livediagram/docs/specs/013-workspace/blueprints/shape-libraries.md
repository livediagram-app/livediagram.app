# Shape libraries blueprint

Derived from [Shape libraries](../shape-libraries.md). Modelled like folders: one owner-scoped table, one REST resource, one client context, plus the draw.io import landing, the palette category and the Explorer page.

## Files

| File                                                            | Holds                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/shape-libraries.ts`                    | `ShapeLibrary`, `ShapeLibraryItem`, the limits, `uniqueLibraryName`, `validateShapeLibraryItems`                                                                    |
| `apps/api/src/person-store/person-schema.ts`                    | The person's store schema: the `shape_libraries` table                                                                                                              |
| `apps/api/src/shape-library-row.ts`                             | `ShapeLibraryRow`, `rowToShapeLibrary`: snake_case row and JSON items to the DTO                                                                                    |
| `apps/api/src/person-store/shape-library-store.ts`              | List, get, names, create and update (with their checks), delete, export and adopt, over the store's SQLite                                                          |
| `apps/api/src/routes/shape-libraries.ts`                        | `handleShapeLibraries`: the four routes                                                                                                                             |
| `apps/api/src/person-store/person-store.ts`, `person-client.ts` | The `PersonStore` Durable Object and the worker's typed way in                                                                                                      |
| `apps/api/src/db/account.ts`                                    | Account deletion purges the person's store; `mergeGuest` calls `migrateShapeLibraries`, which moves the guest's libraries into the account's, renaming clashes      |
| `apps/api/src/index.ts`                                         | `shape-libraries` dispatch, owner-scoped                                                                                                                            |
| `apps/api/src/openapi/manifest.ts`                              | The four operations, tag `Shape Libraries`                                                                                                                          |
| `apps/editor/lib/api/shape-libraries.ts`                        | `apiListShapeLibraries` (deduped), `apiCreateShapeLibrary`, `apiUpdateShapeLibrary`, `apiDeleteShapeLibrary`                                                        |
| `apps/editor/components/primitives/ShapeLibraryProvider.tsx`    | `ShapeLibraryProvider`, `useShapeLibraries`: the owner's list and its changes                                                                                       |
| `apps/editor/lib/drawio/library-store.ts`                       | `importShapeLibraries`: each imported library's pictures stored, items given ids and titles, then created; `withLibraries`: an outcome with its libraries folded in |
| `apps/editor/hooks/persistence/useDrawioFileImport.ts`          | Libraries listed and imported beside diagrams                                                                                                                       |
| `apps/editor/components/dialogs/ImportImageReport.tsx`          | "N new shape libraries:" links                                                                                                                                      |
| `apps/editor/lib/shape-library-thumbnail.ts`                    | `libraryItemThumbnail`: an item's elements as an inert SVG data URL                                                                                                 |
| `apps/editor/components/palette/PaletteMyShapesTab.tsx`         | The My shapes category body: search, sections, tiles                                                                                                                |
| `apps/editor/components/palette/LibraryShapeTile.tsx`           | One tile: thumbnail or title, click, keyboard, drag                                                                                                                 |
| `apps/editor/hooks/canvas/useLibraryShapeInsert.ts`             | `insertLibraryShape(item, at?)`: fresh ids, centred at the point, one commit, selected                                                                              |
| `apps/api/src/routes/shape-libraries.ts` `/previews`            | `GET /api/shape-libraries/:id/previews`: one library's shapes as SVG by shape id (`shapePreviews`), for the shared Explorer                                         |
| `apps/editor/lib/explorer-library-host.tsx`                     | `explorerLibraryHosts`: the shared Explorer's Image Gallery and Shape Libraries over this site's API (`appLibraryHosts`)                                            |
| `apps/editor/components/primitives/LibraryItemThumbnail.tsx`    | `LibraryItemThumbnail`: one item drawn small, drawn in My shapes                                                                                                    |
| `apps/editor/lib/shape-library-dnd.ts`                          | `LIBRARY_SHAPE_DND_MIME`, `readLibraryShapeRef`: the drag payload                                                                                                   |
| `apps/help/app/explorer/shape-libraries/page.mdx`               | The help article, key `shapeLibraries`                                                                                                                              |

## Domain and naming

| Term                   | Identifier           | Meaning                                                        |
| ---------------------- | -------------------- | -------------------------------------------------------------- |
| shape library          | `ShapeLibrary`       | `{ id, ownerId, name, source, items, createdAt, updatedAt }`   |
| item                   | `ShapeLibraryItem`   | `{ id, title, width, height, elements }`, elements from (0, 0) |
| source                 | `ShapeLibrarySource` | `'drawio'`, the only value today                               |
| My shapes              | category `my-shapes` | The palette category                                           |
| library shape (placed) | `LibraryShape`       | The telemetry type for an item placed                          |

"Library" alone in code means a shape library; draw.io's file stays `mxlibrary` / `importDrawioLibrary`.

## Behaviour and state

1. **Import** (Explorer, `useDrawioFileImport`): `readDrawioFiles` already returns `libraries`. They become list rows (`library:<i>`, "Shape library · 14 shapes") beside diagrams, all ticked. `importChecked` runs the ticked diagrams through `importDocuments`, then the ticked libraries through `importLibraries` (a dep, the Explorer's), one at a time, progress "Importing 3 of 12…" counted over both. Each library (`importShapeLibraries`): images through one `attachDrawioImages` / `attachImportImages` pass (`documentId: null`), items given fresh ids and titles cut to `MAX_SHAPE_LIBRARY_TITLE_CHARS`, the byte budget checked before any call, then `createLibrary`. A refused library is that library's failure; the others go on. `withLibraries` folds the libraries' links, landed totals, images and failures into the documents' outcome. One `track('Element', 'Imported', 'ShapeLibrary')` per library made.
2. **Outcome**: `ImportOutcome.done` gains `libraries?: { id, name }[]`; failures from both halves are listed together, read failures first.
3. **Provider** (`ShapeLibraryProvider`, keyed on `ownerId`): on a non-null owner, one `apiListShapeLibraries`; state `{ libraries, status: 'loading' | 'ready' | 'error' }`; `reload()`. `createLibrary(input)` → `{ ok: true, library } | { ok: false, error }` and prepends on success. `renameLibrary(id, name)` → same shape, replaces in place. `deleteLibrary(id)` optimistic: removed first, the call after; a failed call reloads. `deleteItem(libraryId, itemId)` sends the remaining items and replaces the library. A null owner: no fetch, every change returns `{ ok: false, error: UNEXPECTED }`. Without a provider, `useShapeLibraries` returns an inert empty value.
4. **Palette**: `usePaletteCatalogue` drops `my-shapes` from the tabs while no library holds a shape. The body lists sections newest first (the api's order); the search filters items whose title or library name contains the query (case-insensitive, trimmed); a library whose name matches shows whole.
5. **Insert** (`useLibraryShapeInsert`): read-only or edits blocked → nothing. Else the footprint is the size of what lands, the item's elements' `contentBounds` (an item with none falls back to its `width` × `height`), centred on `at` (a drop) or, for a click, on `clickFootprint`: start at `getViewportCenter()`; while the footprint intersects the footprint of an earlier insert on this tab that is still in place (every element it made still exists, its first element still at the `x`, `y` it landed at), move it so its left edge sits `LIBRARY_INSERT_GAP` (24) right of that footprint, centred on its row. Then `duplicateElements(item.elements, all ids, dx, dy)` moving the item's top-left onto the footprint's; `commit((els) => [...els, ...copies])`; one copy selected alone, several multi-selected; the footprint recorded (clicks and drops alike); `track('Element', 'Added', 'LibraryShape')`.
6. **Drag**: a tile's `dragstart` sets `LIBRARY_SHAPE_DND_MIME` to `JSON.stringify({ libraryId, itemId })` and `copy`; `usePaletteDrop` accepts it and calls `onDropLibraryShape(ref, { x, y })`; the host resolves the item from the provider and inserts at that point. An unknown ref is ignored with a log.
7. **Explorer page**: the shared Explorer's Shape Libraries (`@liveworkspace/explorer` `ShapeLibrariesPane`) over `appLibraryHosts('livediagram', …)`: list, rename, delete, show shapes, delete a shape, each through this site's `/api/shape-libraries`; its tiles are drawn from `GET /api/shape-libraries/:id/previews`, one request a library.
8. **Sign-up** (`mergeGuest`, when a guest becomes an account): `migrateShapeLibraries` exports the guest's store (`exportShapeLibraries`), the account's store adopts them (`adoptShapeLibraries`: each library whose name clashes takes the next free " (n)", `uniqueLibraryName`; the cap does not apply), then the guest's store is purged. Logged `[shape-libraries] migrated { moved, renamed }`; idempotent, so a retry moves nothing twice.

## Interfaces and contracts

```ts
// packages/api-schema/src/shape-libraries.ts
export const MAX_SHAPE_LIBRARIES_PER_OWNER = 100;
export const MAX_SHAPE_LIBRARY_ITEMS = 1000;
export const MAX_SHAPE_LIBRARY_NAME_CHARS = 120;
export const MAX_SHAPE_LIBRARY_TITLE_CHARS = 200;
export const MAX_SHAPE_LIBRARY_ITEM_ID_CHARS = 64;
export const MAX_SHAPE_LIBRARY_ITEM_SIDE = 100_000;
export type ShapeLibrarySource = 'drawio';
export type ShapeLibraryItem = {
  id: string;
  title: string;
  width: number;
  height: number;
  elements: Element[];
};
export type ShapeLibrary = {
  id: string;
  ownerId: string;
  name: string;
  source: ShapeLibrarySource;
  items: ShapeLibraryItem[];
  createdAt: number;
  updatedAt: number;
};
export function uniqueLibraryName(name: string, taken: Iterable<string>): string;
export function normaliseLibraryName(name: string): string | null; // trimmed, null when empty or too long
export function validateShapeLibraryItems(
  items: unknown,
): { ok: true; items: ShapeLibraryItem[] } | { ok: false; reason: string };
export function shapeLibraryItemsBytes(items: ShapeLibraryItem[]): number;
```

- `uniqueLibraryName`: compares trimmed and lower-cased; the name itself when free, else `"<name> (n)"` for the smallest n ≥ 2 that is free, shortened so the whole stays within `MAX_SHAPE_LIBRARY_NAME_CHARS`.
- `validateShapeLibraryItems`: an array of at most `MAX_SHAPE_LIBRARY_ITEMS`; each an object with a non-empty string `id` up to `MAX_SHAPE_LIBRARY_ITEM_ID_CHARS`, a string `title` up to `MAX_SHAPE_LIBRARY_TITLE_CHARS`, finite `width` and `height` in (0, `MAX_SHAPE_LIBRARY_ITEM_SIDE`], and `elements` an array of objects (a non-object is `invalid-element`, never dropped) whose every entry passes `isValidElement` after `migrateIncomingElements`; ids unique across the library. Reasons: `not-a-list`, `too-many-items`, `invalid-item`, `duplicate-item-id`, `invalid-element`. The validated items are the migrated ones.

| Route                             | Body                          | Success             | Rejections                                                                                                                                  |
| --------------------------------- | ----------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/shape-libraries`        | -                             | 200 `{ libraries }` | 400 no owner                                                                                                                                |
| `POST /api/shape-libraries`       | `{ id, name, source, items }` | 201 `{ library }`   | 400 missing / invalid field or items (`<reason>`); 409 `shape_library_cap`; 409 `shape_library_exists` (id taken); 413 over `MAX_TAB_BYTES` |
| `PUT /api/shape-libraries/:id`    | `{ name?, items? }`           | 200 `{ library }`   | 400 invalid; 404 (missing, or someone else's); 409 `shape_library_name_taken`; 413                                                          |
| `DELETE /api/shape-libraries/:id` | -                             | 204                 | 404                                                                                                                                         |

- `id`: a string of 1 to 64 characters from `[A-Za-z0-9_-]`, minted by the client as a UUID.
- POST applies `uniqueLibraryName` against the owner's names; PUT with a clashing `name` (another library's) is refused, a rename to its own name is a no-op success.
- The client reads a 409's `error` token and a 413 into the copy: `shape_library_cap` → "You have 100 shape libraries already. Delete one to add another."; 413 → "This library is too large to store."; `shape_library_name_taken` → "You already have a library with that name."; anything else → "Couldn't save this shape library. Try again."

## Data and persistence

In the person's own store (`PersonStore`, one per person id):

```sql
CREATE TABLE shape_libraries (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  items      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

- Every column is content of the owner; `items` is the JSON array as validated. A row that fails to parse reads as a library with no items (logged `[shape-libraries] corrupt items`), so one bad row never fails the list.
- Account deletion: the person's store is purged (`deleteAll`). Sign-up: the guest's store exports its libraries, the account's adopts them in one transaction (renaming clashes, keeping the account's copy of an id it already holds), then the guest's store is purged.
- No snapshot or restore beyond the row.

## Errors and edge cases

| Case                                           | Handling                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| An owner at the cap imports another            | 409; that library is a failure with the cap copy; the rest import                                      |
| Items over the byte budget                     | 413; the client checks first with `shapeLibraryItemsBytes` and skips the call                          |
| The same file imported twice                   | Two libraries, the second "(2)"                                                                        |
| Every picture in a library fails to store      | The library still lands; its image elements stay placeholders; the images block of the report says why |
| An empty library after deleting every shape    | Kept, "0 shapes", hidden from My shapes (no items)                                                     |
| A rename to the same name                      | Saved as is (no clash with itself)                                                                     |
| A library deleted in another window            | The next list load drops it; a change against it gets 404 and reloads                                  |
| Inserting on a read-only or locked tab         | The palette is absent read-only; a locked tab refuses, logged                                          |
| An item that would pass `MAX_ELEMENTS_PER_TAB` | Refused, logged `[shape-libraries] insert refused` `{ reason: 'tab full' }`                            |
| A drag carrying an unknown library or item     | Ignored, logged                                                                                        |
| Thumbnail rendering throws                     | The tile shows its title; logged once per item                                                         |

## Security and trust

- Owner-scoped: `requireOwner`, and the route only ever reaches the caller's own store, so another person's library is a 404; a guest is proven by their guest token.
- Items are untrusted client JSON: validated structurally and per element (`isValidElement`), capped in count and bytes. Element links stay as `isValidElement` allows them.
- Thumbnails are SVG strings from the editor's own exporter, shown through `<img>` (a data URL), so nothing in them runs.
- The library name is text everywhere (React escapes it); it never reaches markup unescaped.

## Performance and limits

- The list endpoint returns every library's items: at the cap, 100 libraries × up to 2 MB is far past what one list should carry, so the list is bounded in practice by the owner's own imports. The worst real case (the private survey's 14-item library) is about 7 KB. The list is fetched once per editor or Explorer open; the Explorer's drawings are one previews request per library shown, cached privately for five minutes.
- Thumbnails render lazily: each `LibraryItemThumbnail` draws after its surface has painted
  (`setTimeout(0)`), only while My shapes shows it, cached per item id for the
  session; a failed drawing is not retried in that session.
- Insert is one `duplicateElements` over the item's elements and one commit.

## Presentation and UX

- Palette: category label **My shapes**, blurb "Shapes from your imported libraries, ready to place.", icon a stacked-shapes glyph. A search input labelled "Search my shapes" (placeholder "Search my shapes"). A section per library: heading the name, then a grid of tiles (the same tile size as Icons). Tile: the thumbnail (contain-fit) over the title, one line, truncated; untitled "Shape n". No matches: "No shapes match “<words>”" (the shared empty state, with Clear Search).
- Report: under the documents block, "New shape library:" / "2 new shape libraries:", each name a link to `/explorer/shape-libraries/`.
- Explorer page: the shared Explorer's Shape Libraries, its Help button opening `shapeLibraries`
  (`explorerHelpHref` in `apps/editor/lib/explorer-host.ts`). Card: the name (heading), "14 shapes", a row of the first shapes drawn small, buttons **Rename**, **Delete**, **Show shapes** / **Hide shapes**. Expanded: a grid of items, each drawing, title and **Delete**. Empty, loading and error copy as the spec.

## Accessibility

- Tiles are `button`s in a `ul` per section, each section a `section` labelled by its heading; `aria-label` "Insert <title> from <library>". The palette is absent on read-only tabs and in Draw mode, so no
  tile is ever shown disabled.$1Enter and Space place at the view's centre (native button behaviour).
- The search input has a visible label (screen-reader only) and filters live; the result count is announced through the list itself (no live region needed: the user is typing into it).
- Explorer: cards are `article`s labelled by their name; the rename input is labelled "Library name"; the delete confirmation is the shared confirm dialog (focus trapped, Escape cancels); item delete buttons are named "Delete <title>".
- Contrast: existing palette and Explorer tokens only (WCAG 2.2 AA as they are). No motion added.

## Web Experience

- LCP: nothing on the first paint; the provider's fetch runs after mount, the category body and thumbnails render only when opened, `export-tab` is imported lazily by the thumbnail module.
- INP: thumbnails yield between items; insert is a single commit.
- CLS: tiles keep their box while their thumbnail loads; cards keep their thumbnail row's height.

## Observability

| Fingerprint                          | Level                | When                                                                  |
| ------------------------------------ | -------------------- | --------------------------------------------------------------------- |
| `[shape-libraries] created`          | `info`               | api: `{ id, items, bytes }`                                           |
| `[shape-libraries] rejected`         | `warn`               | api: `{ reason }` for every 400 / 409 / 413                           |
| `[shape-libraries] corrupt items`    | `warn`               | api: a row whose items fail to parse, `{ id }`                        |
| `[shape-libraries] migrated`         | `info`               | api: sign-up `{ moved, renamed }`                                     |
| `[shape-libraries] list failed`      | `warn`               | client: the list load failed, `{ status }`                            |
| `[shape-libraries] save failed`      | `warn`               | client: a create / rename / items change failed, `{ action, status }` |
| `[shape-libraries] inserted`         | `trace` (`debugLog`) | client: `{ elements }`                                                |
| `[shape-libraries] insert refused`   | `warn`               | client: `{ reason }`, `edits blocked` or `tab full`                   |
| `[shape-libraries] drop ignored`     | `warn`               | client: an unknown library or item in a drag                          |
| `[shape-libraries] thumbnail failed` | `warn`               | client: `{ cause }` (the error's name and message)                    |
| `[drawio-import] library imported`   | `trace` (`debugLog`) | client: `{ items, images }`                                           |

## Testing

| Rule                                                                                                                                                                                    | Test                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Names: unique suffix, case, length; items validation and reasons                                                                                                                        | `packages/api-schema/src/shape-libraries.test.ts`                                   |
| Row mapping, corrupt items                                                                                                                                                              | `apps/api/src/shape-library-row.test.ts`                                            |
| Routes against real stores: auth, 400 / 404 / 409 / 413, clash suffix, rename, an untouched store                                                                                       | `apps/api/src/routes/shape-libraries.test.ts`                                       |
| Sign-up move with clash renaming; account deletion                                                                                                                                      | `apps/api/src/db/account-owner-columns.test.ts` (the owner-column ledger)           |
| OpenAPI covers the routes; the route stays probeable                                                                                                                                    | `apps/api/src/openapi/route-parity.test.ts`, `apps/api/src/route-resources.test.ts` |
| Client calls and error copy                                                                                                                                                             | `apps/editor/lib/api/shape-libraries.test.ts`                                       |
| Provider: load, create, rename, delete, delete item, failures                                                                                                                           | `ShapeLibraryProvider.test.tsx`                                                     |
| Import: libraries listed and made, failures, telemetry, outcome                                                                                                                         | `useDrawioFileImport.test.ts`, `library-store.test.ts`                              |
| Report links                                                                                                                                                                            | `apps/editor/components/dialogs/ImportImageReport.test.tsx`                         |
| Palette: hidden when empty, sections, search, tile names, disabled                                                                                                                      | `PaletteMyShapesTab.test.tsx`                                                       |
| Insert: centred, fresh ids, connections, one commit, selection, read-only; consecutive clicks line up and never cover, a moved or deleted insert frees its spot, drops keep their point | `apps/editor/hooks/canvas/useLibraryShapeInsert.test.ts`                            |
| Drop: the MIME reaches the host with the point                                                                                                                                          | `usePaletteDrop.test.ts`                                                            |
| Previews: every shape as SVG, 404 for a missing library                                                                                                                                 | `apps/api/src/routes/shape-libraries.test.ts`                                       |
| End to end: import a synthesised library, place two shapes whose boxes do not overlap, rename, delete                                                                                   | `apps/editor/e2e/shape-libraries.spec.ts`                                           |

## Constants and configuration

| Constant                          | Value                                     | Provenance / safe range                                                           |
| --------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `MAX_SHAPE_LIBRARIES_PER_OWNER`   | 100                                       | Spec; 10 to 1 000                                                                 |
| `MAX_SHAPE_LIBRARY_ITEMS`         | 1 000                                     | Spec; draw.io's own libraries rarely pass a few hundred                           |
| `MAX_SHAPE_LIBRARY_NAME_CHARS`    | 120                                       | Spec                                                                              |
| `MAX_SHAPE_LIBRARY_TITLE_CHARS`   | 200                                       | Spec                                                                              |
| `MAX_SHAPE_LIBRARY_ITEM_ID_CHARS` | 64                                        | A UUID is 36 (D9)                                                                 |
| `MAX_SHAPE_LIBRARY_ITEM_SIDE`     | 100 000                                   | Far past any real shape (D10)                                                     |
| Items byte budget                 | `MAX_TAB_BYTES`                           | Spec: one row, as a tab                                                           |
| `LIBRARY_SHAPE_DND_MIME`          | `application/x-livediagram-library-shape` | Beside the palette's other drag MIMEs                                             |
| `SHAPE_LIBRARY_CARD_PREVIEWS`     | 8                                         | Spec ("the first eight")                                                          |
| `LIBRARY_INSERT_GAP`              | 24                                        | The paste offset (`PASTE_OFFSET`), as the gap between consecutive clicked inserts |
| `DRAWIO_MAX_LIBRARY_ITEMS`        | `MAX_SHAPE_LIBRARY_ITEMS`                 | The importer keeps what the api accepts                                           |

## Assets and external resources

- The My shapes category glyph: drawn in-house on the palette's 24-unit grid (a square, a circle and a triangle stacked), MIT like the codebase. No vendor marks.
- No external resources at runtime.

## Defaults ledger

Rows D7 to D14 in [DEFAULTS.md](DEFAULTS.md).
