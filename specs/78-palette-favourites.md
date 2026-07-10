# 78. Palette Favourites

A **Favourites** category in the palette's category dropdown: one 3x3 grid
holding the user's most-used creation tiles, so the everyday vocabulary
(square, circle, text, arrow, ...) is one dropdown pick away instead of
spread over Shapes / Tools / Data / Components / Devices. Editable in place,
in the spirit of iOS Control Centre: an Edit mode with remove badges on the
current set and add badges on everything else.

## Where it lives

- A new entry, **Favourites**, in the palette category dropdown
  (`PaletteTabBar` — see [spec/09](09-canvas-and-palette.md)), listed
  **first** (above Shapes) with a star icon.
- **Shapes stays the default open category** on every diagram load
  (spec/09's rule is unchanged); Favourites is an option, not the landing
  tab.

## The grid

- Renders the favourited tiles in the same 3-column `IconButton` grid every
  other creation tab uses — same tile size, captions, theme tinting
  (spec/09 "Palette tiles preview the active tab theme"), draw-to-size
  arming, drag-to-place, and pending-draw highlight. A favourite behaves
  IDENTICALLY to the same tile in its home tab; only the grouping differs.
- **Default set (9)** — the nine highest-value creation actions, which are
  exactly the tiles important enough to have earned single-key shortcuts
  (plus the sticky note): **Square (R), Circle (O), Diamond (D), Text (T),
  Pencil (P), Arrow (A), Sticky note (N), Table, Image (9)**.
- Tiles gated on capabilities elsewhere stay gated here: the Image / Avatar
  / Hero / Header tiles only render when the editor supplies `onAddImage`
  (matching the Tools / Components tabs), so a favourited Image tile
  disappears rather than dead-ends in sessions without image support.
- An empty favourites set (everything removed) shows a short hint ("No
  favourites yet — Edit to add some") instead of a bare panel.

## Edit mode (the Control-Centre interaction)

- A small **Edit** affordance sits under the grid (text button, right-
  aligned, quiet). Clicking it flips the tab into edit mode; the button
  becomes **Done**.
- In edit mode:
  - The current favourites each carry a **red minus badge** (top-left
    corner of the tile). Tapping the badge (or the tile) removes it
    immediately.
  - Below, under an **"More controls"** section label, every remaining
    tile from the pool renders with a **green plus badge**; tapping adds
    it to the end of the favourites grid.
  - Tiles never fire their add-to-canvas action while editing — the whole
    surface is for curation only.
- The pool is **every creation tile in the shared catalogue**: the Shapes,
  Tools, Data, Components, and Devices grids (all driven by
  `palette-tile-defs.tsx`, below). Search-driven catalogues (Icons /
  Technology) are out of scope — they are open-ended sets, not fixed
  controls.
- In edit mode the pool is grouped by its home category with the same
  section labels the Tools tab uses (Shapes / Tools / Data / Components /
  Devices), so a control is findable by where the user already knows it
  from.
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
  is one data entry — id (`shape:square`, `tool:text`, `component:banner`,
  ...), section, label / caption / description, glyph, shortcut,
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
  `track('UI', 'Toggled', 'PaletteFavouritesEdit')` when edit mode opens.
  Tile ids never ride along (`type` is always the fixed token).
