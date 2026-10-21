# Search and filters

A search that can also be narrowed by filters is **one field**, never a box with a row of filters under it: the
filters live in the search, as the Community gallery's search box reads (its category, tags and sort written into the
query, [Community](../025-community/community.md)). The box always reads as the whole query.

## The field

- A search glyph, then a **chip** per filter ("Card Type: Bug", its cross to remove it), then the words being typed,
  wrapping onto more lines when the chips need them.
- Inside the box's right edge: **Clear Search** (a cross, while there are words or filters), which clears both, and
  the control that adds a filter (**Add Filter**, a quiet button: a field, then a value with its count).
- **Backspace** in an empty box takes the last filter off. A press on the box's empty space puts the caret in it.
- With filters on, the placeholder reads "Search these…".
- The box takes the focus ring of a text field (brand border and ring) wherever focus is inside it.

## Where it is used

- Plan's Cards panel and Setup Sheet's Cards step ([Finding a card](../026-plan/items.md),
  [Setup Sheet](../029-sheets/sheet.md#setup-sheet)), through `CardSearchControls`.
- A surface whose filters are not a search's (Card Search, a view of filters alone) keeps its filter bar.

## Building it

- `FilterSearchBox` (apps/live/components/primitives) draws the field; the caller owns what a chip and the add
  control mean. The Community box predates it and writes its filters as text tokens; both read the same way.
