# Canvas performance blueprint

Derived from [Canvas performance](../canvas-performance.md). The measurements it answers are in
[Canvas performance on large boards](../../../research/canvas-performance.md).

## Files

| File                                                       | Role                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/live/lib/canvas-gesture.ts`                          | The gesture store: `beginCanvasGesture`, `canvasGestureNow`, `useCanvasGesture`   |
| `apps/live/components/canvas/CanvasZoomContext.tsx`        | `CanvasZoomProvider`, `useCanvasZoom()`: zoom for the counter-scaled parts only   |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`      | Stable per-element props; per-arrow frame and holes; the grid                     |
| `apps/live/components/canvas/element-layer-props.ts`       | `idBound`, `useStableCollab`: identity-stable per-element objects                 |
| `apps/live/components/canvas/arrow-view-frame.ts`          | `ArrowViewFrame` and `sameArrowViewFrame`                                         |
| `apps/live/components/canvas/ArrowView.tsx`                | Takes `frame` + `holes`, no `elementIndex` / `occluders`                          |
| `apps/live/components/canvas/BoxedElementView.tsx`         | No `zoom` prop; counter-scaled children read `useCanvasZoom()`                    |
| `packages/document/src/element-grid.ts`                    | `ElementGrid`: build, update, query, `elementGridFor`, `createElementGridTracker` |
| `packages/document/src/arrow-behind.ts`                    | `routeBehindHoles` unchanged in contract; callers pass grid candidates            |
| `packages/document/src/svg-render-arrows.ts`               | The export builds one grid per render and queries it                              |
| `apps/live/hooks/canvas/useArrowLabelLayouts.ts`           | `draftLayout` identity-stable across passes                                       |
| `apps/live/hooks/canvas/useSettledElements.ts`             | What the Map draws: frozen during element gestures, throttled otherwise           |
| `apps/live/components/canvas/Minimap.tsx`                  | Draws `useSettledElements(elements)`                                              |
| `apps/live/hooks/canvas/useEdgeAwarePlacement.ts`          | Takes `suspended`; never measures while suspended                                 |
| `apps/live/components/canvas/CanvasSelectionToolbars.tsx`  | `toolbarsStale` includes `selectionMoving`                                        |
| `apps/live/hooks/canvas/useCanvasLongTaskLog.ts` (planned) | The `[canvas-perf] long task` debug log                                           |
| `apps/live/e2e/perf/reference-board.ts` (planned)          | `buildReferenceBoard(seed, count)`                                                |
| `apps/live/e2e/perf/budget.ts` (planned)                   | `BUDGET_ROWS`, `evaluateBudget`, `budgetTable` (pure)                             |
| `apps/live/e2e/perf/canvas.perf.ts` (planned)              | The probe: seeds, runs each gesture under a trace, writes the report              |
| `.github/workflows/canvas-perf.yml`                        | The nightly run and the budget issue                                              |

## Domain and naming

| Term             | Identifier                        | Meaning                                                                                       |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Gesture          | `CanvasGesture`                   | `'pan' \| 'zoom' \| 'move' \| 'resize' \| 'reshape' \| 'marquee' \| 'stroke' \| 'erase'`      |
| At rest          | `'idle'`                          | No gesture open                                                                               |
| Element gesture  | `ELEMENT_GESTURES`                | `move`, `resize`, `reshape`, `stroke`, `erase`: the gestures that change elements every frame |
| Selection moving | `selectionMoving(g)`              | `g` is `move`, `resize` or `reshape`                                                          |
| Element view     | `BoxedElementView`, `ArrowView`   | The memoised per-element components                                                           |
| Element grid     | `ElementGrid`                     | The spatial index of boxed element bounds                                                     |
| Arrow frame      | `ArrowViewFrame`                  | An arrow's resolved `from`, `to`, `pathD`, `curveAnchors`, `curveControl`, `elbowPoint`       |
| Holes            | `holes: Rect[]`                   | The route-behind rects punched from an arrow                                                  |
| Settled elements | `useSettledElements`              | The elements the Map draws                                                                    |
| Reference board  | `buildReferenceBoard`             | The seeded synthetic board                                                                    |
| Budget row       | `BudgetRow`                       | One line of the spec's budget table, with its measured value and verdict                      |
| Budget issue     | title `Canvas performance budget` | The one GitHub issue the nightly run opens, comments on and closes                            |

