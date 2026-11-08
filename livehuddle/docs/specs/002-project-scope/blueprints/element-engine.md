# The element engine: blueprint

Derived from [Not in livehuddle](../not-in-livehuddle.md) "The element engine" and "Retired elements". It holds parts 1 to
4 of Work Tracker #459 and the rules every later part follows.

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
- Part 3's names (shape kinds): Lane, Stack, Boundary, Timeline (`timeline-rail`), Diagram Key, Card, Callout,
  Badge, Step Number (`step`), Pointer Note.
- Part 4's names (element types): **Arrow** (`arrow`; **Line** when its `arrowEnds` is `none`), **Drawing**
  (`freehand`), **Path** (`path`), **Annotation** (`annotation`) (D24).
- **Retired arrow**: a stored `arrow`, typed `RetiredArrowElement` (`retired-arrow.ts`): `id`, `type: 'arrow'`, `from`,
  `to` (a `RetiredEndpoint`: `free` with `x`, `y`; `pinned` with `elementId`, `anchor`; `on-arrow` with `arrowId`,
  `t`), and the optional shared fields the generic paths read (`label`, `arrowEnds`, `opacity`, `link`,
  `commentThread`, `action`, `note`, `noteRich`). It is in `Element` but not in `BoxedElement`: `isBoxed` is false
  for it. `RetiredTypeElement` takes `freehand`, `path` and `annotation` (boxed, as `video` and `table`).
- **Retired backdrop**: `isRetiredBackdrop(el)` (`retired-kinds.ts`), a stored `frame`, `lane`, `stack` or `boundary`;
  `paintOrder` draws it first (D19).

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

- Part 3 deletes the load-time rewrites that served its kinds: the callout-to-card migration and
  `railToTimeline` (`element-normalise.ts`). A stored `callout` stays a `callout`; `railCount` and `railLabels` stay
  as stored.
- Part 3 deletes the containment rule (`isContainer`, `isContainerKind`, `deriveContainers`, `containerContents`);
  `containment.ts` keeps the box geometry (`boxCentre`, `boxHoldsPoint`, `smallestHolder`, `contentOrigin`) that
  views and placement read. The editor's drag moves only what is selected (and nothing attached: the attachment
  engine, `attachment.ts`, is deleted with the badge, step and pointer note). Agent views print a flat outline.
