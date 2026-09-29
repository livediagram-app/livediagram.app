# Bending arrows and the double-press rule: blueprint

Derived from [Bending arrows and the double-press rule](../arrow-bending.md). The spec decides;
this file only adds engineering precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/document/src/arrow-bend.ts`                    | Pure bend maths: grab plan, bow through a point, insert, segment slide                          |
| `apps/live/lib/double-press.ts`                          | The press ledger: double-press pairing and echo detection                                       |
| `apps/live/lib/canvas.ts`                                | `DragState` gains `arrow-bend`                                                                  |
| `apps/live/hooks/canvas/useArrowDragHandlers.ts`         | `beginArrowBend`: plans a bend from a line press; `beginArrowTranslate` for the frame           |
| `apps/live/hooks/canvas/arrow-drag-apply.ts`             | Applies an `arrow-bend` tick from the start snapshot plus the delta                             |
| `apps/live/hooks/canvas/useEditorDrag.ts`                | Engage threshold for every arrow drag except drawing a new arrow                                |
| `apps/live/components/canvas/ArrowView.tsx`              | Line press begins a bend; records presses; move frame for free arrows                           |
| `apps/live/components/canvas/SelectedArrowHandles.tsx`   | Endpoint, curve, bend-point and elbow handles; every press passes `guardPress`                  |
| `apps/live/components/canvas/FreeArrowSelection.tsx`     | The free arrow's selection: ring (move bands) + the shared `ResizeHandles` / `EdgeResizeHandle` |
| `packages/document/src/arrow-scale.ts`                   | `scaleFreeArrow`: ends and bends scaled from the opposite side                                  |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`    | Mounts `FreeArrowSelection` beside a selected free arrow's `<svg>`                              |
| `apps/live/components/canvas/element-parts.tsx`          | Resize handles refuse a paired press (`handlePressStarts`)                                      |
| `apps/live/components/canvas/useBoxedElementGestures.ts` | Body presses are recorded; a paired press starts no drag                                        |
| `apps/live/hooks/ui/usePressWithoutDrag.ts`              | Reads `DOUBLE_PRESS_MS` from the ledger module                                                  |

## Domain and naming

| Term          | Identifier                | Meaning                                                                   |
| ------------- | ------------------------- | ------------------------------------------------------------------------- |
| Bend plan     | `BendPlan`                | What a line press will do once it travels: `bow`, `insert`, `slide`       |
| Grab          | `grab: Pt`                | Canvas point of the press                                                 |
| Grab fraction | `t`                       | Parameter of the grabbed point, clamped to `[BEND_T_MIN, 1 - BEND_T_MIN]` |
| Press ledger  | `pressLedger`             | The last recorded element press                                           |
| Echo press    | `isEchoPress(prev, next)` | Pairs with the previous press, which found the element unselected         |
| Move frame    | `FreeArrowSelection`      | A selected free arrow's ring and scale handles                            |
| Frame handle  | `FrameHandle`             | `nw ne sw se n e s w`, as a box's resize handles                          |

## Behaviour

**Plan** (`planArrowBend(arrow, elements, grab)`), from the style at press time:

- `straight`, or `curved` without `curvePoints`: `bow`. `t` = the grab's projection parameter on
  the chord (straight) or the nearest of 64 samples of the quadratic (curved).
- `curved` with `curvePoints`: `insert` at the index of the nearest segment of
  `[from, ...anchors, to]`, the rule `addCurvePoint` used.
- `angled`: `slide` of the nearest segment of `arrowPathPolyline`; its unit direction is stored.

**Apply** (`applyArrowBend(plan, delta)`), pure, from the start snapshot:

- `bow`: `P = grab + delta`; control `C = (P - (1-t)²·from - t²·to) / (2t(1-t))`;
  `curveOffset = C - chordMid`; `arrowStyle: 'curved'`.
- `insert`: `curvePoints` = start points with `grab + delta - chordMid` spliced in at the index.
- `slide`: `d` = `delta` minus its component along the segment. Segment ends move by `d`; an end
  that is the route's `from` / `to` stays and the moved copy is inserted beside it. Interior vertices
  become `curvePoints` (`vertex - chordMid`); `elbowOffset` is dropped; style stays `angled`.

**Engage.** A line press sets `arrow-bend`; nothing mutates until screen travel reaches
`PRESS_DRAG_SLOP_PX`. The same threshold now applies to every arrow drag (endpoint reposition,
curve, elbow, label, translate) except the endpoint of an arrow being drawn.

