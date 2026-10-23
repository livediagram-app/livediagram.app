# Shape libraries

A **shape library** is a named set of reusable shapes that belongs to a person: a draw.io library (the
"preset" kept in a draw.io scratchpad or a Drive file) brought into livediagram, its shapes ready to
place on any tab from the palette's **My shapes** category. Importing several libraries gives several,
each under its own name; they are never merged into one pile.

## Why

People who work in draw.io keep their house shapes in libraries: a UML preset, a set of team icons,
a notation of their own. Moving to livediagram should not mean redrawing them. A library is theirs,
reusable across documents, and named as they named it, so a library imported today and another next
week stay two libraries.

## What a library is

- **A library**: an id, its owner, a **name**, an ordered list of **items**, created and updated
  times. It is owner-scoped exactly like documents and [folders](folders.md):
  keyed by the request owner id, the account's `sub` when signed in or the `X-Owner-Id` guest id otherwise
  ([Auth + guest access](../014-identity/auth-and-guest-access.md)). **Guests have libraries too**, and
  a guest who signs up carries them over with the existing `POST /api/migrate` owner-id remap.
- **An item**: an id, a **title** (may be empty), a **width** and **height** (the size of its
  elements), and its **elements**:
  ordinary livediagram elements positioned from the item's top-left corner at (0, 0), as the draw.io
  mapping ([draw.io import](../020-import-export/drawio-import.md)) produced them, connections
  between them included. Pictures in an item (an image item, or an image inside a shape snippet) are
  stored through the [Import image pipeline](../020-import-export/import-image-pipeline.md) when the
  library is imported, into the owner's [Image gallery](../009-elements/images.md) like any imported
  picture; an item references them by image id like any element does. Deleting that picture from the
  gallery leaves the item's image empty, as it does in a document.
- Where a library came from is kept (`source: 'drawio'`), so a later source (an Excalidraw library) is
  one more value.

## Making libraries

- **Import from draw.io** in the Explorer page header's **Import from** group takes library files
  (`<mxlibrary>`) alongside diagrams, in the same pick or folder; **each library file becomes its own
  library** ([draw.io import](../020-import-export/drawio-import.md) "Shape Libraries").
- **Name**: the file name without its extension; draw.io's default library name (`Untitled Library`,
  any case, with an optional copy number) or an empty name becomes "draw.io library". A name the owner
  already uses **keeps both**: the new library is suffixed " (2)", or the next free number.
- **Items** keep the library's order. An item that cannot be read is left out and counted in the
  import report ("Library shapes that couldn't be read were left out"); a library none of whose items
  can be read is not made, and the report says why.
- **The report.** The import's one shared report ([Board scene](../020-import-export/board-scene.md)
  "The report") lists the new libraries under the new documents, "2 new shape libraries:", each a
  link to the Explorer's Shape libraries page. A library the api refuses (the cap, the size budget)
  is listed with the files left out, with the api's reason. Libraries count toward the report's
  landed totals like documents do.
- **Diagrams and libraries in one pick** import together: the diagrams as documents, then the
  libraries; one failing never stops the other.

## Limits

Named constants, checked by the api and before any upload by the client:

- `MAX_SHAPE_LIBRARIES_PER_OWNER` (100): a create beyond it is refused with "You have 100 shape
  libraries already. Delete one to add another."
- `MAX_SHAPE_LIBRARY_ITEMS` (1,000) items in one library; the importer keeps the first 1,000 and counts
  the rest.
