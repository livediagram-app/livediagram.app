# Tile grids for the palette dropdowns

Status: shipped

## What

The **palette category** picker (Popular / Shapes / Tools / Components / Devices / Icons / Technology) lays
its options out as an icon-over-label **tile grid** instead of one long
vertical list.

Nine tools in a single column is a lot of travel and a lot of reading for what
is a flat choice between equal-weight modes. The context menus already made
this call: category contents there are `MenuTileGrid`, never a column of
rows, so the two menu systems now read alike.

Measured on the canvas-tool picker, when there was one: **182px tall against roughly 360px**, at
208px wide.

**livehuddle has no canvas-tool picker** (owner, 2026-11-06): the Selection Mode picker gave way to the
[Edit | Walk toggle](../008-canvas/avatar-mode.md#the-edit--walk-toggle), a two-segment switch rather than a menu, and
Select, Hand, Eraser and Format are no longer modes to pick. What follows about named bands, group bands and shortcut
badges is the grid's mechanism as `PaletteDropdown` keeps it (`groupLabels`, an option's `group` and `shortcut`),
used by the category picker's bands.

## When a grid, and when not

Option lists are the exception: a choice whose names say more than a picture (an element's Finish) is never a tile grid but one bordered list, a row per choice, icon left (`OptionRows`,
`../packages/workbench/src/components/primitives/OptionRows.tsx`). The other context-menu tiles are unchanged.

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

- **Band titles.** A grid's bands may be named (the category picker's `CATEGORY_BANDS`). A named band doesn't
  also need a rule to say it started, so the title replaces the divider rather
  than sitting under it. Passed as a `groupLabels` map keyed by group index,
  NOT as a field on the first option: the selected option is filtered out of
  the menu, so a label hanging off an option would vanish exactly when that
  option was the current one.
- **Group bands.** Options carry a `group` index that draws
  a divider where the band changes. In a grid that becomes a full-width rule
  between rows (`col-span-full`) rather than a rule between two items.
- **Shortcut badges.** Kept, but tucked into the tile's top-right corner
  rather than taking a column of their own. A shortcut is worth discovering
  and worth nothing at the cost of the label's line.
- **The selected option is shown, in its selected tone**, not filtered out.
  Hiding it because the trigger already names it would make the reader infer the current value from the trigger alone,
  and worse, the remaining options _shift position_ every time the selection
  changes, so the thing you want is never twice in the same place. Showing all
  of them keeps the layout stable and states the current value where you are
  looking. Applies to the list layout too.
- The menu takes a **floor width** (13.5rem) in grid mode. Without it the
  `w-max` sizing that suits a list collapses three columns into something
  unusable.
- **The glyph lifts on hover.** Pointing at a tile raises and grows its icon
  slightly (`translateY(-2px) scale(1.12)`, the 150ms `micro` hover token of [Motion](motion.md)). The whole TILE is the
  hover target, so the row acknowledges being pointed at rather than only the
  18px picture, but it is the **glyph** that moves: moving the tile itself
  would shift its own label out from under the cursor. The rule lives in
  `globals.css` keyed off `[role='option']:hover .lvd-opt-glyph` rather than a
  Tailwind named-group variant, which produced no rule at all here.