"Drag" in the spec maps to the gestures `move` and `resize`; arrow handle drags are `reshape`.

## Behaviour and state

### The gesture store

- A module singleton (the `held-key-store` pattern): an ordered list of open gestures, each a
  `{ token, kind }`, and a listener set. Its snapshot is the kind of the most recently begun open
  gesture, or `'idle'`.
- `beginCanvasGesture(kind)` appends one and returns `end()`; `end()` removes that token and is
  idempotent. Listeners fire only when the snapshot changes.
- Sources, each calling `end()` on its gesture's end, cancel and unmount:

| Source                                                                                    | Gesture          | Begins                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `useEditorDrag`, `boxed` + `move`                                                         | `move`           | When the drag engages (`DRAG_ENGAGE_PX`)                                                   |
| `useEditorDrag`, `boxed` + `resize-*`                                                     | `resize`         | On the drag                                                                                |
| `useEditorDrag`, `arrow-translate`                                                        | `move`           | On the drag                                                                                |
| `useEditorDrag`, `arrow-scale`                                                            | `resize`         | On the drag                                                                                |
| `useEditorDrag`, other `arrow-*`                                                          | `reshape`        | On the drag                                                                                |
| `useCanvasPanAndMarquee`                                                                  | `pan`, `marquee` | When the pan or the marquee state is set                                                   |
| `useCanvasPinchZoom`, plain wheel                                                         | `pan`            | On the first wheel event; ends `WHEEL_SETTLE_MS` after the last                            |
| `useCanvasPinchZoom`, Ctrl/Cmd, pinch                                                     | `zoom`           | Likewise                                                                                   |
| `useCanvasDrawGesture` (`drawDrag`, `penPoints`), `useWhiteboardPenGesture` (`penStroke`) | `stroke`         | While the drawing state is set (draw-to-size, pencil, pen)                                 |
| `useCanvasEraser` sweep                                                                   | `erase`          | On `beginErase`; ends on `pointerup` or `pointercancel` (both record the sweep) or unmount |

- Discrete actions (a click, a key, a zoom button) open no gesture.

### Element views render only for their own changes

- Every prop of `BoxedElementView` is a primitive, the element itself, or identity-stable across
  `Canvas` renders that do not change it. Measured breakers and their fix:
  - `timerControls`: one object per layer, `useMemo` over the five timer handlers, which pass
    through the layer's `useStableHandlers` bag.
  - `commentActions`, `actionActions`: the panel actions' methods join the stable bag, and
    `idBound(make)` hands each element one object built from them, cached per id for as long as
    the bag's presence pattern holds. Absent actions give `undefined`, as before.
  - `onSetSessionConfig`, `onOpenElementSettings`, `onEnterPortal`, `onFireReaction`,
    `onReactionBurstDone`: into the layer's `useStableHandlers` bag.
  - `collab`: `useStableCollab(collab)` in `EditorCanvasHost`: handlers through
    `useStableHandlers` (presence kept; `COLLAB_HANDLERS` is checked against `CollabApi` at compile
    time), `participants` held while what a face reads of them (`id`, `key`, `name`, `color`,
    `status`, `role`, `picture`; not `lastActiveAt`) is unchanged, the rest by value.
  - `chairSitters`: a `useCallback` over the sitters map in `Canvas`.
- `zoom` leaves `BoxedElementView`'s props. `CanvasZoomProvider` (in `Canvas`, around the element
  layer) carries it; every child that sizes by zoom reads `useCanvasZoom()`: `LaneGutter`, `ShapeHitOutline`,
  `RemoteSelectorsStrip`, `BadgeStrip`, `LockBadge`, `ElementVoteOverlay`, `SelectionChromeLayer`,
  `PhotoDraftRing` and `PhotoMatchedBadge` (`photo-badges.tsx`), `RichTextEditor` (mounted only
  while editing), `HeroCaptionCard`, `TableView`, `PageMasthead` and the web faces. A stroke's
  hit band is `StrokeHitPath`: `FreehandSvg` and `PathSvg` take `hitPenWidth` and only that
  path reads the zoom, so a zoom re-renders no ink. `BrowserChrome` takes no zoom.
