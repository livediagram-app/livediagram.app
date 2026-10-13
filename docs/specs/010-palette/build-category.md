# The Build palette category

A top-level palette category in the **Structure** band holding the elements you
lay a diagram _out_ with, as opposed to the ones you draw _on_ it:

| Tile          | Came from     |
| ------------- | ------------- |
| **Mind Node** | Write (Tools) |
| **Flowchart** | (new)         |
| **Lane**      | Draw (Tools)  |
| **Frame**     | Draw (Tools)  |
| **Timeline**  | Components    |
| **Table**     | Data          |
| **Sankey**    | (new)         |

The **Sankey** ([Sankey diagram](../009-elements/sankey.md)) joined later and sits last. It is the one Build
element that lays itself out from data rather than holding work you place in it; it is here because a
Sankey is a structure you choose for a whole picture (how much moves where), the same moment as choosing
lanes or a timeline. It is in Diagram and Illustrate (as an infographic), and left out of Facilitate,
where a session does not stop to chart a flow.

The **Flowchart** ([The flowchart](../009-elements/flowchart.md)) joined later, beside the Mind Node: it
drops a Start that grows into a chart from the keyboard and lays itself out. Like the Mind Node it is
in Diagram mode and left out of Illustrate, where a page, not a process, is being arranged.

## Why it exists

These five were filed by **what they look like**, and it scattered them: the
mind node sat with the wordy elements because it holds a word, the lane and
the frame with the gesture tools because you drag them out, the timeline with
the web components, the table with the charts. Nothing about that grouping
helps somebody who is about to structure a canvas.

What the five have in common is the thing worth grouping on: **each one holds
other work**. A frame gathers a region, a lane carries the steps in a row, a
timeline sequences events along a track, a table organises cells, a mind node
hangs children off itself. You reach for them at the same moment — when you
have decided how the diagram is arranged, before you have decided what goes in
it — and that moment deserves one place to look.

It sits in **Structure**, first in the band, because structuring a canvas is
its own act, distinct from the everyday shapes and text in Common and from
decoration or a dynamic behaviour.

## Rendering

Rows with a blurb (`PaletteToolRows`), not a bare icon grid — the same
treatment as Behaviour and Data, for the same reason. The containers all look
like rectangles at 18px, so the picture does not separate them; "Tab adds a
child, Enter a sibling" against "A titled band that carries its steps" is what
the reader is actually choosing between.

## Notes

- Tile **ids are unchanged** (`tools:frame`, `tools:table`, …). Only the
  `section` moved, so anything addressing a tile by id keeps working
  (`tools:frame` is in Diagram mode's Popular).
- Write, Draw, Data and Components each lost exactly the tiles listed above
  and are otherwise untouched.
- See [Palette top-level categories and bands](palette-top-level-categories.md) for the band taxonomy this joins.