- A library's stored items must fit one database row, the same budget as a tab (`MAX_TAB_BYTES`,
  [Tab size](../015-api/api.md#tab-size)); a library over it is refused with "This library is too large
  to store." and named in the report.
- Names are trimmed and at most 120 characters; titles at most 200.

## Using a library: the palette

- The palette gains a **My shapes** category in the Common band, after Shapes, shown when the owner
  has at least one library holding a shape ([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)).
- It shows **one section per library**, headed by the library's name, newest library first, each item
  a tile drawing a thumbnail of its elements with its title beneath (or "Shape n" when untitled, n
  its 1-based position). The thumbnail is the item's elements drawn by the editor's own SVG export,
  as an inert image (pictures inside show as their placeholder), drawn when the category first
  opens; until then, and when drawing fails, the tile shows its title alone in the same box, so
  nothing shifts. A search box at the top filters by library name and item title, case-insensitive;
  no match reads "No shapes match “<words>”" (the shared empty state, with Clear Search).
- **Placing an item** works like pasting: a click places it at the centre of the view, a drag at the
  drop point; its elements get fresh ids (connections follow), land in **one undo step**, and are
  **selected**.
- **Consecutive clicks never cover one another.** A click whose shape would land on a shape placed
  from My shapes earlier, still where it landed, goes 24 px to the right of it instead (the paste
  offset, as a gap), centred on its row; a run of clicks lines up left to right. A drag lands exactly
  where it is dropped.
- Tiles are buttons in a list per section: reachable by Tab, activated by Enter or Space (placing at
  the view's centre), named "Insert <title> from <library>" for screen readers.
- The palette, and with it My shapes, is not offered on a read-only tab (a view-role share) or in
  Draw mode (its dock replaces the palette); a locked tab places nothing.
- The list loads once per owner when the editor opens; an import or a change
  in the Explorer shows on the next open. Offline Mode documents place items too, from the list the
  owner last loaded.

## Managing libraries: the Explorer

The Explorer's **Library** section gains **Shape Libraries** beside Image gallery
([Folders](folders.md)):

- Route `/explorer/shape-libraries`; a sidebar row **Shape Libraries** with a shapes glyph, under
  **Library**, after Image Gallery ([Explorer structure](explorer-structure.md)). The page header's **Import from** group shows there as on every Explorer page.
- The page lists the owner's libraries, newest first, each a card: name, "14 shapes", the first eight
  items' thumbnails; **Rename** (inline, the same name rules; Enter saves, Escape cancels; a name the
  owner already uses is refused with "You already have a library with that name."), **Delete**
  (confirm: "Delete this shape library? Its shapes leave My shapes; documents that use them keep
  them."). **Show shapes** expands the card to every item, each with its title and a **Delete**
  button named "Delete <title>" (no confirm: one shape; the library itself is confirmed). Deleting the
  last shape deletes nothing else: an empty library stays until deleted.
- Deleting a library or an item never touches documents: a placed item is ordinary elements.
- Loading: the cards' skeleton; a failed load: "Couldn't load your shape libraries." with **Try
  again**. Empty state: "No shape libraries yet. Import a draw.io library with Import from draw.io."

## API

A REST resource at `/api/shape-libraries` (the owner guard and the 400 / 404 conventions and envelopes of
the api's other routes):

- `GET /api/shape-libraries` → `{ libraries: ShapeLibrary[] }`, the owner's, newest first.
- `POST /api/shape-libraries` `{ id, name, source, items }` → `{ library }` (201); the api applies the
  name-clash suffix and returns the name it stored. 409 `shape_library_cap` past the cap; 413 over the
  size budget.
- `PUT /api/shape-libraries/:id` `{ name?, items? }` → `{ library }`: renaming, and deleting items
  (the client sends the remaining items). Someone else's library answers 404, as a missing one does.
- `DELETE /api/shape-libraries/:id` → 204; 404 for a missing library or someone else's.

Items are validated as the tab endpoints validate elements (`isValidElement`, after the same
element migration), and stored as JSON in one column. 400 for a missing or invalid field, an item
that fails validation, more than `MAX_SHAPE_LIBRARY_ITEMS` items, or a name over 120 characters;
409 `shape_library_name_taken` for a rename onto a name the owner already uses.

The route is owner-scoped in the guest-id guard (`OWNER_SCOPED_SEGMENTS`). Deleting an account deletes
its libraries; `POST /api/migrate` moves a guest's libraries to the signed-in
owner, renaming any that clash with a name the account already uses by the same " (2)" rule.

## Storage

Each person's libraries live in their own Durable Object, `PersonStore` (binding `PERSON_STORE`, one
SQLite-backed instance per person id, `apps/api/src/person-store/`), in a table `shape_libraries`
(`id`, `name`, `source`, `items` JSON, `created_at`, `updated_at`). Every row is that person's, so
there is no owner column, and the cap, the id check and the name rules run inside the store with the
write they guard. The worker reaches the store through `apps/api/src/person-client.ts`. A read of a
store that never held anything gives it no storage.

## Telemetry

The existing vocabulary ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)):
`track('Element', 'Imported', 'ShapeLibrary')` per library imported, `track('Element', 'Added',
'LibraryShape')` per item placed, `track('Element', 'Deleted', 'ShapeLibrary')` per library deleted: existing
pairs, new types only.

## Out of scope (for now)

- Making a library from shapes on the canvas, or adding to one (only imports make libraries today).
- Timeline cards for libraries.
- Live updates across open editors: a change shows on the next open.
- Team-shared libraries (a `team_id`).
- Exporting a library back to draw.io.
- Libraries from other tools.