- `ArrowView` takes `frame: ArrowViewFrame` and `holes: Rect[]` in place of `elementIndex` and
  `occluders`. The layer derives both per arrow on each element change: the frame with
  `deriveArrowViewFrame(arrow, elementIndex)`, the holes with `routeBehindHoles(arrow, from, to,
queryElementGrid(grid, arrowBounds))`. `arrowViewPropsEqual` compares `frame` with
  `sameArrowViewFrame`, `holes` and `labelRender` by value, everything else with `Object.is`.
- `draftLayout` from `useArrowLabelLayouts` is identity-stable: a stable function reading the
  latest pass through a ref.
- Invariants: a `Canvas` render that changes no element, no selection and no zoom renders no
  element view; a move of one element renders that element, the arrows pinned to it, and arrows
  whose frame or holes changed; a zoom renders only zoom consumers.

### The element grid

- A uniform grid of `ELEMENT_GRID_CELL` canvas px cells over the boxed elements' unrotated
  `x, y, width, height` (the rect the route-behind test uses). Bucket key `` `${cx},${cy}` ``.
- An element spanning more than `ELEMENT_GRID_MAX_CELLS` cells goes to an oversize list that every
  query returns.
- `updateElementGrid(grid, next)` diffs by element identity against the grid's own id map and
  re-buckets only added, changed and removed elements; touched buckets are copied, so the previous
  grid stays valid. It returns a new grid object.
- `queryElementGrid(grid, rect)` returns each candidate once, in paint order (by the element's
  index in `next`), so output is deterministic. Callers still run their exact test.
- The layer holds a `createElementGridTracker()` (in `useState`); its `gridFor(drawnElements)`
  re-buckets from the last grid, once per element change, inside the memo that derives every
  arrow's `arrowViewGeometry` (frame and holes).
- `routeBehindQueryRect(from, to)` is the rect to ask: the arrow's bounds padded by twice
  `ROUTE_BEHIND_MARGIN`, so every box whose inflated hole could meet the padded bounds is a candidate.
- Exports, thumbnails and the Map pass a list to `svgArrow`, which asks `elementGridFor(list)` (one
  grid per list, cached in a `WeakMap`). `DrawnArrowPreview` does the same for its occluders.

### Selection chrome while a selection moves

- `CanvasSelectionToolbars` reads `useCanvasGesture()`; `toolbarsStale` becomes
  `quickRingOpen || insertionOpen || selectionMoving(gesture)`: the existing fade to `opacity: 0`
  and `visibility: hidden` over `--transition-duration-micro`.
- `useEdgeAwarePlacement(bounds, offset, zoom, gap, suspended)`: while `suspended` its layout
  effect returns before measuring; `suspended` is in the effect's dependencies, so the first
  render after the gesture places the box once.

### Layout reads outside gesture frames

- `useCanvasClientOrigin(wrapperRef, active, viewKey)` measures the wrapper on activating and when
  `viewKey` changes, never after every commit. `CanvasChrome` derives `viewKey` from the pan
  offset, the zoom and `<main>`'s size, and hands it to `CanvasGuideOverlay`, `CanvasDrawPreview`
  and `TimelineLanesOverlay`; a move's frames keep it, so alignment guides read no layout.
- The Quick Style panel's placement re-runs on `transitionend` only from the panel or an obstacle.

### The Map draws settled elements

- `useSettledElements(elements)`:
  - during an element gesture it returns the elements it last returned;
  - when that gesture ends it returns the current elements on the next render;
  - otherwise a change shows at once if `MAP_REDRAW_MIN_MS` has passed since the last change it
    showed, else when that much time has passed (one trailing timer, replaced, never stacked).
- `Minimap` memoises its markup on the settled elements. Its `elements` input is memoised in
  `useCanvasChromePanels` on `(elements, tabLayers)`, so a hidden layer no longer yields a new
  array per render.
- Pan and zoom never redraw the markup; they move only the viewport rectangle, as today.

### At rest

- The still-canvas rule is held by a test that counts animation-frame requests over a still
  second (none from the canvas), and by the probe's idle row.

### The long-task log

- `useCanvasLongTaskLog()` in `Canvas`: when `debugLogEnabled('canvas-perf', ...)` holds and
  `PerformanceObserver.supportedEntryTypes` includes `longtask`, it observes and, per entry,
  calls `debugLog('[canvas-perf] long task', { ms, gesture: canvasGestureNow() })`. Otherwise it
  registers nothing.

### The reference board

