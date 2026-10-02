# Shape libraries blueprint

Derived from [Shape libraries](../shape-libraries.md). Modelled on custom themes (`custom_themes`, `/api/custom-themes`, `CustomThemeProvider`): one owner-scoped table, one REST resource, one client context, plus the draw.io import landing, the palette category and the Explorer page.

## Files

| File                                                       | Holds                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/shape-libraries.ts`               | `ShapeLibrary`, `ShapeLibraryItem`, the limits, `uniqueLibraryName`, `validateShapeLibraryItems`                                                                    |
| `apps/api/migrations/0060_shape_libraries.sql`             | The table and its two indexes                                                                                                                                       |
| `apps/api/src/shape-library-row.ts`                        | `ShapeLibraryRow`, `rowToShapeLibrary`: snake_case row and JSON items to the DTO                                                                                    |
| `apps/api/src/db/shape-libraries.ts`                       | List, get, count, names, create, update, delete                                                                                                                     |
| `apps/api/src/routes/shape-libraries.ts`                   | `handleShapeLibraries`: the four routes                                                                                                                             |
| `apps/api/src/db/account.ts`                               | Account deletion deletes the rows; `migrateOwnerId` moves them, renaming clashes                                                                                    |
| `apps/api/src/auth/guest-rest.ts`                          | `shape-libraries` in `OWNER_SCOPED_SEGMENTS`                                                                                                                        |
| `apps/api/src/openapi/manifest.ts`                         | The four operations, tag `Shape libraries`                                                                                                                          |
| `apps/live/lib/api/shape-libraries.ts`                     | `apiListShapeLibraries` (deduped), `apiCreateShapeLibrary`, `apiUpdateShapeLibrary`, `apiDeleteShapeLibrary`                                                        |
| `apps/live/components/primitives/ShapeLibraryProvider.tsx` | `ShapeLibraryProvider`, `useShapeLibraries`: the owner's list and its changes                                                                                       |
| `apps/live/lib/drawio/library-store.ts`                    | `importShapeLibraries`: each imported library's pictures stored, items given ids and titles, then created; `withLibraries`: an outcome with its libraries folded in |
| `apps/live/hooks/persistence/useDrawioFileImport.ts`       | Libraries listed and imported beside diagrams                                                                                                                       |
| `apps/live/components/dialogs/ImportImageReport.tsx`       | "N new shape libraries:" links                                                                                                                                      |
| `apps/live/lib/shape-library-thumbnail.ts`                 | `libraryItemThumbnail`: an item's elements as an inert SVG data URL                                                                                                 |
| `apps/live/components/palette/PaletteMyShapesTab.tsx`      | The My shapes category body: search, sections, tiles                                                                                                                |
| `apps/live/components/palette/LibraryShapeTile.tsx`        | One tile: thumbnail or title, click, keyboard, drag                                                                                                                 |
| `apps/live/hooks/canvas/useLibraryShapeInsert.ts`          | `insertLibraryShape(item, at?)`: fresh ids, centred at the point, one commit, selected                                                                              |
| `apps/live/app/explorer/shape-libraries/page.tsx`          | The route                                                                                                                                                           |
| `apps/live/components/panels/ShapeLibrariesPane.tsx`       | The Explorer page body: cards, rename, delete, show shapes, delete a shape                                                                                          |
| `apps/live/components/primitives/LibraryItemThumbnail.tsx` | `LibraryItemThumbnail`: one item drawn small, shared by My shapes and the Explorer page                                                                             |
| `apps/live/lib/shape-library-dnd.ts`                       | `LIBRARY_SHAPE_DND_MIME`, `readLibraryShapeRef`: the drag payload                                                                                                   |
| `apps/live/app/explorer/routes.ts`                         | `shape-libraries` to and from `/explorer/shape-libraries`                                                                                                           |
| `apps/help/app/explorer/shape-libraries/page.mdx`          | The help article, key `shapeLibraries`                                                                                                                              |

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
5. **Insert** (`useLibraryShapeInsert`): read-only or edits blocked → nothing. Else the footprint is the item's `width` × `height` centred on `at` (a drop) or, for a click, on `clickFootprint`: start at `getViewportCenter()`; while the footprint intersects the footprint of an earlier insert on this tab that is still in place (every element it made still exists, its first element still at the `x`, `y` it landed at), move it so its left edge sits `LIBRARY_INSERT_GAP` (24) right of that footprint, centred on its row. Then `duplicateElements(item.elements, all ids, dx, dy)` moving the item's top-left onto the footprint's; `commit((els) => [...els, ...copies])`; one copy selected alone, several multi-selected; the footprint recorded (clicks and drops alike); `track('Element', 'Added', 'LibraryShape')`.
6. **Drag**: a tile's `dragstart` sets `LIBRARY_SHAPE_DND_MIME` to `JSON.stringify({ libraryId, itemId })` and `copy`; `usePaletteDrop` accepts it and calls `onDropLibraryShape(ref, { x, y })`; the host resolves the item from the provider and inserts at that point. An unknown ref is ignored with a log.
7. **Explorer page**: the provider's list; a card per library with rename (inline input, Enter saves, Escape or blur cancels; empty, unchanged or over-length input saves nothing), delete (confirm dialog), show shapes (toggle), delete a shape. A failed rename shows its error under the input and keeps the input open.
8. **Sign-up**: `migrateOwnerId` reads the account's names, renames each guest library whose name clashes (`uniqueLibraryName`), then moves every guest row to the account.

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
| `PUT /api/shape-libraries/:id`    | `{ name?, items? }`           | 200 `{ library }`   | 400 invalid; 403 not the owner; 404; 409 `shape_library_name_taken`; 413                                                                    |
| `DELETE /api/shape-libraries/:id` | -                             | 204                 | 403; 404                                                                                                                                    |

- `id`: a string of 1 to 64 characters from `[A-Za-z0-9_-]`, minted by the client as a UUID.
- POST applies `uniqueLibraryName` against the owner's names; PUT with a clashing `name` (another library's) is refused, a rename to its own name is a no-op success.
- The client reads a 409's `error` token and a 413 into the copy: `shape_library_cap` → "You have 100 shape libraries already. Delete one to add another."; 413 → "This library is too large to store."; `shape_library_name_taken` → "You already have a library with that name."; anything else → "Couldn't save this shape library. Try again."

## Data and persistence

```sql
CREATE TABLE shape_libraries (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  items       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX shape_libraries_owner_created_idx ON shape_libraries (owner_id, created_at DESC);
```

- Every column is content of the owner; `items` is the JSON array as validated. A row that fails to parse reads as a library with no items (logged `[shape-libraries] corrupt items`), so one bad row never fails the list.
- Account deletion: `DELETE FROM shape_libraries WHERE owner_id = ?`. Sign-up: rename clashes, then `UPDATE shape_libraries SET owner_id = ? WHERE owner_id = ?`.
- No snapshot or restore beyond the row; no migration of old rows (the table is new).

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

- Owner-scoped exactly like custom themes: `requireOwner`, 403 for another owner's row, the segment in `OWNER_SCOPED_SEGMENTS` so a guest id must be proven when enforcement is on.
- Items are untrusted client JSON: validated structurally and per element (`isValidElement`), capped in count and bytes. Element links stay as `isValidElement` allows them.
- Thumbnails are SVG strings from the editor's own exporter, shown through `<img>` (a data URL), so nothing in them runs.
- The library name is text everywhere (React escapes it); it never reaches markup unescaped.

## Performance and limits

- The list endpoint returns every library's items: at the cap, 100 libraries × up to 2 MB is far past what one list should carry, so the list is bounded in practice by the owner's own imports. The worst real case (the private survey's 14-item library) is about 7 KB. The list is fetched once per editor or Explorer open.
- Thumbnails render lazily: each `LibraryItemThumbnail` draws after its surface has painted
  (`setTimeout(0)`), only while My shapes or the Explorer page shows it, cached per item id for the
  session; a failed drawing is not retried in that session.
- Insert is one `duplicateElements` over the item's elements and one commit.

## Presentation and UX

- Palette: category label **My shapes**, blurb "Shapes from your imported libraries, ready to place.", icon a stacked-shapes glyph. A search input labelled "Search my shapes" (placeholder "Search my shapes"). A section per library: heading the name, then a grid of tiles (the same tile size as Icons). Tile: the thumbnail (contain-fit) over the title, one line, truncated; untitled "Shape n". No matches: "No shapes match".
- Report: under the documents block, "New shape library:" / "2 new shape libraries:", each name a link to `/explorer/shape-libraries/`.
- Explorer page: header "Shape libraries"; the article link "Learn more" (`shapeLibraries`) above the
  cards and in the empty state; cards in a column. Card: the name (heading), "14 shapes", a row of up to 8 thumbnails, buttons **Rename**, **Delete**, **Show shapes** / **Hide shapes**. Expanded: a grid of items, each thumbnail, title and **Delete**. Empty, loading and error copy as the spec.

## Accessibility

- Tiles are `button`s in a `ul` per section, each section a `section` labelled by its heading; `aria-label` "Insert <title> from <library>". The palette is absent on read-only and whiteboard tabs, so no
  tile is ever shown disabled.$1Enter and Space place at the view's centre (native button behaviour).
- The search input has a visible label (screen-reader only) and filters live; the result count is announced through the list itself (no live region needed: the user is typing into it).
- Explorer: cards are `article`s labelled by their name; the rename input is labelled "Library name"; the delete confirmation is the shared confirm dialog (focus trapped, Escape cancels); item delete buttons are named "Delete <title>".
- Contrast: existing palette and Explorer tokens only (WCAG 2.2 AA as they are). No motion added.

## Web Experience

- LCP: nothing on the first paint; the provider's fetch runs after mount, the category body and thumbnails render only when opened, `export-tab` is imported lazily by the thumbnail module.
- INP: thumbnails yield between items; insert is a single commit.
- CLS: tiles keep their box while their thumbnail loads; cards keep their thumbnail row's height.

## Observability

| Fingerprint                          | Level   | When                                                                  |
| ------------------------------------ | ------- | --------------------------------------------------------------------- |
| `[shape-libraries] created`          | `info`  | api: `{ id, items, bytes }`                                           |
| `[shape-libraries] rejected`         | `warn`  | api: `{ reason }` for every 400 / 409 / 413                           |
| `[shape-libraries] corrupt items`    | `warn`  | api: a row whose items fail to parse, `{ id }`                        |
| `[shape-libraries] migrated`         | `info`  | api: sign-up `{ moved, renamed }`                                     |
| `[shape-libraries] list failed`      | `warn`  | client: the list load failed, `{ status }`                            |
| `[shape-libraries] save failed`      | `warn`  | client: a create / rename / items change failed, `{ action, status }` |
| `[shape-libraries] inserted`         | `debug` | client: `{ elements }`                                                |
| `[shape-libraries] insert refused`   | `warn`  | client: `{ reason }`, `edits blocked` or `tab full`                   |
| `[shape-libraries] drop ignored`     | `warn`  | client: an unknown library or item in a drag                          |
| `[shape-libraries] thumbnail failed` | `warn`  | client: `{ cause }` (the error's name and message)                    |
| `[drawio-import] library imported`   | `info`  | client: `{ items, images }`                                           |

## Testing

| Rule                                                                      | Test                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Names: unique suffix, case, length; items validation and reasons          | `packages/api-schema/src/shape-libraries.test.ts`                                   |
| Row mapping, corrupt items                                                | `apps/api/src/shape-library-row.test.ts`                                            |
| Routes: auth, 400 / 403 / 404 / 409 / 413, clash suffix, rename           | `apps/api/src/routes/shape-libraries.test.ts`                                       |
| Sign-up move with clash renaming; account deletion                        | `apps/api/src/db/account-owner-columns.test.ts` (the owner-column ledger)           |
| OpenAPI covers the routes; the route stays probeable                      | `apps/api/src/openapi/route-parity.test.ts`, `apps/api/src/route-resources.test.ts` |
| Client calls and error copy                                               | `apps/live/lib/api/shape-libraries.test.ts`                                         |
| Provider: load, create, rename, delete, delete item, failures             | `ShapeLibraryProvider.test.tsx`                                                     |
| Import: libraries listed and made, failures, telemetry, outcome           | `useDrawioFileImport.test.ts`, `library-store.test.ts`                              |
| Report links                                                              | `apps/live/components/dialogs/ImportImageReport.test.tsx`                           |
| Palette: hidden when empty, sections, search, tile names, disabled        | `PaletteMyShapesTab.test.tsx`                                                       |
| Insert: centred, fresh ids, connections, one commit, selection, read-only | `useLibraryShapeInsert.test.ts`                                                     |
| Drop: the MIME reaches the host with the point                            | `usePaletteDrop.test.ts`                                                            |
| Explorer page: list, rename, delete confirm, items, empty, error          | `ShapeLibrariesPane.test.tsx`                                                       |
| Route mapping                                                             | `app/explorer/routes.test.ts`                                                       |
| End to end: import a synthesised library, place a shape, rename, delete   | `apps/live/e2e/shape-libraries.spec.ts`                                             |

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

- The My shapes category glyph and the Explorer sidebar glyph: drawn in-house on the palette's 24-unit grid (a square, a circle and a triangle stacked), MIT like the codebase. No vendor marks.
- No external resources at runtime.

## Defaults ledger

Rows D7 to D14 in [DEFAULTS.md](DEFAULTS.md).
