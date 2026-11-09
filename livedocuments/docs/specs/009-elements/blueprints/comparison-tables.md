# Comparison and pricing tables: blueprint

Derived from [Comparison and pricing tables](../comparison-tables.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                                          | Role                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/document/src/table-marks.ts`                                        | `TableMark`, `tableCellMark`, `TABLE_MARK_TEXT`, `tableMarkColour`, `tableHighlightColours`, `withHighlightColumn` |
| `packages/document/src/table.ts`                                              | Insert, remove and move keep `highlightColumn` in step                                                             |
| `packages/document/src/element-types.ts`, `element-fields.ts`                 | `TableElement.highlightColumn`                                                                                     |
| `packages/document/src/validate.ts`                                           | `highlightColumn` a whole number within the columns                                                                |
| `packages/document/src/svg-render-table.ts`                                   | Marks and the highlight in every export                                                                            |
| `apps/editor/components/canvas/TableCellView.tsx`                             | The mark face and the highlight washes                                                                             |
| `apps/editor/components/canvas/TableView.tsx`                                 | The column frame                                                                                                   |
| `apps/editor/components/canvas/TableCellMenu.tsx`                             | The Marks row                                                                                                      |
| `apps/editor/components/canvas/TableAxisControls.tsx`, `useTableStructure.ts` | Highlight Column / Remove Highlight                                                                                |
| `packages/workbench/src/components/canvas/table-menu-controls.tsx`            | `TableHeaderMenu` takes an optional `highlight` row                                                                |
| `packages/templates/src/slide-layouts-proof.ts`, `slide-layouts.ts`           | Pricing Table slide (`comparisonTable`)                                                                            |

## Domain and naming

| Term               | Identifier                      | Meaning                                                  |
| ------------------ | ------------------------------- | -------------------------------------------------------- |
| Mark               | `TableMark` `'tick' \| 'cross'` | A cell whose whole trimmed text is a tick or cross glyph |
| Highlighted column | `TableElement.highlightColumn`  | The recommended column's index                           |

Banned synonyms: "checkmark cell", "boolean cell", "featured column".

## Behaviour and state

### Marks

1. `tableCellMark(text)`: `text.trim()` (with a trailing `U+FE0E` / `U+FE0F` variation selector removed) in
   `TICK_TEXTS` is `tick`, in `CROSS_TEXTS` `cross`, else `null`.
2. `tableMarkColour(mark, surface, ground)`: green `#15803d` / `#4ade80`, rose `#be123c` / `#fb7185` for light /
   dark surfaces, through `reachContrast(c, ground, 3)`; `ground` is the cell's resolved background (its own,
   else the highlight wash over the fill, else the table fill, else the paper).
3. Canvas: a mark cell renders an `svg` disc (`D228`) instead of its text, `role="img"` and `aria-label` "Yes" /
   "No". A cell style's `textColor` paints it instead.
4. The Marks row of `TableCellMenu`: Tick, Cross, Clear buttons; each commits `cells` for every selected cell
   (`TABLE_MARK_TEXT.tick` = `✓`, `.cross` = `✗`, Clear = `''`) in one `onCommitTable`, `track('Element',
'Changed', 'TableMark')`.

### Highlighted column

1. `tableHighlightColours(el, surface)`: `wash = colorWash(stroke, 0.1)`, `header = stroke`, `headerInk =
labelOn(stroke)`, `frame = stroke`.
2. Canvas: `TableCellView` paints a body cell of the column `wash` under the zebra stripe (the stripe composes over
   it), a header-row cell `header` with `headerInk`; the cell's own `bg` wins. `TableView` draws one absolutely
   placed 2 px frame `div` over the column's track (left from the column offsets, full height), pointer-transparent.
3. Export: the same, the frame a `rect` with `stroke-width="2"` inset 1 px, drawn after the grid lines.
4. `withHighlightColumn(t, c | null)` writes or removes it. In `table.ts`: `addTableColumn(t, at)` moves it right
   when `at <= highlightColumn`; `removeTableColumn(t, at)` removes it when equal, moves it left when `at <`;
   `moveTableColumn(t, from, to)` follows the moved column and shifts the ones between.
5. Menu: `TableHeaderMenu` gains `highlight?: { on: boolean; onToggle: () => void }`, rendered as a fourth group
   ("Highlight Column" / "Remove Highlight", a star glyph). `useTableStructure.toggleHighlight(c)` commits
   `{ highlightColumn }` through `onCommitTable` (whose patch type gains `highlightColumn`; an `undefined` value
   removes the key), `track('Element', 'Changed', 'TableHighlight')`.

## Interfaces and contracts

- Validation: `highlightColumn` is an integer `0 <= n < cols`; else issue `highlightColumn` "a column index of the
  table".

## Security and trust

- Gate: the axis menu (and so the highlight) shows only where the table's structure may change (`showControls`, an
  Editor on an unlocked table). The Marks row shows wherever the cell menu does.

## Performance and limits

- `tableCellMark` is a `Set` lookup per cell render; a 1,000-row table pays one per visible cell, as the text did.
- The frame is one element per table.

## Testing

| Rule                                                    | Test                       |
| ------------------------------------------------------- | -------------------------- |
| Which texts are marks                                   | `table-marks.test.ts`      |
| Mark colours meet 3:1; highlight colours                | `table-marks.test.ts`      |
| Insert / remove / move keep the highlight in step       | `table.test.ts`            |
| Validation                                              | `validate.test.ts`         |
| Export marks and highlight                              | `svg-render-table.test.ts` |
| Marks row sets every selected cell                      | `TableView.menu.test.tsx`  |
| Highlight item in the column menu, toggles, Editor only | `TableView.menu.test.tsx`  |

## Defaults ledger

D228, D229.