- `buildReferenceBoard(seed = REFERENCE_SEED, count = REFERENCE_COUNT)`: a `mulberry32` PRNG;
  elements by the spec's mix, made with the `@livediagram/document` factories, placed over
  `REFERENCE_AREA`; arrows are `createPinnedArrow` between two random shapes; paths are closed
  with a fill on odd indexes. Ids are `ref-<n>`; the same seed yields the same board, byte for
  byte.

### The probe

- A Playwright project `perf` (`testMatch: /e2e\/perf\/.*\.perf\.ts/`), excluded from
  `chromium`; `pnpm perf:canvas` runs it against the e2e stack.
- It seeds one document with two tabs (`kind: 'whiteboard'`, `kind: 'diagram'`), each the
  reference board, through the api.
- For each tab and each zoom (fit, 100%), with `Emulation.setCPUThrottlingRate` at 4, it runs:
  open, idle (2 s), pan (30 wheel ticks), zoom (16 Ctrl-wheel ticks), select, drag (30 moves),
  deselect, marquee (25 moves), stroke (30 moves; the pen on the whiteboard, the pencil on the
  diagram), hover (40 moves). Each runs under a `devtools.timeline` trace and an in-page frame
  recorder.
- The probe never sends `Profiler.start`: the trace categories are `devtools.timeline` and
  `disabled-by-default-devtools.timeline` only. Starting V8's profiler makes source positions
  available for every compiled function in one main-thread task (about 1.1 s at 4× on a
  658-element board), which would land in the first gesture's window.
- `evaluateBudget(measurements)` maps them onto `BUDGET_ROWS`; `budgetTable(rows)` renders
  markdown. Written to `test-results/perf/canvas-perf.md` and `.json`; traces to
  `test-results/perf/traces/`.
- A budget miss never fails the test; a harness error (seeding, the stack, a missing element)
  does.

### The nightly run

- `.github/workflows/canvas-perf.yml`: `schedule` at `PERF_CRON` and `workflow_dispatch`.
- Skip step: the head SHA of the last successful run of this workflow
  (`gh run list --workflow canvas-perf.yml --status success -L 1`) equals `github.sha` → the job
  ends successfully without building.
- Otherwise: the e2e image and install as `e2e.yml`, `next build` of `apps/live`,
  `pnpm --filter @livediagram/live perf:canvas`, the table to `$GITHUB_STEP_SUMMARY`, traces and
  report uploaded as `canvas-perf` with `retention-days: 14`.
- Report step (`gh`, `GH_TOKEN: ${{ github.token }}`): any failing row → find the open issue
  titled `Canvas performance budget` (label `performance`); comment the table and
  `git log --oneline <last-pass-sha>..HEAD` on it, or create it with that body. All rows passing
  and the issue open → comment "Back within budget at <sha>" and close it.

## Interfaces and contracts

```ts
// apps/live/lib/canvas-gesture.ts
export type CanvasGesture =
  'pan' | 'zoom' | 'move' | 'resize' | 'reshape' | 'marquee' | 'stroke' | 'erase';
export const ELEMENT_GESTURES: ReadonlySet<CanvasGesture>;
export function beginCanvasGesture(kind: CanvasGesture): () => void;
export function canvasGestureNow(): CanvasGesture | 'idle';
export function useCanvasGesture(): CanvasGesture | 'idle';
export function selectionMoving(g: CanvasGesture | 'idle'): boolean;
export function resetCanvasGesturesForTests(): void;

// packages/document/src/element-grid.ts
export type ElementGrid;
export function buildElementGrid(elements: readonly Element[]): ElementGrid;
export function updateElementGrid(grid: ElementGrid, next: readonly Element[]): ElementGrid;
export function queryElementGrid(grid: ElementGrid, rect: Rect): Element[];

// apps/live/components/canvas/arrow-view-frame.ts
export type ArrowViewFrame = ReturnType<typeof deriveArrowViewFrame>;
export function sameArrowViewFrame(a: ArrowViewFrame, b: ArrowViewFrame): boolean;

// apps/live/hooks/canvas/useSettledElements.ts
export function useSettledElements(elements: Element[]): Element[];

// apps/live/hooks/canvas/useEdgeAwarePlacement.ts
export function useEdgeAwarePlacement(
  bounds: Bounds, canvasOffset: XY, zoom: number, gap: number, suspended?: boolean,
): { ref; placeAbove: boolean; style: CSSProperties };

// apps/live/e2e/perf/budget.ts
export type Measurement = {
  tab: 'whiteboard' | 'diagram'; zoom: 'fit' | '100%'; gesture: string;
  longestTaskMs: number; tasksOver50: number; medianFrameMs: number; idleWorkMs: number;
  elementRenders?: number; openMs?: number;
};
export type BudgetRow = Measurement & { rule: string; pass: boolean };
export function evaluateBudget(m: readonly Measurement[]): BudgetRow[];
export function budgetTable(rows: readonly BudgetRow[]): string;
```

