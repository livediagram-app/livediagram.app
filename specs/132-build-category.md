# 132 — The Build palette category

A top-level palette category in the **Common** band holding the elements you
lay a diagram _out_ with, as opposed to the ones you draw _on_ it:

| Tile          | Came from     |
| ------------- | ------------- |
| **Mind node** | Write (Tools) |
| **Lane**      | Draw (Tools)  |
| **Frame**     | Draw (Tools)  |
| **Timeline**  | Components    |
| **Table**     | Data          |

## Why it exists

These five were filed by **what they look like**, and it scattered them: the
mind node sat with the wordy elements because it holds a word, the lane and
the frame with the gesture tools because you drag them out, the timeline with
the web components, the table with the charts. Nothing about that grouping
helps somebody who is about to structure a board.

What the five have in common is the thing worth grouping on: **each one holds
other work**. A frame gathers a region, a lane carries the steps in a row, a
timeline sequences events along a track, a table organises cells, a mind node
hangs children off itself. You reach for them at the same moment — when you
have decided how the diagram is arranged, before you have decided what goes in
it — and that moment deserves one place to look.

It sits in **Common** because structuring a board is ordinary work, not a
decoration or a dynamic behaviour, and second in the band (after Shapes)
because the two are the same kind of act: putting a thing on the canvas.

## Rendering

Rows with a blurb (`PaletteToolRows`), not a bare icon grid — the same
treatment as Behaviour and Data, for the same reason. Five containers all look
like rectangles at 18px, so the picture does not separate them; "Tab adds a
child, Enter a sibling" against "A titled band that carries its steps" is what
the reader is actually choosing between.

## Notes

- Tile **ids are unchanged** (`tools:frame`, `tools:table`, …). Only the
  `section` moved, so saved Favourites keep working — `tools:frame` is a
  default favourite and must not break.
- Write, Draw, Data and Components each lost exactly the tiles listed above
  and are otherwise untouched.
- See [spec/110](110-palette-top-level-categories.md) for the band taxonomy this joins.