**Ledger.** Every element press records `{ id, t: e.timeStamp, x, y, wasSelected }`.
`pairs(prev, next)`: same id, `0 <= next.t - prev.t <= DOUBLE_PRESS_MS`, screen distance
`<= DOUBLE_PRESS_SLOP_PX`. Echo: `pairs && !prev.wasSelected`.

- A press that pairs never starts a drag of any kind.
- **Arrows**: any press on the arrow (line, label, handle) that pairs opens the label editor; a
  paired press on the move frame starts nothing. The line selects first, since selecting resets the edit state. The editor opens on the
  **release** of that press (`pointerup`, dropped on `pointercancel`): opening on its `pointerdown`
  lets the browser's default focus move blur, and so commit, the new editor at once.
- **Boxed elements**: a paired press on the body or a resize handle starts nothing; the browser's
  `dblclick` then reaches the element wrapper, which opens its editor as before.
- Dot votes are cast before the ledger is consulted, so two quick presses during a vote cast two.

**Move frame.** Shown when a single free arrow is selected, editable, not locked and not being
edited. Rect = route bounding box inflated by `MOVE_FRAME_PAD_PX`, drawn as HTML with the shape
selection ring (`ring-2 ring-brand-200`). Four transparent bands of `MOVE_FRAME_HIT_PX` screen px
centred on its sides take the press (cursor `move`) and begin `arrow-translate`. The corner handles
(`ResizeHandles`) and, per axis with extent, the edge handles (`EdgeResizeHandle`) begin
`arrow-scale` with their `FrameHandle`.

**Scale** (`scaleFreeArrow(start, box, handle, delta, keepAspect)`): `box` is the unpadded route
bounds at the press. Per moved side, `s = max(ARROW_SCALE_MIN_PX, extent ± delta) / extent`
(1 for an extent under 0.5px). Shift on a corner uses the larger change on both axes. Points scale
about the opposite side; `curveOffset`, `curvePoints`, `elbowOffset` scale as vectors.

Frame bands and handles record their press through `handlePressStarts`; one that pairs starts
nothing, like a box's handles.

## Errors and edge cases

- Zero-length chord: `bow` falls back to `insert` of a single point (D29).
- A bend that would put `t(1-t)` below `1e-6`: impossible after the clamp.
- Locked arrow, locked tab, read-only, layer-inert: no plan, no frame (existing guards).
- Arrow deleted mid-drag: the tick maps nothing.

## Observability

`console.debug('[arrow-bend]', arrowId, plan.kind)` on engage;
`console.debug('[double-press]', id, 'echo' | 'pair')` when the ledger suppresses a gesture.
Telemetry: `track('Element', 'Changed', 'ArrowBend')` once per engaged bend.

## Testing

`arrow-bend.test.ts`: plan per style, bow passes through the pointer at `t`, `t` clamp, insert
index, slide keeps endpoints and inserts jogs, slide of an interior segment. `double-press.test.ts`:
pairing window and slop, echo only when the first press found it unselected. `arrow-scale.test.ts`:
corner and edge scaling, bends scale with the arrow, Shift keeps proportions, no flip or collapse,
a flat axis stays. `arrow-drag-apply.test.ts`: the bend and scale ticks. E2E
(`e2e/arrow-labels.spec.ts`): double-click on the line and on the label edits without bending, a
blank line keeps its height, drag bends and one undo straightens, the frame moves and a corner
scales a free arrow.

## Constants

| Name                   | Value | Provenance / safe range                               |
| ---------------------- | ----- | ----------------------------------------------------- |
| `BEND_T_MIN`           | 0.2   | Keeps a grab beside a head from exploding; 0.1 to 0.3 |
| `DOUBLE_PRESS_MS`      | 450   | Existing (usePressWithoutDrag), moved to double-press |
| `DOUBLE_PRESS_SLOP_PX` | 8     | Screen px between the two presses; 4 to 16            |
| `MOVE_FRAME_PAD_PX`    | 12    | Frame clearance round the route; 8 to 24              |
| `MOVE_FRAME_HIT_PX`    | 10    | Grab band width of the frame edge; 8 to 16            |

## Presentation and UX

- An editable arrow line shows the `grab` cursor; locked, read-only and format-painter lines keep
  their existing cursor.
- A selected free arrow shows the shape selection ring and handles; its ring edge shows `move`.
- The "+" add-point handles are gone; the curve, bend-point and elbow handles are unchanged.

## Accessibility

- The move frame's bands carry `role="button"` and `aria-label="Move arrow"`. Keyboard users move a free arrow
  with the arrow-key nudge, which already shifts free endpoints.
- Bending has no keyboard equivalent beyond the existing context-menu line styles; the double-press
  rule is pointer-only and changes nothing for keyboard or assistive-technology users.