- `queryElementGrid` with a rect of non-finite or negative size returns the oversize list only and
  logs once (`[element-grid] bad query rect`).
- `evaluateBudget` rejects a measurement missing its row's metric with `MissingMetric: <gesture>`.

## Data and persistence

- Nothing is persisted: the gesture store, the grid, the settled elements and the zoom context
  are session state. The reference board is never stored outside the probe's own e2e database.
- The nightly artefact is retained 14 days; the budget issue is the only lasting record.

## Errors and edge cases

| Case                                              | Handling                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A gesture source unmounts mid-gesture             | Its cleanup calls `end()`; the snapshot falls back to the previous open gesture or `idle` |
| `pointercancel`, window blur during a drag        | The sources' existing cancel paths call `end()`                                           |
| Two gestures overlap (a wheel zoom during a drag) | The later is the snapshot; ending it restores the earlier                                 |
| `end()` called twice                              | No-op                                                                                     |
| A gesture never ends (a lost pointerup)           | `useEditorDrag`'s existing `pointerup` on window ends it; the Map unfreezes with it       |
| An element with `NaN` or infinite bounds          | Not bucketed; `[element-grid] skipped element` logged once per id                         |
| A giant element (a frame over the whole board)    | Oversize list, returned by every query                                                    |
| Arrow-to-arrow and group-anchored ends            | Resolved by `deriveArrowViewFrame` as today; the frame compares by value                  |
| A hidden layer                                    | The Map's input is memoised; hidden elements stay out of the grid (`drawnElements`)       |
| A remote edit during a local drag                 | The Map stays frozen until the drag ends, then shows the latest elements                  |
| The selection is deleted mid-drag by a peer       | The drag ends through its existing path, ending the gesture                               |
| Reduced motion                                    | The toolbar fade is the existing micro transition, which reduced motion already flattens  |
| Probe: seeding or the stack fails                 | The test fails; the workflow fails as an error, not as a budget miss; no issue is touched |
| Nightly: the issue API fails                      | The step fails visibly; the summary still carries the table                               |
| Nightly: no previous successful run               | No skip; the run proceeds                                                                 |

## Security and trust

- The workflow's permissions are `contents: read`, `issues: write`, `actions: read`; no secrets
  beyond `GITHUB_TOKEN`. The probe's stack is local to the runner with test-only keys, as the e2e
  stack.
- The reference board is synthetic; no user content enters a report.

## Performance and limits

- Grid build on 1,000 elements: one pass, about 1,000 bucket inserts; an update after a one-element
  move: a 1,000-entry identity scan plus a handful of bucket copies.
- Holes per frame: 300 arrows × one query each over a few cells, versus 300 × 1,000 occluder tests
  today (about 141,000 `isBoxed` calls measured on 658 elements).
- Frames per frame of a one-element move: 300 `deriveArrowViewFrame` calls, constant each.
- Element view renders per frame of a one-element move: 1 + its pinned arrows + arrows with
  changed holes, versus every view today.
- The Map: one full rebuild per gesture instead of one per frame.
- Selection chrome: zero `getBoundingClientRect` calls per gesture frame.

## Presentation and UX

- The floating toolbar and selection popover fade out as a move, resize or reshape engages and
  fade back in at the box's new place when it ends; the quick-connect pluses and grips are
  unchanged. A click that never engages a move never hides them.
- The Map keeps its last drawing through an element gesture, with the viewport rectangle live;
  on release the drawing catches up in one step.
- No new copy, empty, loading or error states: nothing a user reads changes.

## Accessibility

- Keyboard nudges (arrow keys) are discrete actions, open no gesture, and never hide the toolbar,
  so a keyboard user keeps it in reach.
- The hidden toolbar is `visibility: hidden`, out of the tab order and the accessibility tree for
  the gesture's length, as for the quick-connect ring today; focus inside it is not moved.
- Reduced motion: the fade is the existing micro transition, which reduced motion flattens.

