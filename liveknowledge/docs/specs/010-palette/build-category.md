# The Build palette category

A top-level palette category in the **Structure** band for the elements that **hold other work**: the
**Stack** ([The stack](../009-elements/stack.md)) and the **Table**. A stack lines up what is dropped into it,
a table organises cells. You reach for them at the same moment, when you
have decided how a page is arranged and before you have decided what goes in it.

The **Timeline** and the **Sankey** ([Sankey diagram](../009-elements/sankey.md)) are in **Concepts**
([Concept graphics](../009-elements/concept-graphics.md) "Timeline"): on the category bar a flow drawn as wide as what
it carries, or milestones along a track, reads as an idea laid out beside the funnel and the cycle more than as a
structure you build in.

## In Pages: no Build

Pages offers no Build. Of its tiles a page uses two, and each sits with its neighbours instead: the **Stack**
ends **Components** (it lines up the page blocks), the **Table** ends **Data**, under "Tables" (a page reports in
rows as often as in a chart). So the category bar shows no Build; it is the catalogue home of these tiles.

## Rendering

Rows with a blurb (`PaletteToolRows`), not a bare icon grid, the same treatment as Data, for the same reason: the
holders all look like rectangles at 18px, so the picture does not separate them and the blurb is what the reader
chooses between.

## Notes

- Tile ids are `tools:stack`, `tools:table`, …; anything addressing a tile by id (search, a layout) uses them.
