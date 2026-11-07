# The Build palette category

> **Leaving livehuddle** (Work Tracker #423): not part of livehuddle's meeting product ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). livediagram keeps it, and [its spec there](../../../../livediagram/docs/specs/010-palette/build-category.md) is the one to change. A diagram tool: part 3 takes it out of the palette; deleting its code is its own card. Until then this describes code livehuddle still carries; build nothing new on it.

A top-level palette category in the **Structure** band holding the elements you
lay a canvas _out_ with, as opposed to the ones you draw _on_ it:

| Tile         | Came from                          |
| ------------ | ---------------------------------- |
| **Lane**     | Draw (Tools)                       |
| **Frame**    | Draw (Tools)                       |
| **Timeline** | Components (since moved to Layout) |

The Table left with Work Tracker #459, part 2 ([The element engine](../002-project-scope/not-in-livehuddle.md#the-element-engine)).
livediagram's Build also held the Mind Node, the Flowchart and the Sankey; they were cut with Diagram and Draw
([Editor modes](../007-editor/editor-modes.md)).

## In Workshop: Layout

Workshop offers the containers and labels as **Layout** ([Editor modes](../007-editor/editor-modes.md#the-palette)):
Lane, Frame, Stack, Boundary, the Timeline ([Timeline](../009-elements/timeline.md)), then Diagram key, Card, Badge,
Step number. Tile ids are unchanged.

## No mode offers Build

No mode offers Build itself today; it remains the catalogue home of these tiles.

## Why it exists

These were filed by **what they look like**, and it scattered them: the lane and
the frame sat with the gesture tools because you drag them out, the timeline with
the web components, the table with the charts. Nothing about that grouping
helps somebody who is about to structure a canvas.

What they have in common is the thing worth grouping on: **each one holds
other work**. A frame gathers a region, a lane carries the steps in a row, a
timeline sequences events along a track, a table organises cells. You reach for them at the same moment, when you
have decided how the diagram is arranged, before you have decided what goes in
it, and that moment deserves one place to look.

It sits in **Structure**, first in the band, because structuring a canvas is
its own act, distinct from the everyday shapes and text in Common and from
decoration or a dynamic behaviour.

## Rendering

Rows with a blurb (`PaletteToolRows`), not a bare icon grid: the same
treatment as Behaviour and Data, for the same reason. The containers all look
like rectangles at 18px, so the picture does not separate them; the blurb ("A titled band that carries
its steps") is what the reader is actually choosing between.

## Notes

- Tile **ids are unchanged** (`tools:frame`, `tools:table`, …). Only the
  `section` moved, so anything addressing a tile by id keeps working
  (`tools:frame` is in Popular).
- Write, Draw, Data and Components each lost exactly the tiles listed above
  and are otherwise untouched.
- See [Palette top-level categories and bands](palette-top-level-categories.md) for the band taxonomy this joins.
