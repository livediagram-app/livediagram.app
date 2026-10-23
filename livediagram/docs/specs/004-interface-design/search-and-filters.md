# Search and filters

A search that can also be narrowed by filters is **one field**, never a box with a row of filters under it: the
filters live in the search, as the Community gallery's search box reads (its category, tags and sort written into the
query, [Community](../025-community/community.md)). The box always reads as the whole query.

## The field

- A search glyph, then a **chip** per filter ("Category: Flowcharts", its cross to remove it), then the words being typed,
  wrapping onto more lines when the chips need them.
- Inside the box's right edge: **Clear Search** (a cross, while there are words or filters), which clears both, and
  the control that adds a filter (**Add Filter**, a quiet button: a field, then a value with its count).
- **Backspace** in an empty box takes the last filter off. A press on the box's empty space puts the caret in it.
- With filters on, the placeholder reads "Search these…".
- The box takes the focus ring of a text field (brand border and ring) wherever focus is inside it.

## Where it is used

- The Community gallery's search box ([Community](../025-community/community.md)).
- No editor surface uses `FilterSearchBox` today; it is the field the next filterable search builds on.
- A surface whose filters are not a search's (a view of filters alone) keeps its filter bar.

## Building it

- `FilterSearchBox` (apps/editor/components/primitives) draws the field; the caller owns what a chip and the add
  control mean. The Community box predates it and writes its filters as text tokens; both read the same way.