## Web Experience

- INP is what this blueprint moves: every interaction's handler, render and paint stay under the
  budget's 50 ms task line on the reference board.
- LCP and CLS: unchanged. The gesture store, grid and zoom context render nothing of their own;
  the toolbar fade changes opacity and visibility only, never layout.

## Observability

- `[canvas-perf] long task` (debug) `{ ms, gesture }`.
- `[element-grid] skipped element` (debug) `{ id }`, once per id per grid.
- `[element-grid] bad query rect` (debug) `{ rect }`, once per session.
- `[canvas-gesture] begin` / `end` (debug) `{ kind, open }`, behind the `canvas-gesture` scope.
- `[map] redraw` (debug) `{ reason: 'gesture-end' | 'change' | 'trailing', count }`.
- The nightly job summary, artefact and budget issue.

## Testing

| Spec rule                                        | Test                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| A still canvas does nothing                      | `Canvas.still.test.tsx`: no frame requested over a still second; probe idle row                                            |
| An observer never notifies itself                | `useQuickStylePlacement.test.tsx` (shipped)                                                                                |
| A pan or zoom moves the canvas, not its elements | `CanvasElementsLayer.renders.test.tsx`: re-render with the same inputs renders no view; a zoom renders zoom consumers only |
| No layout read in a gesture frame                | `useEdgeAwarePlacement.test.tsx`: no measure while suspended, one on resume                                                |
| Selection chrome hidden while moving             | `CanvasSelectionToolbars.test.tsx`: stale under `move`, `resize`, `reshape`                                                |
| The Map redraws when a gesture ends              | `useSettledElements.test.tsx`: frozen, released, throttled, trailing; `Minimap.test.tsx`: held mid-move                    |
| Questions about neighbours ask the index         | `element-grid.test.ts`; `arrow-behind.test.ts`: grid candidates give the same holes                                        |
| Whole-board passes linear and once               | `useArrowLabelLayouts.hook.test.tsx`: `draftLayout` stable across element changes                                          |
| A move re-renders what moved                     | `CanvasElementsLayer.renders.test.tsx`: moving one element renders it; `element-layer-props.collab.test.tsx`               |
| Gesture store semantics                          | `canvas-gesture.test.ts`                                                                                                   |
| Reference board deterministic, mix as specced    | `reference-board.test.ts`                                                                                                  |
| Budget evaluation and table                      | `budget.test.ts`                                                                                                           |
| Timings come from the trace, never a profiler    | `canvas.perf.ts`: its CDP session sends no `Profiler.*` command                                                            |
| The budget holds                                 | The nightly probe                                                                                                          |

## Constants and configuration

| Constant                 | Value        | Provenance                                         | Safe range        |
| ------------------------ | ------------ | -------------------------------------------------- | ----------------- |
| `WHEEL_SETTLE_MS`        | 150          | D62                                                | 100–300           |
| `MAP_REDRAW_MIN_MS`      | 250          | Spec                                               | Spec-fixed        |
| `ELEMENT_GRID_CELL`      | 256          | D63                                                | 128–1024          |
| `ELEMENT_GRID_MAX_CELLS` | 64           | D64                                                | 16–1024           |
| `REFERENCE_SEED`         | 1            | D65                                                | Any integer       |
| `REFERENCE_COUNT`        | 1000         | Spec                                               | Spec-fixed        |
| `REFERENCE_AREA`         | 5760 × 2700  | Spec: four 1440 px screens wide, three 900 px high | Spec-fixed        |
| `PERF_THROTTLE`          | 4            | Spec                                               | Spec-fixed        |
| `LONG_TASK_MS`           | 50           | Spec                                               | Spec-fixed        |
| `DRAG_MEDIAN_FRAME_MS`   | 33           | Spec                                               | Spec-fixed        |
| `SELECT_TASK_MS`         | 100          | Spec                                               | Spec-fixed        |
| `OPEN_INTERACTIVE_MS`    | 3000         | Spec                                               | Spec-fixed        |
| `IDLE_WORK_MS`           | 5            | D66                                                | 0–16              |
| `PERF_CRON`              | `30 2 * * *` | D67                                                | Any off-peak time |
| `PERF_ARTEFACT_DAYS`     | 14           | Spec                                               | Spec-fixed        |

## Defaults ledger

Rows D62 to D67 in [DEFAULTS.md](DEFAULTS.md).
