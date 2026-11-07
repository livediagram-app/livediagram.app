# The element engine: blueprint

Derived from [Not in livehuddle](../not-in-livehuddle.md) "The element engine" and "Retired elements". It holds parts 1 and
2 of Work Tracker #459 and the rules every later part follows.

## Domain and naming

- **Retired shape kind**: a `shape` element whose `shape` is not in `SHAPE_KINDS` (`packages/document/src/shape-kinds.ts`).
  `isRetiredElement` already answers true for one; nothing new names it.
- **Retired element type**: an element whose `type` is in `RETIRED_ELEMENT_TYPES`
  (`packages/document/src/retired-kinds.ts`). Part 1: `video`; part 2: `table`. Typed `RetiredTypeElement` (`element-types.ts`): the
  box (`id`, `type`, `x`, `y`, `width`, `height`) and the shared boxed fields the generic code paths read (label,
  colours, opacity, shadow, rotation, animation, link, comments, action, note, text settings), all optional but the
  box. It takes the place of `VideoElement` and `TableElement` in
  `BoxedElement`; its `type` is `'video' | 'table'`.
- **Retired element**: either. `isRetiredElement(el)` is true for both; `retiredElementName(el)` reads
  `RETIRED_SHAPE_NAMES[shape]` for a shape and `RETIRED_TYPE_NAMES[type]` for a type, else `UNKNOWN_ELEMENT_NAME`.
- Part 1's names: Pie Chart, Bar Chart, Line Chart, Legend, Progress Bar, Progress Ring, Rating, Code Block, Checklist, Page, Banner, Stat Row, Process, Site Header; the type `video` is **Embed**.
- Part 2's name: the type `table` is **Table**.

## Behaviour and state

- Load: `migrateStoredTab` runs nothing that reads a retired element's own fields. `settleChartRows`
  (`malformed-chart-rows.ts`) is deleted with its test.
- Validation (`validate.ts`): `ELEMENT_TYPES` keeps `video` and `table` through `RETIRED_ELEMENT_TYPES`, and
  `boxedIssue` checks only the box for one. Part 2 deletes `tableIssue` and `MAX_TABLE_ROWS`, `MAX_TABLE_COLS` and
  `MAX_TABLE_CELLS`: a stored table's `cells` are never read, and the api's byte-size caps still bound a tab. Shape validation needs no change (a shape of an unknown kind already passes on its box).
- Render: `ElementFaceRouter` and `svgElement` (`svg-render.ts`) take the placeholder branch for `isRetiredElement(el)`
  before any other branch, for any `type`. `paint-order`, the variant chrome (`element-variant.ts`) and the sketch
  finish treat a retired type as they treat a retired shape.
- Delete: `RetiredElementFace` takes `onDelete?: (elementId: string) => void`. The button renders only when `onDelete`
  is set; `EditorCanvasHost` sets it only when the tab is not read-only, the elements layer and `ElementFaceRouter`
  drop it when `readOnly`, and the handler checks `can.remove(el)` again. The press calls `stopPropagation` on
  `pointerdown` (so the wrapper never starts a select or a drag) and on `click`, then `onDelete(element.id)`, which
  runs `deleteElementById` (`useElementSelectionActions`): the editor's ordinary removal of one id
  (`removeSelected(new Set([id]))`), one history entry that takes its attached arrows with it, as Delete does.
- Visibility: the button is in the DOM for an Editor always and shown by CSS while the element wrapper is hovered
  (`group-hover`), while it holds focus (`focus-visible`), or while the element is selected (`selected` prop). While
  hidden it is `pointer-events-none` (made `auto` by the same hover or selection), so a touch, which has no hover,
  can't press it on an unselected card; focus ignores pointer-events, so the keyboard still reaches it. A tap that
  selects the card shows the button under the finger before the tap's click lands, so a click deletes only when its
  press began on the button, or comes from the keyboard (`detail` 0).

## Interfaces and contracts

- `RETIRED_ELEMENT_TYPES: ReadonlySet<string>`, `RETIRED_TYPE_NAMES: Readonly<Record<string, string>>`,
  `isRetiredElementType(type: unknown): boolean`.
- `RETIRED_ELEMENT_NOTE = 'No longer supported in livehuddle'`.
- `RetiredElementFace({ element, fontFamily, selected?, onDelete? })`, `element: { id, type, shape?, label?, width,
height }`.
- `BoxedElementViewProps.onDeleteRetired?: (id: string) => void`, threaded `EditorCanvasHost` → `Canvas` →
  `CanvasElementsLayer` → `BoxedElementView` → `ElementFaceRouter`, replacing part 1's deleted
  `onToggleChecklistItem` plumbing.

## Data and persistence