- Part 3 deletes the graph input (`graph-input.ts`, `graph-look*.ts`, `graph-lanes.ts`, `graph-header.ts`,
  `graph-branches.ts`, `graph-notches.ts`, `graph-cycle.ts`, `graph-limits.ts`, `graph-authoring.ts`), the cluster
  layout (`auto-layout-clusters.ts`, `auto-layout-cluster-*.ts`) and `buildTabFromGraph`. The general layout engine
  (`auto-layout.ts`, the edit operations' `layout`) stays for part 5. The api's changeset `replace` and seeded tabs
  take no `graph`; edit operations lose `wrap`, `unwrap`, the `in:` selector, the `inside:` placement, growing a
  container to hold (`grow-container.ts`) and a container's scope in make-room. The diagram lint loses its graph
  entry points (`lintGraph`, `compare`) and its group checks; `lintTab` is unchanged.
- An image's `heroCaption` leaves the `ImageElement` type: a stored one rides on the element as a field nothing reads,
  kept by load and save like any unknown field; `HeroCaptionCard` and the export's caption go (D20). The tab's
  `tagColours` stays on `Tab` as an opaque stored value (`tagColours?: unknown`), never read.

- Part 4 (arrows): `retiredArrowEnds(arrow, elements)` resolves both ends each time it is asked (no cache, nothing
  stored): `free` to its point; `pinned` to `ANCHOR_FRACTIONS[anchor]` across the element's box, turned about the
  box's centre by its `rotation`; `on-arrow` to `from + t * (to - from)` of that arrow's own resolved ends, at most
  `RETIRED_ARROW_MAX_HOPS` (4) deep. An end that does not resolve (its element missing, not boxed, a cycle, a
  non-finite number) takes the other end's point; with neither, both sit at `{ x: 0, y: 0 }` (D22).
  `retiredArrowCard(arrow, elements)` is the 160 by 56 box centred on the two ends' midpoint; `elementBounds` returns
  the union of that card and the line's box, so a marquee, fit-to-content, the selection toolbar and the minimap
  read a retired arrow through it. `RetiredArrowView` (editor) draws the line (`pointer-events: none`) and, over it,
  `RetiredElementFace` in a wrapper at the card's box that selects on press, opens the context menu and shows the
  selection ring; it takes no drag. The export draws the same line and card (`svg-render-retired.ts`).
- Part 4: the drag, nudge, resize, duplicate-drag and arrow-gesture paths skip a retired arrow; removing an element
  removes only the ids asked (the pinned-arrow cascade is deleted, D23); a copy carries a retired arrow verbatim with
  a new id, its pinned `elementId`s remapped to the copies only when the pinned element was copied with it.
- Part 4 deletes the arrow engine (`arrow-*.ts`, `anchors.ts`, `anchor-*.ts`, `orthogonal-router.ts`,
  `svg-render-arrows.ts`; `@liveworkspace/model-core`'s shared arrow helpers stay for the other products), the pen
  and path engine (`freehand-points.ts`, `pen-stroke.ts`, `whiteboard-stroke.ts`, `stroke-*.ts`, `path-*.ts`,
  `legacy-stroke-points.ts`), the annotation's factory and face, and the editor's whiteboard intents (`pen`, `path`,
  `fill`), `LiveInk`, `WhiteboardPenPreview`, the path draft and edit layers and every arrow gesture hook. A load-time
  rewrite that only served them (the stroke points' and the bends' settling) goes, so stored fields are never
  touched.

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
- Part 3's removed `ShapeElement` fields: `headerFill`, `headerSize`, `titleOrientation` (the lane's), `pageTitle`,
  `pageSubtitle`, `cardMedia`, `cardHeader`, `tags`, `chipLook`, `attachedTo`, `attachAt`, `stepSequence`,
  `pointerTip`, `keyRows`, `keyMeanings`, `stack*`, `boundaryStyle`, `conceptRows`, `conceptAnim*`, `railCount`,
  `railLabels`. A stored one stays on the object at run time.
- The removed fields leave the `ShapeElement` type (`pieSlices`, `lineSeries`, `legendItems`, `progress*`, `rating*`,
  `code*`, `checklistItems`, `stats`, `processSteps`, `navLinks`, `chart*`); a stored one
  stays on the object at run time.
- Part 2 deletes `TableElement` and `TableCellStyle` with every field only a table had (`cells`, `cellStyles`,
  `colWidths`, `rowHeights`, `headerRow`, `headerColumn`, `zebra`, `tablePreset`, `headerTextColor`), and the
  helpers that read them (`table.ts`, `table-header-colours.ts`, `svg-render-table.ts`). Shared fields a table
  also used (`headerFill`, a link) stay on the kinds that keep them.

- Part 4: `RETIRED_ARROW_CARD_WIDTH = 160`, `RETIRED_ARROW_CARD_HEIGHT = 56`, `RETIRED_ARROW_MAX_HOPS = 4`,
  `retiredArrowEnds(arrow, elements): { from: Point; to: Point }`, `retiredArrowCard(arrow, elements): Rect`,
  `isRetiredArrow(el): el is RetiredArrowElement`.

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
- A retired arrow whose pinned element is moved re-resolves on the next draw; one whose pinned element is deleted
  keeps the dangling `elementId` as stored and draws that end on the other end's point (D22, D23). An `on-arrow` cycle
  stops at four hops. A free end with a non-finite coordinate counts as unresolved.

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
- Part 3: `retired-kinds.test.ts` holds one of each layout container kind with the fields it stored (it loads and
  saves deep-equal and is named), a stored `callout` and a Timeline with `railCount` stay as stored, and a stored
  lane, stack and boundary paint at the back and carry nothing; an image with a `heroCaption` loads and saves
  deep-equal and its export draws no caption (`svg-render-retired.test.ts`); `RetiredElementFace.test.tsx` draws each
  part 3 placeholder and gives Delete to an Editor only; the api's `request.test.ts` refuses a `graph` replace.
- `packages/edit-operations` and `packages/document-views`: an agent's `add` of a retired kind gets a square with a
  warning, `add video` and `add table` are refused, and the views print a retired element as `?` with no state or summary.

- Part 4: `retired-kinds.test.ts` holds an arrow pinned at both ends with a label, bends, a flow and heads, a line
  (`arrowEnds: 'none'`), a pen stroke with pressures, a highlighter stroke, a path with a contour and an annotation
  with a note: each loads deep-equal, saves unchanged, validates and is named. `retired-arrow.test.ts` resolves free,
  pinned (rotated), on-arrow, missing, cyclic and non-finite ends and the card. `svg-render-retired.test.ts` draws a
  retired arrow's line and card and a stroke's placeholder. `RetiredArrowView.test.tsx` draws the line and card,
  selects on press, gives Delete to an Editor only (not a Participant, not a Viewer), and survives its pinned element
  moving and being deleted. Edit operations refuse `add arrow` and `connect`.

## Constants and configuration

- `RETIRED_DELETE_MIN_WIDTH = 72`, `RETIRED_DELETE_MIN_HEIGHT = 48` (screen px): the smallest card that can hold the
  button inside. A card at least that big still holds it only when no line of words reaches its corner (D18).
- `RETIRED_DELETE_SIZE = 24`, `RETIRED_DELETE_INSET = 12`, `RETIRED_DELETE_GAP = 4` (screen px): the button, its
  inset from the top-right corner, and the gap it keeps from the indicators and the words (D17).

## Defaults ledger

- D17 to D24 in [DEFAULTS.md](DEFAULTS.md).
