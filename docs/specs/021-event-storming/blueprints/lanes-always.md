# Always on a lane: blueprint

Derived from [Event storming](../event-storming.md) (Phase 6, "Always on a lane"), with
[Snap override (free drag)](../../008-canvas/snap-override.md) and the paste / duplicate / nudge
lines of [Canvas and palette](../../008-canvas/canvas-and-palette.md). The spec decides; this file
adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/diagram/src/event-storming-lanes.ts`           | `laneSnapThreshold`, `nearestLaneTop`, `isOnLane`, `laneStepTop`          |
| `packages/diagram/src/event-storming-lane-landing.ts`    | `settleNotesOnLanes`, `groupRows`, `rowsToLanes`, `landArrivals`          |
| `packages/diagram/src/event-storming-photo-place.ts`     | `placeNewNotes`: columns, rows to lanes with the cascade, along-row slide |
| `packages/diagram/src/event-storming-photo.ts`           | `reconcilePhoto` hands each addition its detector row                     |
| `packages/diagram/src/index.ts`                          | `Tab.esLanesSettled`                                                      |
| `packages/diagram/src/comments.ts` (`graftLiveTabState`) | The mark survives undo / redo / cancel                                    |
| `packages/sticky-vision/src/detect.ts`                   | `toNormalised`: both axes in fractions of the photo's width               |
| `packages/templates/src/templates.ts`                    | `templateCanvasOverrides('event-storming')` marks the board settled       |
| `apps/live/hooks/canvas/boxed-drag-resolve.ts`           | `laneHeld` switches the y threshold                                       |
| `apps/live/hooks/canvas/useEditorDrag.ts`                | Picks the lane anchor of a selection; passes `laneHeld`                   |
| `apps/live/lib/palette-drag-snap.ts`                     | `laneHeld` switches the y threshold                                       |
| `apps/live/lib/palette-drag-preview.ts`                  | `workshop` flag on the drag preview                                       |
| `apps/live/components/palette/palette-tile-drag.ts`      | Publishes `workshop` for a kinded tile                                    |
| `apps/live/lib/stamp-placement.ts`                       | A kinded stamp is held                                                    |
| `apps/live/hooks/canvas/useNudgeSelection.ts`            | Up / down on a workshop note: a lane per press                            |
| `apps/live/lib/paste-placement.ts`                       | `pasteTranslation`, `landPastedCopies`: pointer vs staggered              |
| `apps/live/hooks/canvas/useClipboard.ts`                 | Paste reads the canvas pointer; the menu's Paste passes its own point     |
| `apps/live/lib/canvas-pointer.ts`                        | `pastePointer`: a floating panel is not the canvas                        |
| `apps/live/hooks/canvas/useElementDuplication.ts`        | Duplicate staggers along the lane                                         |
| `apps/live/hooks/canvas/useLaneSettle.ts`                | The one-time settle of an older board                                     |
| `apps/live/lib/import-merge.ts`                          | A file import onto an event-storming tab settles its notes                |
| `apps/live/lib/next-note-add.ts`                         | The next note takes its source's lane                                     |
| `apps/live/lib/insert-between.ts`                        | The slot's `atY` is a lane centre                                         |
| `apps/mcp/src/tab-builders.ts`, `tools.ts`               | `landMcpArrivals` in `update_diagram`                                     |
| `packages/sticky-vision/scripts/placement-check.ts`      | Private harness: photo placement over the labelled walls                  |
| `apps/help/app/canvas/event-storming-boards/page.mdx`    | Help: lanes section                                                       |
| `apps/help/app/canvas/snapping/page.mdx`                 | Help: Cmd/Ctrl is the way off a lane                                      |
| `apps/help/app/palette/event-storming/page.mdx`          | Help: drop the retired lanes switch                                       |

## Domain and naming

| Term            | Identifier                                | Meaning                                                             |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Workshop note   | `isEventStormingNote(el)`                 | A sticky with an event-storming kind: the only thing lanes hold     |
| Lane            | `laneIndexAt`, `laneCentre`, `ES_LANES`   | One row of the fixed stack, pitch 240, lane 0 centred at y = 100    |
| On a lane       | `isOnLane(box)`                           | The box's centre within `LANE_EPSILON` of a lane centre             |
| Held            | `laneHeld: boolean` (resolver argument)   | The y snap has no tolerance for this placement                      |
| Lane anchor     | (useEditorDrag) `laneAnchorId`            | The note of a selection whose lane decides the selection's y        |
| Arrival         | `arrivalIds: ReadonlySet<ElementId>`      | A note being placed by this operation; the only thing that may move |
| Row             | `groupRows(boxes)`                        | Arrivals level with each other, top to bottom                       |
| Cascade         | (internal) `shift`                        | Lanes every later row is pushed by                                  |
| Settle          | `settleNotesOnLanes(elements)`            | Every workshop note off a lane to its nearest lane, y only          |
| Settled mark    | `Tab.esLanesSettled`                      | The board has been settled once and never will be again             |
| Pointer paste   | `pasteTranslation(..., pointer)` non-null | A paste centred on the canvas pointer                               |
| Staggered paste | `pasteTranslation(..., null)`             | A paste 24px right on the same lane                                 |
| Column          | (internal) `Column`                       | Photo arrivals of different rows sharing one left edge              |

Banned synonyms: "snap all", "normalise" (for the settle), "grid" for the lane stack,
"lane-bound", "migration" in user copy (it is "lined up on the lanes").

## Behaviour and state

### Lane geometry (`event-storming-lanes.ts`)

- `laneSnapThreshold(held: boolean): number` — `Infinity` when held, else `ES_LANE_SNAP_Y` (20).
- `nearestLaneTop(box, timeline = ES_LANES): number` — `laneCentre(laneIndexAt(cy)) − h / 2`,
  `cy = y + h / 2`.
- `isOnLane(box, timeline = ES_LANES): boolean` — `|box.y − nearestLaneTop(box)| ≤ LANE_EPSILON`.
- `laneStepTop(box, direction: -1 | 1, timeline = ES_LANES): number` — `t = (cy − laneCentre(0)) / pitch`.
  On a lane (`|t − round(t)| · pitch ≤ LANE_EPSILON`): target `round(t) + direction`. Off a
  lane: target `floor(t)` going up, `ceil(t)` going down. Returns `laneCentre(target) − h / 2`.

### Drag, palette drag, stamp

- `resolveBoxedMove({ …, laneHeld })` and `paletteDragSnapAt({ …, laneHeld })` call
  `snapToLane(candidate, timeline, laneSnapThreshold(laneHeld))`. With `laneHeld` the lane
  snap never returns null, so x capture always runs against the lane the note lands on.
- `useEditorDrag`: `laneAnchorId` = the primary when it is a workshop note, else the first
  workshop note among `drag.startBounds` keys (insertion order), else the primary.
  `laneHeld = laneAnchorId is a workshop note`. `resolveBoxedMove` is called with
  `primaryId: laneAnchorId` whenever the timeline is on (D1).
- Palette drag: `PaletteDragPreview.workshop = true` for a tile with an `esKind`;
  `laneHeld = preview.workshop === true`.
- Stamp: `stampPlacement(x, y, size, board, held)`, with `held = stampHeld(intent)`
  (`intent.type === 'sticky' && !!intent.esKind`).
- Cmd/Ctrl (`noSnap`) passes `timeline: null`, unchanged: the note is free.

### Nudge (`useNudgeSelection`)

- New dep `laneBoard: boolean` (`isEventStormingTab(activeTab)`, the editor's `esBoard`). The step is
  `laneAwareStep(deps, ids, dx, dy)`.
- When `laneBoard && dy !== 0` and the selection holds a workshop note: the anchor is the
  single selection when it is a workshop note, else the first workshop note of the selection
  in document order (D2). `dy := laneStepTop(anchor, sign(dy)) − anchor.y`; `dx := 0` for
  that press. Every member moves by that `dy`.
- Otherwise unchanged. The burst, the checkpoint, the log and the telemetry are unchanged.

### Rows to lanes (`event-storming-lane-landing.ts`)

- `groupRows(boxes)`: sort indices by centre y (ties by x, then index); a box joins the
  current row when `cy − rowFirstCy < ES_LANE_HEIGHT / 2` (100), else it opens a new row.
  Each row's members are sorted by `x` (ties by index). Returns `number[][]`.
- `rowsToLanes(boxes)`: for rows in order, `nearest = laneIndexAt(mean cy of the row)`,
  `lane = max(nearest + shift, previousLane + 1)`, `shift += lane − (nearest + shift)` when it
  was raised. Each member's new `y = laneCentre(lane) − h / 2`. Returns `number[]` of tops.
- `landArrivals(elements, arrivalIds, opts: { x: 'keep' | 'free-slot' | 'capture' })`:
  - Arriving workshop notes (by id, in document order) are the boxes of `rowsToLanes`.
  - When there is exactly ONE arriving workshop note and `x !== 'keep'`, its x is resolved
    with `capturePlacement(bounds, elements, { exclude: arrivalIds, radius })`, `radius` =
    `ES_CANDIDATE_RADIUS_X` for `'capture'` and `0` for `'free-slot'` (0 only resolves an
    occupied spot).
  - Nothing outside `arrivalIds` is touched. Returns the same array when nothing moved.
- `settleNotesOnLanes(elements)`: every workshop note that is not `locked` and not
  `isOnLane` gets `y = nearestLaneTop(note)`. Returns `{ elements, movedIds }`; the input array
  itself when `movedIds` is empty.

### Paste (`paste-placement.ts`, `useClipboard`)

- `pasteTranslation(source, board, pointer)`:
  - Not `isEventStormingTab(board)`, or no workshop note in `source`: `{ dx: 24, dy: 24 }`.
  - `pointer` non-null: the translation that puts the centre of the source's boxed bounding
    box on the pointer (one note: that note's centre).
  - Else: `{ dx: 24, dy: 0 }`.
- `landPastedCopies(elements, copyIds, pointerPaste, singleWorkshopNote)` =
  `landArrivals(elements, copyIds, { x: pointerPaste && singleWorkshopNote ? 'capture' : 'keep' })`.
- `useClipboard` gains `laneBoard` and `canvasPointerRef: RefObject<{ x; y } | null>` (canvas
  coords, null while the pointer is off the canvas). `pasteFromClipboard(source?, at?)`: `at`
  overrides the ref (the canvas menu's Paste passes its right-click point).
- The pointer ref is written by `EditorCanvasHost.onCanvasPointerMove` through `pastePointer(x, y, target)`
  (`lib/canvas-pointer.ts`): null when the pointer left the canvas, and null over a floating panel
  (`[data-floating-panel]`), which lies on top of the canvas and lets its pointer moves through.
  The canvas menu stores the pointer at the right-click as `canvasPoint` and passes it as `at`.

### Duplicate (`useElementDuplication`)

- No new dep: `duplicateOffset(activeTab, ids)` reads the board. When it is an event-storming board
  and the selection holds a workshop note the offset is
  `(24, 0)`, and the copies go through `landArrivals(…, { x: 'keep' })`. Otherwise `(24, 24)`
  and no landing.

### One-time settle (`useLaneSettle`)

- Runs when all hold: `isEventStormingTab(activeTab)`, `activeTab.esLanesSettled !== true`,
  `!editsBlocked` (covers view role, locked tab, and a tab whose content is not `'ready'`), and
  the tab id is not in the session's `settledThisSession` set.
- Adds the id to `settledThisSession` first (so a re-render cannot run it twice).
- `movedIds` non-empty: `commitActiveTab(t => ({ ...t, elements, esLanesSettled: true }))`
  (one undo step, with the activity-log diff), `toastInfo(settleToast(n))`,
  `track('Canvas', 'Used', 'LanesSettled')`, `console.info('[es-lanes] settled', { tabId, moved })`.
- `movedIds` empty: `tickTabs` sets `esLanesSettled: true` on the active tab (no undo step),
  `console.debug('[es-lanes] marked', { tabId })`.
- `graftLiveTabState` carries `esLanesSettled` from the live tab onto the restored snapshot,
  so undo restores positions and keeps the mark.

### File import (`mergeImportedTab`)

- After merging, when the result `isEventStormingTab`: `settleNotesOnLanes` on its elements and
  `esLanesSettled: true`.

### Next note and Alt insertion

- `planNextNote`: `bounds.y = nearestLaneTop(bounds)` before the collision test.
- `findInsertionSlot`: `atY = laneCentre(laneIndexAt(right centre y))`; `spanTop` / `spanBottom`
  unchanged.

### Photo placement (`event-storming-photo-place.ts`)

Input: additions in canvas space (kind silhouette, centred on the transformed photo centre);
existing board notes.

1. **Rows.** `groupRows(additions)` (the paste rows): top to bottom, each left to right.
2. **Columns.** Visit additions by centre x (ties: row, then index). Each joins the first open
   column whose anchor centre is within `PHOTO_COLUMN_RADIUS` (50) and that holds no member of
   its row; otherwise it opens a column anchored at its own centre. For every column of two or
   more, each member's `x` becomes the `x` of its top-most member (smallest centre y, ties by
   index) (D7).
3. **Lanes.** `shift = 0`. Per row: `lane = laneIndexAt(mean cy) + shift`; while any member's
   footprint at `lane` overlaps an existing note (rectangles), or overlaps in x an addition of an
   EARLIER row already on `lane`: `lane += 1`, `shift += 1`. Loop bound
   `existing + additions + 2`; on reaching it the row stays and
   `console.warn('[es-lanes] photo placement bound', …)` fires (never observed).
4. **Along.** Per lane: its additions by original centre x (ties by index); each note's `x` is
   raised to the previous note's right edge + `ES_NOTE_GAP` when it overlaps it, then past any
   existing note its footprint overlaps (right edge + `ES_NOTE_GAP`, repeated).
5. Output: the additions with their new `x` / `y`, in input order.

`toNormalised` divides `cy` and `h` by the image WIDTH as well. `reconcilePhoto`'s seed offset
(nothing in common) takes the minimum over the notes only, so the photo's top row, not its
top edge, lines up with the board's top.

### MCP (`update_diagram`)

- `landMcpArrivals(before, after)`: when the loaded tab `isEventStormingTab`: arrivals are the
  workshop notes of `after` that are new (id not in `before`) or whose `x` / `y` differ from
  `before`; in replace mode, every workshop note. Then `landArrivals(after, arrivals, { x:
arrivals.size === 1 ? 'free-slot' : 'keep' })`.

## Interfaces and contracts

```ts
// event-storming-lanes.ts
export const LANE_EPSILON = 0.5;
export function laneSnapThreshold(held: boolean): number;
export function nearestLaneTop(box: { y: number; height: number }, timeline?: EsTimeline): number;
export function isOnLane(box: { y: number; height: number }, timeline?: EsTimeline): boolean;
export function laneStepTop(
  box: { y: number; height: number },
  direction: -1 | 1,
  timeline?: EsTimeline,
): number;

