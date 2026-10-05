# Palette Favourites (removed)

Status: removed 2026-10-03, superseded by **Popular**
([Editor modes, "The palette per mode"](../007-editor/editor-modes.md#the-palette-per-mode)).

The palette used to open on **Favourites**: a per-browser grid of the person's
go-to tiles, with an **Edit Favourites** dialog to add and remove them, a
**Reorder** mode, a star on every palette row to favourite it on the spot, and a
search box across every category.

It is gone. Every editor mode's palette now opens on its own **Popular**: a
fixed pick of twelve tiles from across that mode's categories, the same for
everyone, not edited or reordered. Diagram mode's Popular is what the default
Favourites were (Square, Circle, Diamond, Text, Arrow, Frame, Sticky note,
Image, Shape pen, Table, Code block, Entity).

What went with it:

- The Favourites category, its body, the Edit Favourites dialog, Reorder, and
  the row stars.
- The per-browser list (`livediagram:v2:palette-favourites` in `localStorage`).
  It is no longer read; a stored list is left in place and ignored.
- The Favourites body's cross-category search. Elements stay findable from the
  editor's **Search** panel ([Canvas and palette](../008-canvas/canvas-and-palette.md)),
  which searches every tile.
- Its events, retired on the telemetry dashboard
  ([Telemetry, "Retired features"](../017-telemetry/telemetry.md#retired-features)).
- Its help article: `palette/favourites` redirects to `palette/popular`.

What stays: tile ids are still stable (`palette-tile-defs`), since palette
layouts, the Search panel and the Toolbar strip address tiles by id.

The Explorer's **document** favourites (starred documents) are a separate
feature and are unchanged ([Favourites](../013-workspace/favourites.md)).