- Nothing is written on load. A retired element's stored fields are never read beyond `type`, `shape`, `label`,
  `session` (a session button's name) and the box, so a save writes back what was read.
- The removed fields leave the `ShapeElement` type (`pieSlices`, `lineSeries`, `legendItems`, `progress*`, `rating*`,
  `code*`, `checklistItems`, `stats`, `processSteps`, `navLinks`, `chart*`); a stored one
  stays on the object at run time.
- Part 2 deletes `TableElement` and `TableCellStyle` with every field only a table had (`cells`, `cellStyles`,
  `colWidths`, `rowHeights`, `headerRow`, `headerColumn`, `zebra`, `tablePreset`, `headerTextColor`), and the
  helpers that read them (`table.ts`, `table-header-colours.ts`, `svg-render-table.ts`). Shared fields a table
  also used (`headerFill`, a link) stay on the kinds that keep them.

## Errors and edge cases

- A retired element with a zero or non-finite box draws an empty card (the layout clamps to 0) and shows no button.
- The button is measured on screen and only ever shows inside the card:
  `retiredDeletePlacement(card, width, height, zoom, indicators)` puts it in the top-right corner when the card is at
  least 72 by 48 screen px. When the element's indicator cluster is drawn (zoom at least `ADORNMENT_MIN_ZOOM`) and
  overlaps that corner, the button steps left so its right edge sits 4 px left of the cluster, still 12 px down. The
  cluster's box comes from `indicatorClusterRect` (`ElementIndicators.tsx`), the same placement (`placeCluster`) and
  sizes (`clusterSize`, the pip's inset) the cluster draws with; `BoxedElementView` passes it through
  `ElementFaceRouter` for a retired element. The button shows only if it then stays right of the top-left grip (12 px)
  and no line of words reaches it (the layout's `top` and `width` for each line, against the button plus a 4px gap,
  measured back into the card's units by the zoom). Otherwise none shows, a zero box included, and the selection
  toolbar's Delete, the Delete key, the context menu and the multi-selection remove it. There is no button outside
  the card: one there read as the next card's Delete at a phone's Fit zoom.
- A retired type with no `label` shows no label line.

## Security and trust

- The button is presentation: the room's op gate refuses an element removal from a Participant or a Viewer as it
  always has. No new op.

## Performance and limits

- Deleting code shrinks the editor's element engine; the placeholder adds one small SVG and one button per retired
  element, rendered only for those.

## Presentation and UX

- The button: icon only, 24 by 24 px with a rounded-md corner, the Lucide bin glyph at 14 px in the card's ink.
  Hidden (`opacity-0`) until the element is hovered (`group-hover/el`), the button holds keyboard focus
  (`focus-visible`, with the brand ring `focus-visible:ring-2`) or the element is selected. Hover tints it
  (`bg-black/10`, `bg-white/10` in dark). Tooltip "Delete <name>". Counter-scaled by `1 / zoom` (as the grips are), so
  it is 24 screen px at every zoom, 12 screen px in from the top and right edges: the grips' touch pads reach 10 px
  into a card at a corner and 7 px at an edge's middle (`HIT_PAD_INWARD`), so the button never sits under one. On
  touch, where there is no hover, a tap selects the element and shows the button, or, on a card too small for it,
  the selection toolbar's Delete. Only the button reads the zoom, so a zoom re-renders it and not the card.

## Accessibility

- A real `<button type="button">`, `aria-label="Delete <name>"`, focus-visible ring, at least 24 by 24 px (WCAG 2.2
  target size). The card's words stay `aria-hidden` (the element's accessible name comes from its wrapper).

## Testing

- `retired-kinds.test.ts` (`packages/document`): a tab holding each part 1 shape kind, and one holding a `video`, loads
  through `migrateStoredTab` and `migrateIncomingTab` deep-equal to what was stored, passes `isValidTab`, and names
  each. Part 2 adds a `table` with cells, cell styles, a cell link, column and row sizes and a table look: it loads
  and saves deep-equal and is named Table.
- `svg-render-retired.test.ts`: the export draws the placeholder for a retired type and kind.
- `RetiredElementFace.test.tsx` (editor): the face shows the name and the note; Delete renders only with `onDelete`
  and, inside, on a card of at least 72 by 48 on screen whose words sit clear of the button's corner; it keeps 24
  screen px at zoom 0.5, 1 and 2; nothing renders outside the card or into the grips layer at zooms 0.1 to 4; across
  sizes and zooms it never overlaps a grip's touch pad; it steps left of a comment pip and of a three-indicator cluster
  (Top and Footer styles) with a 4 px gap; it hides with no room left of the indicators or clear of the words; a press calls it with the id and stops the pointer from reaching the wrapper; the
  router passes Delete only when not read-only (a Participant or a Viewer); `deleteElementById` removes one id as one
  commit.
- `CanvasSelectionToolbars.retired.test.tsx` (editor): the selection toolbar's Delete removes a selected retired
  element for an Editor and is not offered when read-only (a Participant or a Viewer).
- `packages/edit-operations` and `packages/document-views`: an agent's `add` of a retired kind gets a square with a
  warning, `add video` and `add table` are refused, and the views print a retired element as `?` with no state or summary.

## Constants and configuration

- `RETIRED_DELETE_MIN_WIDTH = 72`, `RETIRED_DELETE_MIN_HEIGHT = 48` (screen px): the smallest card that can hold the
  button inside. A card at least that big still holds it only when no line of words reaches its corner (D18).
- `RETIRED_DELETE_SIZE = 24`, `RETIRED_DELETE_INSET = 12`, `RETIRED_DELETE_GAP = 4` (screen px): the button, its
  inset from the top-right corner, and the gap it keeps from the indicators and the words (D17).

## Defaults ledger

- D17, D18 in [DEFAULTS.md](DEFAULTS.md).
