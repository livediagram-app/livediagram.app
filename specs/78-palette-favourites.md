# 78. Palette Favourites

A **Favourites** category in the palette's category dropdown: one 3x3 grid
holding the user's most-used creation tiles, so the everyday vocabulary
(square, circle, text, arrow, ...) is one dropdown pick away instead of
spread over Shapes / Tools / Data / Components / Devices. Curated in an
**edit modal** (search + category filter + per-row Add / Remove), in the
spirit of customising iOS Control Centre.

## Where it lives

- A new entry, **Favourites**, in the palette category dropdown
  (`PaletteTabBar` — see [spec/09](09-canvas-and-palette.md)), listed
  **first** (above Shapes) with a star icon.
- **Favourites is the default open category** on every diagram load — the
  palette lands on the user's own go-to tiles. (This supersedes spec/09's
  earlier Shapes-by-default rule; the palette still deliberately does not
  persist the last-used category across diagrams.)

## The grid

- Renders the favourited tiles in the same 3-column `IconButton` grid every
  other creation tab uses — same tile size, captions, theme tinting
  (spec/09 "Palette tiles preview the active tab theme"), draw-to-size
  arming, drag-to-place, and pending-draw highlight. A favourite behaves
  IDENTICALLY to the same tile in its home tab; only the grouping differs.
- **Default set (9)** — the nine highest-value creation actions:
  **Square (R), Circle (O), Diamond (D), Text (T), Pencil (P), Arrow (A),
  Sticky note (N), Frame, Image (9)** — mostly the tiles important enough
  to have earned single-key shortcuts.
- Tiles gated on capabilities elsewhere stay gated here: the Image / Avatar
  / Hero / Header tiles only render when the editor supplies `onAddImage`
  (matching the Tools / Components tabs), so a favourited Image tile
  disappears rather than dead-ends in sessions without image support.
- An empty favourites set (everything removed) shows a short hint ("No
  favourites yet — Edit to add some") instead of a bare panel.
- An **Edit** affordance renders as a full-width **footer band** at the
  bottom of the tab (pencil glyph + "Edit"), flush with the panel's edges
  and set off by a top hairline — panel chrome, not a floating button in
  the grid's corner. It opens the edit modal.

## The edit modal (the Control-Centre interaction)

Curation happens in a centred dialog (`PaletteFavouritesDialog`, the shared
`Dialog` shell), not in-place in the panel:

- A **search box** (autofocused) filters the controls by name as the user
  types.
- A **category pill row** — Shapes / Tools / Data / Components / Devices,
  each pill carrying its category glyph (Data borrows a bar-chart mark) —
  picks which catalogue is shown; **Shapes is the initial pick** and there
  is deliberately **no "All"** (one category at a time keeps the grid
  scannable). The search filters within the picked category.
- Controls render as a space-efficient **4-per-row tile grid**. Each tile
  is the familiar glyph + caption with a **corner badge** carrying the
  state: a **red minus** on current favourites, a **green plus** on the
  rest; favourited tiles also get a soft brand tint. **Clicking the tile
  toggles membership.** Toggling applies (and persists) immediately — the
  footer's **Done** button (check glyph) just closes, never a save step.
  Added tiles append to the end of the grid.
- **Desktop keeps the palette in view**: the dialog uses a light,
  blur-free backdrop above `sm` (the `Dialog` shell's `desktop-light`
  backdrop) so the Favourites grid visibly updates as tiles are toggled.
  Below `sm` the standard dim backdrop stays — the panel covers most of a
  phone viewport anyway.
- The pool is **every creation tile in the shared catalogue**: the Shapes,
  Tools, Data, Components, and Devices grids (all driven by
  `palette-tile-defs.tsx`, below). Search-driven catalogues (Icons /
  Technology) are out of scope — they are open-ended sets, not fixed
  controls. Capability-gated tiles (`needsImage`) are hidden from the
  modal in sessions without image uploads, like everywhere else.
- No drag-to-reorder in v1: favourites keep insertion order (defaults
  first). If reordering earns its keep later it can land as a follow-up.

## Persistence

- Per-browser, in `localStorage` under **`livediagram:v2:palette-favourites`**
  (a JSON array of tile ids), read/written via `local-storage-safe`. Not
  synced to the account — like the palette's other UI state (spec/20 scope).
- Unknown / stale ids (a tile renamed or removed in a later release) are
  silently dropped on load; a missing or corrupt key falls back to the
  default nine. Saving an edit writes the full array.

## Implementation

- **Shared tile catalogue** (`components/palette/palette-tile-defs.tsx`):
  every creation tile across Shapes / Tools / Data / Components / Devices
  is one data entry — id (`shapes:square`, `tools:text`,
  `components:banner`, ...), section, label / caption / description, glyph, shortcut,
  `filled` / `noTint` flags, and an **action descriptor** (`{ type:
'shape', kind }` or `{ type: 'text' | 'arrow' | ... }`). The five
  category tabs and the Favourites grid all render from this one
  catalogue via a shared `PaletteTileGrid`, which maps the descriptor to
  the editor's add-handlers and derives the pending-draw highlight — so a
  tile is defined once, and Favourites can never drift from the home tabs.
  (This is the flat-data-catalogue exemption from the file-size target.)
- **Store** (`lib/palette-favourites.ts`): pure load / add / remove helpers
  over the localStorage key, unit-tested (defaults, stale-id drop, corrupt
  JSON fallback).
- Telemetry (spec/22): `track('UI', 'Added', 'PaletteFavourite')` /
  `track('UI', 'Removed', 'PaletteFavourite')` on edits, and
  `track('UI', 'Toggled', 'PaletteFavouritesEdit')` when the edit modal
  opens. Tile ids never ride along (`type` is always the fixed token).
