# 108 — Tile grids for the palette dropdowns

Status: shipped

## What

The **canvas-tool** picker (Select / Hand / Eraser / Format / Laser /
Spotlight / Avatar / Isometric / Zen) and the **palette category** picker
(Favourites / Shapes / Tools / Components / Devices / Icons / Technology) lay
their options out as an icon-over-label **tile grid** instead of one long
vertical list.

Nine tools in a single column is a lot of travel and a lot of reading for what
is a flat choice between equal-weight modes. The context menus already made
this call — category contents there are `MenuTileGrid`, never a column of
rows — so the two menu systems now read alike.

Measured on the canvas-tool picker: **182px tall against roughly 360px**, at
208px wide.

## When a grid, and when not

`PaletteDropdown` gains a `grid` prop rather than switching wholesale, because
a grid is not always the better shape:

- **Grid** when the options are all **icon-bearing** and of roughly **equal
  weight**, and the list is **short and fixed**. Icons are what make a tile
  scannable; without one a tile is just a word in a box, which is worse than a
  row.
- **List** for text-only options, and for the long scrolling ones (the icon
  category filter runs to dozens of entries) where a column is genuinely
  easier to scan and a grid would need paging.

## Details that had to survive the change

- **Band titles.** The canvas tool's three bands are named — **Edit** (the
  tools that act on the diagram), **Present** (the ones you use in front of an
  audience) and **Preview** (the whole-canvas views). A named band doesn't
  also need a rule to say it started, so the title replaces the divider rather
  than sitting under it. Passed as a `groupLabels` map keyed by group index,
  NOT as a field on the first option: the selected option is filtered out of
  the menu, so a label hanging off an option would vanish exactly when that
  option was the current one.
- **Group bands.** The canvas tool's options carry a `group` index that draws
  a divider where the band changes — select-ish tools, then the presentation
  tools, then the whole-canvas modes. In a grid that becomes a full-width rule
  between rows (`col-span-full`) rather than a rule between two items.
- **Shortcut badges.** Kept, but tucked into the tile's top-right corner
  rather than taking a column of their own. A shortcut is worth discovering
  and worth nothing at the cost of the label's line.
- **The selected option is shown, in its selected tone**, not filtered out.
  It used to be hidden on the reasoning that the trigger already names it —
  but that makes the reader infer the current value from the trigger alone,
  and worse, the remaining options _shift position_ every time the selection
  changes, so the thing you want is never twice in the same place. Showing all
  of them keeps the layout stable and states the current value where you are
  looking. Applies to the list layout too.
- The menu takes a **floor width** (13.5rem) in grid mode. Without it the
  `w-max` sizing that suits a list collapses three columns into something
  unusable.
- **The glyph lifts on hover.** Pointing at a tile raises and grows its icon
  slightly (`translateY(-2px) scale(1.12)`, 160ms). The whole TILE is the
  hover target, so the row acknowledges being pointed at rather than only the
  18px picture, but it is the **glyph** that moves: moving the tile itself
  would shift its own label out from under the cursor. The rule lives in
  `globals.css` keyed off `[role='option']:hover .lvd-opt-glyph` rather than a
  Tailwind named-group variant, which produced no rule at all here.
