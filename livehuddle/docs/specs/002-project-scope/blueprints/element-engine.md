# The element engine: blueprint

Derived from [Not in livehuddle](../not-in-livehuddle.md) "The element engine" and "Retired elements". It holds part 1
of Work Tracker #459 and the rules every later part follows.

## Domain and naming

- **Retired shape kind**: a `shape` element whose `shape` is not in `SHAPE_KINDS` (`packages/document/src/shape-kinds.ts`).
  `isRetiredElement` already answers true for one; nothing new names it.
- **Retired element type**: an element whose `type` is in `RETIRED_ELEMENT_TYPES`
  (`packages/document/src/retired-kinds.ts`). Part 1: `video`. Typed `RetiredTypeElement` (`element-types.ts`): the
  box (`id`, `type`, `x`, `y`, `width`, `height`) and the shared boxed fields the generic code paths read (label,
  colours, opacity, shadow, rotation, animation, link, comments, action, note, text settings), all optional but the
  box. It takes the place of `VideoElement` in `BoxedElement`.
- **Retired element**: either. `isRetiredElement(el)` is true for both; `retiredElementName(el)` reads
  `RETIRED_SHAPE_NAMES[shape]` for a shape and `RETIRED_TYPE_NAMES[type]` for a type, else `UNKNOWN_ELEMENT_NAME`.
- Part 1's names: Pie Chart, Bar Chart, Line Chart, Legend, Progress Bar, Progress Ring, Rating, Code Block, Checklist, Page, Banner, Stat Row, Process, Site Header; the type `video` is **Embed**.

## Behaviour and state

- Load: `migrateStoredTab` runs nothing that reads a retired element's own fields. `settleChartRows`
  (`malformed-chart-rows.ts`) is deleted with its test.
- Validation (`validate.ts`): `ELEMENT_TYPES` keeps `video` through `RETIRED_ELEMENT_TYPES`, and `boxedIssue` checks
  only the box for one. Shape validation needs no change (a shape of an unknown kind already passes on its box).
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
  (`group-hover`), while it holds focus (`focus-visible`), or while the element is selected (`selected` prop).

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

## Errors and edge cases

- A retired element with a zero or non-finite box draws an empty card (the layout clamps to 0) and shows no button.
- A box too small for the button (under 72 by 40, a zero box included) shows no button; the Delete key, the context
  menu and the multi-selection still remove it.
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
  (`bg-black/10`, `bg-white/10` in dark). Tooltip "Delete <name>". Top-right, 4 px inset. On touch, where there is no
  hover, a tap selects the element and shows the button.

## Accessibility

- A real `<button type="button">`, `aria-label="Delete <name>"`, focus-visible ring, at least 24 by 24 px (WCAG 2.2
  target size). The card's words stay `aria-hidden` (the element's accessible name comes from its wrapper).

## Testing

- `retired-kinds.test.ts` (`packages/document`): a tab holding each part 1 shape kind, and one holding a `video`, loads
  through `migrateStoredTab` and `migrateIncomingTab` deep-equal to what was stored, passes `isValidTab`, and names
  each.
- `svg-render-retired.test.ts`: the export draws the placeholder for a retired type and kind.
- `RetiredElementFace.test.tsx` (editor): the face shows the name and the note; Delete renders only with `onDelete` and
  a box of at least 72 by 40; a press calls it with the id and stops the pointer from reaching the wrapper; the
  router passes Delete only when not read-only (a Participant or a Viewer); `deleteElementById` removes one id as one
  commit.
- `packages/edit-operations` and `packages/document-views`: an agent's `add` of a retired kind gets a square with a
  warning, `add video` is refused, and the views print a retired element as `?` with no state or summary.

## Constants and configuration

- `RETIRED_DELETE_MIN_WIDTH = 72`, `RETIRED_DELETE_MIN_HEIGHT = 40`: the smallest card that fits the button beside
  the name.

## Defaults ledger

- D17, D18 in [DEFAULTS.md](DEFAULTS.md).
