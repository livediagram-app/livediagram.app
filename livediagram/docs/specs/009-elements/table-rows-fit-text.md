# Table rows grow to fit their text

A table's row grows **taller** when the words in one of its cells need more room than the row has, so text never
runs out of its cell. The table itself is specified in [Canvas and palette](../008-canvas/canvas-and-palette.md)
("Table"); this is the one rule about a row's height following its words.

## The rule

- **What is measured.** Each cell's text is wrapped the way the export wraps it (`wrapLabel`, breaking a word wider
  than the cell), at the cell's width less its padding on both sides, in the cell's own size, weight and slant. The
  row needs the tallest of its cells: the lines at 1.25 times the font size, plus the padding above and below,
  rounded up to a whole pixel.
- **What grows.** A row whose cells need more than its height is pinned to the height they need (`rowHeights[r]`),
  and the table grows by the same amount, downward: its top stays put and every other row keeps its height.
- **When.** On every commit that changes a table's cells: a typed cell (Enter, Tab, an arrow out, a click away),
  Tab off the last cell, a paste into the grid, and the cell menu's Clear. The grown height lands **in the same
  commit** as the words, so one undo takes both back.
- **Never smaller.** A row never shrinks on its own: deleting words leaves the height it had, as a resized table
  keeps the size it was given. Dragging the row's divider, or resizing the table, is how it gets shorter.
- **A table sized to scale** (its text tracks the row height) is measured again after growing, since its font grew
  with the rows, up to `TABLE_FIT_PASSES` (4) times. Past that it keeps the last height; the font is capped at 40 px,
  so the passes settle.
- **Pure and shared.** `tableGrowthForCells(table, before?, measure?)` (`packages/document/src/table-fit.ts`)
  returns the `rowHeights` and `height` that fit the table's cells, or null when every row it measured already fits.
  It measures only the rows whose words differ from `before` (a new row, or one whose cell count changed, counts as
  different; every row when `before` is absent). The editor passes the browser's text measure; without one (a
  Worker) the character-width estimate applies.

## Share roles

- **Editor**: every commit above grows the row.
- **Participant**: may write any table's cells ([Share roles](../013-workspace/share-roles.md)), and the row grows
  with them, taller only, in the same change, as a mind node grows to fit a label a Participant writes. The room
  (`participant-content.ts`) keeps a Participant's taller `height` and `rowHeights` only alongside changed cells,
  only growing (no row shorter than it was, no pinned row unpinned), and at most `MIND_GROW_PX_PER_CHAR` per
  character of the cells' text, so a changed letter can never stretch a table out of reach.
- **Viewer**: writes nothing, so nothing grows.

## Limits

Only the rows a commit changed are measured, once per cell per pass: typing in one cell of a 50 x 20 table measures
one row of 20 cells. A paste that rewrites all 1 000 cells of that table measured in 37 ms per commit (Node, the
character-width estimate, every cell wrapping); a commit is a gesture, never per keystroke or per frame.