// event-storming-lane-landing.ts
export type LaneBox = { x: number; y: number; width: number; height: number };
export function groupRows(boxes: readonly LaneBox[]): number[][];
export function rowsToLanes(boxes: readonly LaneBox[]): number[];
export type ArrivalX = 'keep' | 'free-slot' | 'capture';
export function landArrivals(
  elements: Element[],
  arrivalIds: ReadonlySet<ElementId>,
  opts: { x: ArrivalX },
): Element[];
export function settleNotesOnLanes(elements: Element[]): {
  elements: Element[];
  movedIds: ElementId[];
};

// event-storming-photo-place.ts
export const PHOTO_COLUMN_RADIUS = 50;
export function placeNewNotes(additions: PhotoAddition[], existing: BoardNote[]): PhotoAddition[];

// index.ts
type Tab = { /* … */ esLanesSettled?: boolean };
```

The unused `_transform` and `opts`
parameters of `placeNewNotes` go (its one caller is `reconcilePhoto`). `PHOTO_DEFAULT_GAP`
(72, the retired gutter) goes; the slide uses `ES_NOTE_GAP`.

Invalid input is not possible at these seams: every caller holds validated `Element`s. A
non-finite coordinate is passed through unchanged by every helper (D6).

## Data and persistence

| Field                | Class     | Notes                                                                       |
| -------------------- | --------- | --------------------------------------------------------------------------- |
| `Tab.esLanesSettled` | Persisted | In the tab body; `stripUiTabFields` keeps it; the api stores the body as is |
| element `y`          | Persisted | Written by every landing; nothing new on the element                        |
| `settledThisSession` | Session   | A ref in `useLaneSettle`; never persisted                                   |
| `canvasPointerRef`   | Transient | A ref in the editor; never persisted or broadcast                           |

Snapshot / restore: the mark rides every tab snapshot; `graftLiveTabState` keeps the live
value on undo / redo / cancel. Migration: none for storage; the settle IS the migration and
it runs in the editor (so it is undoable), never at the storage boundary.
`schemas.generated.ts` is regenerated for the new optional field.

## Errors and edge cases

| Case                                                  | Handling                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Tab content not loaded yet / load failed              | `editsBlocked`; the settle waits for `'ready'`                            |
| View-only visitor or locked tab opens an older board  | No settle, no mark; the next editor settles it                            |
| Undo of the settle                                    | Positions back, mark kept; never offered again                            |
| Two editors open an older board together              | Both settle to the same positions; the second commit is a no-op diff      |
| Locked workshop note off a lane                       | Left where it is by the settle; a drag cannot move it anyway              |
| A free-placed (Cmd/Ctrl) note after the mark          | Never re-snapped; arrow up / down moves it to the lane on that side       |
| Plain sticky selected with workshop notes             | Anchor is the first workshop note; the sticky rides the same delta        |
| Paste with the pointer over a floating panel          | `pastePointer` reads `[data-floating-panel]` as off the canvas: staggered |
| Paste of shapes only on an event-storming board       | Unchanged: +24, +24                                                       |
| A block paste overlapping notes already there         | Allowed; nothing already down moves                                       |
| A photo row landing on a board note or a row above it | The row goes a lane down; every later row follows, order kept             |
| Photo placement loop bound reached                    | Settles in place, `console.warn('[es-lanes] photo placement bound')`      |
| MCP moves a workshop note off a lane with `update`    | Landed on its nearest lane                                                |

## Security and trust

No new trust boundary. The mark is author data in the tab body like `kind`; a forged `true`
only skips a settle the forger could have undone. MCP input is already validated by
`isValidTab` before landing; landing only rewrites `x` / `y` of workshop notes.

## Performance and limits

- `groupRows` / `rowsToLanes`: O(n log n). `landArrivals`: one `capturePlacement` for a lone
  arrival (O(board notes)).
- `settleNotesOnLanes`: O(n), once per board ever.
- Photo placement: columns O(n · columns), placement O(n · (n + e)) per loop pass with at most
  `n + e + 2` passes per note in the worst case; on the densest labelled wall (272 notes) it runs
  in well under 50 ms (`placement-check.ts` prints the time).
- Drag hot path: one extra boolean; the snap is the existing call.

## Presentation and UX

- The lit lane (overlay) and the slot ghost are unchanged; with a held note a lane is lit on
  every drag frame, because the snap always answers.
- Settle toast (info tone): `Lined up 1 note on the lanes.` / `Lined up N notes on the lanes.`
  (`settleToast(n)`). Undo takes it back like any step.
- Activity log: the settle is an ordinary element diff ("Moved N Domain Events"…), through
  `commitActiveTab`.

## Accessibility

- The toast is announced through the existing live region. Nudge by keyboard moves a whole lane,
  which is the accessible way to change a note's row without a pointer.

## Web Experience

- No layout shift: the settle moves canvas content only, inside the transformed canvas layer;
  the toast is the existing overlay toast. No new bundle: the helpers are in
  `@livediagram/diagram`, already in the editor chunk.

## Observability

| Fingerprint                        | Level | When                                    |
| ---------------------------------- | ----- | --------------------------------------- |
| `[es-lanes] settled`               | info  | A board was settled (tab id, count)     |
| `[es-lanes] marked`                | debug | A board with nothing to move was marked |
| `[es-lanes] photo placement bound` | warn  | The photo loop bound was reached        |
| `Canvas / Used / LanesSettled`     | event | Once per settle that moved notes        |

## Testing

| Rule                                                    | Test                                                      |
| ------------------------------------------------------- | --------------------------------------------------------- |
| Lane step from on / off a lane                          | `event-storming-lanes.test.ts`                            |
| Held y snap at any distance, plain sticky within 20px   | `boxed-drag-resolve.test.ts`, `palette-drag-snap.test.ts` |
| Selection anchored on the first workshop note           | `useEditorDrag.lanes.test.tsx`                            |
| Rows to lanes, cascade, order                           | `event-storming-lane-landing.test.ts`                     |
| Lone arrival on an occupied spot takes a free slot      | `event-storming-lane-landing.test.ts`                     |
| Settle: y only, locked stays, same array when on lanes  | `event-storming-lane-landing.test.ts`                     |
| Pointer vs staggered paste translation                  | `paste-placement.test.ts`                                 |
| Duplicate staggers on the lane                          | `useElementDuplication.test.tsx`                          |
| Nudge a lane per press                                  | `useNudgeSelection.test.tsx`                              |
| Settle once, mark survives undo, blocked when view-only | `useLaneSettle.test.tsx`, `comments.test.ts` (graft)      |
| File import settles                                     | `import-merge.test.ts`                                    |
| Next note on its source's lane                          | `next-note-add.test.ts`                                   |
| Photo: columns, cascade, slide, invariants, isotropy    | `event-storming-photo-place.test.ts`, `detect.test.ts`    |
| MCP landing                                             | `apps/mcp/src/tab-builders.test.ts`                       |
| Template marks the board                                | `packages/templates` test                                 |
| The whole flow in a browser                             | `apps/live/e2e/event-storming-lanes.spec.ts`              |

## Constants and configuration

| Constant              | Value | Provenance                                        | Safe range |
| --------------------- | ----- | ------------------------------------------------- | ---------- |
| `LANE_EPSILON`        | 0.5   | Sub-pixel: coordinates are floats from transforms | 0.01..2    |
| `PHOTO_COLUMN_RADIUS` | 50    | Spec: a quarter of a standard note                | fixed      |
| Staggered offset      | 24    | The existing paste / duplicate offset             | 8..48      |
| Row grouping gap      | 100   | Half a lane's height (`ES_LANE_HEIGHT / 2`)       | 60..120    |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md): D1-D9.
