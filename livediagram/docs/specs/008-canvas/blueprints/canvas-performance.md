# Canvas performance blueprint

Derived from [Canvas performance](../canvas-performance.md). The measurements it answers are in
[Canvas performance on large boards](../../../research/canvas-performance.md).

## Files

| File                                                                                  | Role                                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `../packages/workbench/src/lib/canvas-gesture.ts`                                     | The gesture store: `beginCanvasGesture`, `canvasGestureNow`, `useCanvasGesture`                                          |
| `../packages/workbench/src/components/canvas/CanvasZoomContext.tsx`                   | `CanvasZoomProvider`, `useCanvasZoom()`, `CounterScaled` (a div reading the zoom itself)                                 |
| `apps/editor/components/canvas/CanvasElementsLayer.tsx`, `useElementLayerHandlers.ts` | Stable per-element props; per-arrow frame and holes; the grid                                                            |
| `apps/editor/components/canvas/CanvasElementList.tsx`                                 | Every element in paint order, memoised so an editor render that changes none skips them; the element plane               |
| `apps/editor/hooks/canvas/useLayerDragPreview.ts`                                     | The layer's preview store: a drag frame renders each previewed element, not the layer                                    |
| `apps/editor/hooks/canvas/useSnapGuideState.ts`                                       | `SnapGuideStore`: the drag's snap guides, read only by `CanvasChrome`                                                    |
| `apps/editor/components/canvas/element-layer-props.ts`                                | `idBound`, `useStableCollab`: identity-stable per-element objects                                                        |
| `apps/editor/components/canvas/arrow-view-frame.ts`                                   | `ArrowViewFrame` and `sameArrowViewFrame`                                                                                |
| `apps/editor/components/canvas/ArrowView.tsx`                                         | Takes `frame` + `holes`, no `elementIndex` / `occluders`                                                                 |
| `apps/editor/components/canvas/BoxedElementView.tsx`                                  | No `zoom` prop; counter-scaled children read `useCanvasZoom()`                                                           |
| `../packages/element-model/src/element-grid.ts`                                       | `ElementGrid`: build, update, query, `elementGridFor`, `createElementGridTracker`                                        |
| `packages/document/src/arrow-behind.ts`                                               | `routeBehindHoles` unchanged in contract; callers pass grid candidates                                                   |
| `packages/document/src/svg-render-arrows.ts`                                          | The export builds one grid per render and queries it                                                                     |
| `apps/editor/hooks/canvas/useArrowLabelLayouts.ts`                                    | `draftLayout` identity-stable across passes                                                                              |
| `apps/editor/lib/stock-colour-projector.ts`                                           | Same board in, same array out (`lastIn` / `lastOut`)                                                                     |
| `apps/editor/hooks/canvas/useSettledElements.ts`                                      | What the Map draws: frozen during element gestures, throttled otherwise                                                  |
| `apps/editor/hooks/canvas/useDocumentHistory.ts`                                      | `historyTick` through `withPresent`: an unchanged tab hands back the same history                                        |
| `apps/editor/components/canvas/Minimap.tsx`                                           | Draws `useSettledElements(elements)`                                                                                     |
| `apps/editor/hooks/canvas/useEdgeAwarePlacement.ts`                                   | Takes `suspended`; never measures while suspended                                                                        |
| `apps/editor/components/canvas/CanvasSelectionToolbars.tsx`                           | `toolbarsStale` includes `selectionMoving`                                                                               |
| `../packages/workbench/src/hooks/canvas/useCanvasLongTaskLog.ts`                      | The `[canvas-perf] long task` debug log                                                                                  |
| `../packages/workbench/src/hooks/ui/useBodyEndAnchor.ts`                              | `useBodyEndAnchor`: an empty `div[data-body-end]` kept at the end of `<body>`, called by `SplitViewFrame`                |
| `../packages/workbench/src/hooks/canvas/useNoCanvasTextSelection.ts`                  | `useNoCanvasTextSelection(mainRef)`, `cancelsCanvasSelectStart`: no text selection starts on the canvas                  |
| `../packages/workbench/src/components/canvas/MarqueeRect.tsx`                         | The marquee rectangle: one element, `hidden` between sweeps                                                              |
| `../packages/workbench/src/components/canvas/CanvasArrivalContext.tsx`                | `CanvasArrivalProvider`, `useArrivesWithBoard()`, `ARRIVAL_BURST`: what a tab opens with, and a burst                    |
| `apps/editor/hooks/ui/useLayerThumbnails.ts`                                          | `enabled`: no renderer pass while the Layers panel is closed (`NO_THUMBNAILS`)                                           |
| `apps/editor/components/canvas/useBoxedElementAnimation.ts`                           | Pops in only what is added after the board arrived; no timer when nothing pops                                           |
| `apps/editor/app/globals.css`                                                         | The editor fade-in rule (chrome markers only, never the canvas world); `[data-element-plane]`'s `cursor: auto`           |
| `../packages/workbench/src/lib/sticky-peel-image.ts`                                  | The sticky peel as a picture: `stickyPeelImage`, `stickyPeelVars` (blob-URL border-images), `useStickyPeelVars`          |
| `../packages/workbench/src/lib/png-encode.ts`                                         | `encodePngRgba`: a synchronous stored PNG, for pictures the editor makes itself                                          |
| `apps/editor/hooks/canvas/useCanvasPinchZoom.ts`                                      | Touch pinch: one view change a frame (`flushPinch`), the wrapper measured at the start, `pinchOffset`                    |
| `../packages/e2e-kit/src/perf/interactive.ts`                                         | `interactiveMs`: the open row's quiet-window rule over long tasks and long frames (pure)                                 |
| `apps/editor/e2e/perf/reference-board.ts`                                             | `buildReferenceBoard(seed, count)`                                                                                       |
| `../packages/e2e-kit/src/perf/budget.ts`                                              | `evaluateBudget`, `budgetTable`, `medianOfRuns` and the budget constants, over the tabs each editor names (pure, shared) |
| `../packages/e2e-kit/src/perf/budget-report.ts`                                       | `budgetIssueTitle`, `budgetIssueAction`, `budgetIssueComment`: what the nightly run does with the issue (shared)         |
| `../packages/e2e-kit/src/perf/nightly.mjs`                                            | The nightly run's I/O: `previous` and `report <product>`, run from the editor's folder (shared)                          |
| `../packages/e2e-kit/src/perf/calibrate.ts`                                           | `benchmarkInPage`, `calibratedThrottle`, `REFERENCE_BENCH_MS`, `TARGET_SLOWDOWN`                                         |
| `../packages/e2e-kit/src/perf/trace-tasks.ts`                                         | `mainThreadTasks`: the renderer main thread's task durations from a trace                                                |
| `../packages/e2e-kit/src/perf/canvas-probe.ts`                                        | `runCanvasProbe`: calibrates, opens the board in fresh contexts, writes the report (shared)                              |
| `../packages/e2e-kit/src/perf/canvas-gestures.ts`                                     | `measureZoom`: the still board and each gesture, untraced runs and one traced (shared)                                   |
| `apps/editor/e2e/perf/canvas.perf.ts`                                                 | The probe's binding: the tabs, seed, sign-in, editor path and canvas chrome it hands `runCanvasProbe`                    |
| root `.github/workflows/canvas-perf.yml`                                              | The nightly run and the budget issue                                                                                     |
| `../packages/workbench/src/lib/tab-style-ease.ts`                                     | `BUSY_CANVAS_ELEMENTS`, `canvasIsBusy(count)` (shared by every editor): when a Tab Style change eases the canvas only    |

## Domain and naming

| Term             | Identifier                                     | Meaning                                                                                       |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Gesture          | `CanvasGesture`                                | `'pan' \| 'zoom' \| 'move' \| 'resize' \| 'reshape' \| 'marquee' \| 'stroke' \| 'erase'`      |
| At rest          | `'idle'`                                       | No gesture open                                                                               |
| Element gesture  | `ELEMENT_GESTURES`                             | `move`, `resize`, `reshape`, `stroke`, `erase`: the gestures that change elements every frame |
| Selection moving | `selectionMoving(g)`                           | `g` is `move`, `resize` or `reshape`                                                          |
| Element view     | `BoxedElementView`, `ArrowView`                | The memoised per-element components                                                           |
| Element grid     | `ElementGrid`                                  | The spatial index of boxed element bounds                                                     |
| Arrow frame      | `ArrowViewFrame`                               | An arrow's resolved `from`, `to`, `pathD`, `curveAnchors`, `curveControl`, `elbowPoint`       |
| Holes            | `holes: Rect[]`                                | The route-behind rects punched from an arrow                                                  |
| Settled elements | `useSettledElements`                           | The elements the Map draws                                                                    |
| Reference board  | `buildReferenceBoard`                          | The seeded synthetic board                                                                    |
| Budget row       | `BudgetRow`                                    | One line of the spec's budget table, with its measured value and verdict                      |
| Budget issue     | title `Canvas performance budget: livediagram` | The one GitHub issue the nightly run opens, comments on and closes                            |

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

### The board keeps its identity between renders

- `createStockColourProjector` keeps the last board it was given (`lastIn`) and its projection
  (`lastOut`): the same array on the same surface returns `lastOut` without walking it. A surface
  change clears both, with the per-element cache.
- `visibleLayerElements` is memoised over `elements` and `tabLayers` where the Map reads it
  (`useCanvasChromePanels`).

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
  - `collab`: `useStableCollab(collab)` in `useHostCollab` (EditorCanvasHost): handlers through
    `useStableHandlers` (presence kept; `COLLAB_HANDLERS` is checked against `CollabApi` at compile
    time), `participants` held while what a face reads of them (`id`, `key`, `name`, `color`,
    `status`, `role`, `picture`; not `lastActiveAt`) is unchanged, the rest by value.
  - `chairSitters`: a `useCallback` over the sitters map in `Canvas`.
- `zoom` leaves `BoxedElementView`'s props. `CanvasZoomProvider` (in `Canvas`, around the element
  layer) carries it; every child that sizes by zoom reads `useCanvasZoom()`: `LaneGutter`, `ShapeHitOutline`,
  `RemoteSelectorsStrip`, `ElementIndicators`, `LockBadge`, `ElementVoteOverlay` (shared in `@liveworkspace/workbench`; its `VoteStepper` and read-only count only, each mounted only while shown, which fold to a badge by `voteStepperCollapses` and shrink to a dot by `voteBadgeShrinks`, both pure arithmetic on the element's size and the zoom with no layout read, held by a CPU-time test over a 2,000-note board), `SelectionChromeLayer`,
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

### A drag frame renders what moved

- A drag preview frame renders no `Canvas` and no `CanvasElementsLayer`: each element reads its own
  entry from the layer's preview store, and the selection chrome reads the preview itself
  ([Drag preview blueprint](drag-preview.md) "Drawing"). Before, every frame re-rendered the layer,
  and React walked all 1,000 of the reference board's element views (memo comparisons and context
  checks): 50-90 ms a frame at the reference speed.
- The drag's snap guides (alignment, equal spacing, arrow-endpoint markers) live in a
  `SnapGuideStore` per editor (`useSnapGuideState`), not in the editor's state: a dense board
  changes them on most frames of a drag, and in the editor's state each change would render the whole editor.
  `useEditorDrag` writes it through the rAF-coalesced `scheduleGuides` / `scheduleSnapTargets`;
  the editor hands the store down as one stable prop, and only `CanvasChrome` reads it
  (`useSnapGuides`), so a new set renders that chrome alone.
- The elements themselves are listed by `CanvasElementList`, memoised, with every prop
  identity-stable across editor renders that change nothing it draws (`useInsertShift` returns one
  object while its answers hold). A press or a release that renders the editor (the drag state
  beginning or ending) renders the layer but walks none of the board's element slots.
- Invariant: between the press and the release of a move, the editor root, `Canvas` and the element
  layer do not render; at the press and the release, the element list does not render unless an
  element changed.

### The element plane

- `CanvasElementList` renders every element inside one `<div data-element-plane class="contents">`:
  no box, so layout, hit testing, paint order and the isometric 3D stack are as before.
- `globals.css` gives `[data-element-plane]` `cursor: auto`. The canvas world's cursor (its
  `canvasCursorClass` class, or a draw tool's inline cursor) then stops there, so a change of it
  restyles the plane and not the 2,760 nodes beneath it on the reference board. Every part of an
  element that takes a press already sets its own cursor (`BoxedElementView`'s `cursor-*` class,
  `ArrowView`'s hit line), so what shows does not change.
- `[data-pen-in-hand] *` and `[data-path-cursor] *` (`cursor: inherit !important`) match the plane
  too, so a whiteboard pen or a path in its edit mode still shows its cursor over the elements.
- Invariant: a change of the canvas world's cursor class (a switch between the class-cursor tools, a pan's start
  and end, a diagram stroke landing) restyles no element view. It does not cover:
  - a whiteboard pen or a path in its edit mode, whose cursor passes through the plane on purpose (above), so a
    zoom (the pen's cursor follows its width on screen) or a path hover still restyles the board;
  - the eraser and the spotlight, whose own rules match every `[data-element-id]`, so switching to or from them
    restyles each element once;
  - the world's other children (`IsometricDepthLayer`), which sit outside the plane and inherit the world's
    cursor, so a pan restyles isometric depth blocks.

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
- `Minimap` reads the settled elements through `useDeferredValue`, so the change that settles them (a
  drag's release) commits first and the Map's rebuild and image parse follow as their own render
  (measured on the reference board: the worst task after a release fell from 171-219 ms to at most
  128 ms). `Minimap` memoises its markup on the deferred elements. Its `elements` input is memoised in
  `useCanvasChromePanels` on `(elements, tabLayers)`, so a hidden layer does not yield a new
  array per render.
- Pan and zoom never redraw the markup; they move only the viewport rectangle.
- On mount the deferral has an initial value: `useDeferredValue(settled, NO_ELEMENTS)`. The first
  render draws no picture (a server render shows it: `Minimap.test.tsx`), so opening a board mounts
  the board in its first task and the Map's picture is built in a background render after it.

### Opening animates nothing across the board

- The editor fade-in rule in `globals.css` lists `[data-floating-panel]`, `[data-editor-tabbar]`
  and `[data-zoom-cluster]` only; the canvas world carries no marker and no animation.
- `CanvasArrivalProvider` (`CanvasArrivalContext.tsx`) wraps the element layer in `Canvas`, given
  `activeTabId` and `count` (`elements.length`). It holds `settledTab`, a ref set in an effect after
  each commit that shows a tab (`useEffect(() => { settledTab.current = tabId }, [tabId])`), and
  `burst`, a ref it writes as it renders: `count` minus the count of the last commit (a ref written
  in an effect) is more than `ARRIVAL_BURST` (24). Derived only from a prop and an effect-written
  ref, so a render React discards and redoes writes the same value. Its context value is
  `{ settledTab, burst, tabId }`, memoised, so it changes only on a tab switch and no element view
  renders for a burst.
- `useArrivesWithBoard()` reads, once per element mount (a `useState` initialiser),
  `settledTab.current !== tabId || burst.current`: true for the elements in the commit that shows
  the tab and for those mounting in a burst, false for any other element mounted later. The
  elements a commit mounts render after the provider, so they read that render's `burst`. Outside a
  provider it reads false (an element alone pops in). Every editor's canvas (livediagram,
  livedocuments, livedesign, liveplanner, livehuddle) passes `count`.

### A Tab Style change on a busy canvas

- `Canvas` sets `data-canvas-busy=""` on the `data-canvas-root` surface when `canvasIsBusy(elements.length)`
  (`elements.length > BUSY_CANVAS_ELEMENTS`, both from `../packages/workbench/src/lib/tab-style-ease.ts`), and no
  attribute otherwise.
- `globals.css`: under `:root.lvd-style-transition` (set for 300 ms by `easeNextStyleChange`) the surface
  `[data-canvas-root]` always takes the colour transition; its descendants take it only under
  `[data-canvas-root]:not([data-canvas-busy])`. A busy surface's parts therefore snap to the new style in the first
  frame, the backdrop easing.
- Tests: `../packages/workbench/src/lib/tab-style-ease.test.ts` (the threshold), `app/canvas-motion.test.ts` (the
  busy gate on the parts rule, the surface rule ungated, and `Canvas` marking the surface).

### A theme pick on a big board

- Measured (`e2e/perf/theme-pick.perf.ts`, a production build, the reference board, the reference speed of about 3x
  throttle, A/B against main on one machine): livediagram at 400 elements, longest task 232-251 ms before, 83-89 ms
  after; at 1,000, 436-485 ms before, 255-259 ms after. liveplanner at 400, 111-118 ms before, 72-83 ms after. The
  task was one click: every element view re-rendering in its new colours (the colours really change, so each renders
  once), a forced style recalc inside the commit, and a whole-page restyle as the ease class went on and off `:root`.
- `easedStyleChange(fn)` (`../packages/workbench/src/lib/tab-style-ease.ts`): each `CanvasThemeDialog` pick calls
  `easeNextStyleChange()` then runs `fn` inside `startTransition`, so the elements re-render between frames and
  commit once.
- A pick renders only the element views whose colours change. `withThemeApplied` hands back each element the pick
  leaves as it was as the same object (`keepUnchangedElements` in `@liveworkspace/workbench/lib/keep-unchanged-elements`:
  structural equality, a key set to `undefined` as one left out), and the stock-colour projector does the same against
  what it drew last, as a pick drops its caches. The theme's chart palette reaches a boxed view only when its face draws in it
  (`drawsWithChartPalette` in `@liveworkspace/element-model/data-shapes`, checked in `CanvasElementList`): handed to
  every view through the layer's shared props, a pick's new palette rendered them all. `CanvasElementsLayer.renders.test.tsx` (livediagram) picks Forest on a Brand board of three theme-coloured and three hand-coloured shapes with a new palette: 3 of 6 views render (6 of 6 before). The colours of a theme-coloured element really
  change, so its view still renders once, in the transition: on the reference board 380 of 400 elements change on a
  Brand to Forest pick (the 20 stickies do not).
- `easeNextStyleChange()` on a busy canvas (a `[data-canvas-root][data-canvas-busy]` in the page) sets
  `SURFACE_EASE_ATTR` (`data-style-easing`) on that surface, not the `lvd-style-transition` class on `:root`: a class
  on the root invalidated every node of the page (the toolbars, the dialog). `globals.css` adds
  `[data-canvas-root][data-style-easing]` to the surface ease rule. A pick while it eases extends the ease.
- `styleChangeInFlight()` is true while an ease runs; `SnapWidth` skips its every-render measure then (its
  `getBoundingClientRect` forced the style recalc inside the commit). It measures again on its resize observer.
- Tests: `tab-style-ease.test.ts` (busy surface attribute, root class otherwise, `easedStyleChange`,
  `styleChangeInFlight`), `SnapWidth.test.tsx` (no read while a style change draws), `app/canvas-motion.test.ts`
  (the surface attribute in the ease rule).

### A closed panel draws nothing of the board

- `LayersPanel` stays mounted once opened (`useCanvasChromePanels`: `layersOpened`), and passes
  `popoverOpen` as `useLayerThumbnails`' `enabled`. Disabled, the hook returns `NO_THUMBNAILS`, one
  shared empty value, and runs no renderer pass; opening the panel draws the previews once, and
  while it is open they follow the board as before. The context menu's `MoveToLayerRow` mounts
  only while its menu is open and draws as it always did.
- `useBoxedElementAnimation`: `entered` starts as `still || arrivesWithBoard`. Only an element
  that starts not entered arms the 400 ms timer that drops `animate-element-pop-in`; an element
  that starts entered arms nothing, so opening a board sets no timers and re-renders no view
  afterwards. An element mounted on a still canvas stays entered if the tab switches to Diagram
  mode.

### The Map is one image

- `Minimap`'s memo builds the board's markup (`svgBoxed` / `svgArrow`, frames first, arrows on
  top) and wraps it in a standalone document over the padded content box (`minimapPicture`, `MinimapMap` in
  `@liveworkspace/workbench`): `<svg xmlns viewBox width height>` + `svgShadowDefs(elements)` + the markup. Arrowheads
  are inline polygons and masks travel with their arrows, so nothing references the page's defs.
- It is shown as one SVG `<image>` at that box in the map's world-space `viewBox`, from a
  `data:image/svg+xml;charset=utf-8,` URL (pure: no object URL to create or revoke), on the paper
  colour. The window and the dim are a second `<svg>` over it (`data-minimap-view`, same box and
  `viewBox`, `pointer-events-none`, `will-change: transform`), so a pan repaints that layer alone;
  presses land on the picture's `<svg>`, whose `getScreenCTM` maps them to the board. Each app's
  `Minimap` builds the picture and puts `MinimapMap` in its own panel.
- No labels: the memo draws `elements.map(withoutLabel)` (each element without `label` / `richText`),
  so the picture carries no `<text>` and the arrow label pass has nothing to lay out. Measured on the
  reference board: the picture drops from 417 KB to 305 KB (550 texts, 642 lines gone), and Chrome's
  parse-and-paint at 4x from about 210 ms to about 100 ms. `svgFontDefs` stays left out.
- Tests: `Minimap.test.tsx` (one `<image>`, no board nodes in the page; a standalone picture).

### What comes and goes beside the board

- `SplitViewFrame` calls `useBodyEndAnchor()` first: its effect appends a hidden, `aria-hidden` `div[data-body-end]`
  to `<body>` after the editor's root and removes it on unmount. Every portal (`Portal`, `HintSurface`, the menus,
  toasts and dialogs) and every element appended to `<body>` lands after it, so the editor's root never gains or
  loses `:last-child`. WebKit restyles the whole subtree of a sibling whose positional state changes, and Tailwind's
  `space-y-*` / `divide-*` (`:where(.x > :not(:last-child))`) mark every parent as having its children read
  `:last-child`.
- `Canvas` calls `useNoCanvasTextSelection(mainRef)`: a `selectstart` listener on `<main>` that calls
  `preventDefault()` unless `cancelsCanvasSelectStart(target)` is false, which is when the target (an element, or a
  text node's parent) sits in `input`, `textarea`, `[contenteditable]:not([contenteditable="false"])` or
  `.select-text`. A callback ref, or no surface, attaches nothing.
- `MarqueeRect` renders `<div aria-hidden data-marquee hidden />` while the store holds no sweep, and the same `div`
  (same type and place, so React keeps the node) with its class and style during one.
- Measured in WebKit (Playwright 1180 x 820, livedesign, 2,000 labelled boxes and 1,999 pinned arrows at fit zoom,
  three runs each): a tooltip shown and hidden, long frames 854 to 881 ms to 174 to 206 ms; a marquee's press 807 to
  821 ms to 134 to 164 ms, its first move 709 to 725 ms to 15 to 40 ms; a union resize's first frame 1,570 to
  1,596 ms to 1,088 to 1,125 ms. Its later frames (about 0.8 s), the release that selects everything (about 0.5 s) and
  the deselect (0.6 to 0.9 s) are unchanged: they restyle, lay out and paint every element they change.

### Peers' viewports

- `usePresenceState` holds every peer's last `viewport` op in a `createStateStore` store
  (`@liveworkspace/workbench/lib/state-store`), and hands the room its `set` in place of a state
  setter. `useFollowMe` reads the followed peer's entry through `useStoreSlice`, so a viewport from
  anyone else selects the same value and renders nothing; the Focus Here press reads the whole map
  from the store when it runs. Held by `useFollowMe.test.tsx` ("renders for the followed peer's
  viewport alone"): a hundred viewports from a peer not followed, no render.

### Peers' laser trails

- `usePresenceState` holds every peer's laser trail in a `createStateStore` store, and hands the
  presence coalescer its `set`. `usePresenceRows` joins it with the local trail and the presence
  rows through `mapStore` (`@liveworkspace/workbench/lib/state-store`), made again only when those
  render inputs change, so `laserTrails` reaches the canvas as a store. `ZoomedLaserOverlay`
  (`view-readers.tsx`) is the one reader (`useSyncExternalStore`). Held by
  `usePresenceRows.test.tsx` ("renders nothing for a peer's laser trail"): fifty trail frames, no
  render of the hook that owns the rows, and every frame reaches a subscriber.

### At rest

- The still-canvas rule is held in a real browser by `e2e/canvas-still.spec.ts`: on a seeded board,
  whiteboard and diagram, with a selection's toolbar showing, it counts animation-frame requests
  over a still second (none), after checking the counter saw the board load. And by the probe's
  idle row.

### The long-task log

- `useCanvasLongTaskLog()` in `Canvas`: when `debugScopeOn('canvas-perf')` holds (`debug-log.ts`:
  the same per-page decision `debugLog` makes) and
  `PerformanceObserver.supportedEntryTypes` includes `longtask`, it observes and, per entry,
  calls `debugLog('[canvas-perf] long task', { ms, gesture: canvasGestureNow() })`. Otherwise it
  registers nothing.

### The reference board

- `buildReferenceBoard(seed = REFERENCE_SEED, count = REFERENCE_COUNT)`: a `mulberry32` PRNG;
  elements by the spec's mix, made with the `@livediagram/document` factories, placed over
  `REFERENCE_AREA`; every element but the arrows is placed first, then each arrow is a
  `createPinnedArrow` from a random shape to one of its `ARROW_NEIGHBOURS` (3) nearest shapes by
  centre, as real diagrams join neighbours; paths are closed
  with a fill on odd indexes. Ids are `ref-<n>`; the same seed yields the same board, byte for
  byte.

### The probe

- A Playwright project `perf` (`testMatch: /perf\/.*\.perf\.ts/`), opt-in with `E2E_PERF=1` and
  ignored by `chromium`; `pnpm perf:canvas` runs it against the e2e stack. Its pure parts
  (`reference-board.ts`, `budget.ts`, `trace-tasks.ts`) have unit tests beside them, which the
  editor app's Vitest runs: it excludes only `e2e/**/*.spec.ts`.
- It seeds one document per series (`whiteboard`: a tab opening in Draw mode; `diagram`), each the reference board, through
  the api, and opens it as its owner at 1440 × 900, dark, the CPU throttled 4× before load.
- **Open** (`openBoard`): `REPEATS` (5) opens per tab, each in a fresh browser context; the row is
  `medianOfRuns` of the five. The gesture rows run on the last one. Before load, an init script
  records `longtask` and `long-animation-frame` entries (`{ start, end }`, buffered) into one
  list. After the board's first element shows, the probe polls every `OPEN_POLL_MS` (1,000) until
  `interactiveMs` reports a quiet window that has actually elapsed (`now - quietFrom ≥
OPEN_QUIET_MS`), up to `OPEN_SETTLE_TIMEOUT_MS` (60,000; a harness error past it). Only then
  does it call `dismissQuickTour`, press Escape and `v`. `interactiveMs(from, busy)` is pure
  (`interactive.ts`): from the tab's GET response, the start of the first `OPEN_QUIET_MS` gap
  between busy intervals (sorted by start, overlaps merged), as an offset from `from`.
- Each zoom starts from Shift+1 (fit, centring the board); 100% then presses Mod+0 (a bare `0` is
  the eraser). A screenshot per tab and zoom goes with the report. After an undo the probe waits
  1 s, so its commit lands outside the next gesture's window.
- Each gesture is a step (`setup`, `act`, `reset`, so every run starts alike: a select starts
  deselected, a drag and a stroke are undone, a pan and a zoom put the view back) and runs
  `REPEATS` (5) times untraced. A run's longest task comes from the page's own long-task entries
  (`timed`: entries ending after the run began), which count only the board's renderer; a drag's
  median frame from an in-page `requestAnimationFrame` recorder. `medianOfRuns` (`budget.ts`)
  makes the row: each metric the median of the runs. One more run is traced for attribution
  (`traces/<tab>-<zoom>-<gesture>.json.gz`) and not counted.
- The idle row runs `REPEATS` traced 2 s windows; its work is the sum of the renderer main
  thread's `RunTask` durations (`trace-tasks.ts`; compositor and raster threads are not counted, nor
  a task whose only work is a script with no URL: the probe's own Playwright evaluations at the
  window's edges, which read 20 ms each on a hosted runner),
  the median of the five. Measured values are shown rounded up; a longest task of 0 (no
  long-task entry: the browser reports none under 50 ms) is shown as `< 50 ms`.
- Before anything else it calibrates (`calibrate.ts`): `benchmarkInPage` (a fixed DOM, layout, JS
  and JSON workload, its median of seven runs) on five fresh blank pages, unthrottled; the fastest
  is the machine's speed (D70). `calibratedThrottle(benchMs)` gives
  `rate = TARGET_SLOWDOWN × REFERENCE_BENCH_MS / benchMs`, or `1` with `slowerThanTarget` when that
  is under 1. The report opens with the throttle, the benchmark and the reference;
  `calibration.json` keeps them.
- For each tab and each zoom (fit, 100%), with `Emulation.setCPUThrottlingRate` at the calibrated
  rate, it runs:
  open, idle (2 s), pan (30 wheel ticks), zoom (16 Ctrl-wheel ticks), select, drag (30 moves),
  deselect, marquee (25 moves), stroke (30 moves; the pen on the whiteboard, the pencil on the
  diagram), hover (40 moves).
- The probe never sends `Profiler.start`: the trace categories are `devtools.timeline` and
  `disabled-by-default-devtools.timeline` only. Starting V8's profiler makes source positions
  available for every compiled function in one main-thread task (about 1.1 s at 4× on a
  658-element board), which would land in the first gesture's window.
- `evaluateBudget(measurements)` maps them onto the budget rules; `budgetTable(rows)` renders
  markdown. Written to `test-results/perf/canvas-perf.md` and `.json`; traces to
  `test-results/perf/traces/`.
- A budget miss never fails the test; a harness error (seeding, the stack, a missing element)
  does.

### The nightly run

- The root `.github/workflows/canvas-perf.yml`: `schedule` at `30 2 * * *` (D67) and `workflow_dispatch`; permissions
  `contents: read`, `issues: write`, `actions: read`; one run at a time, with one job per product (livediagram's among them).
- `../packages/e2e-kit/src/perf/nightly.mjs previous`, run from `apps/editor`, prints the head SHA of the last successful run of this
  workflow on `main` (the REST API, `GITHUB_API_URL`). On a scheduled run that SHA equals
  `github.sha` → the summary says nothing is new and every later step is skipped.
- Otherwise: Playwright's container image, `pnpm install`, a check that the workflow's image matches the locked
  Playwright version, `next build` of
  `apps/editor`, `pnpm --filter @livediagram/editor perf:canvas`, then `nightly.mjs report livediagram`, and the
  `test-results/perf` folder (report, gzipped traces, screenshots) uploaded as `canvas-perf-livediagram` with
  `retention-days: 14`.
- `nightly.mjs report` writes the table to `$GITHUB_STEP_SUMMARY`, finds the open issue titled
  `Canvas performance budget: livediagram` (by title; no label), and acts on `budgetIssueAction`
  (`budget-report.ts`): a miss opens it or comments on it, an all-pass run comments "Back within
  budget at <sha>" and closes it. `budgetIssueComment` carries the table,
  `git log --oneline <previous-sha>..<sha>` and the run's link.
- `onMain` is `GITHUB_REF === 'refs/heads/main'`. A run started by hand on another branch
  (`gh workflow run canvas-perf.yml --ref <branch>`) writes the same job summary and artefact, and
  `budgetIssueAction` returns `none`, so the issue and its baseline stay `main`'s. The run logs
  `[canvas-perf] <misses> of <rows> over budget on <ref>; issue: <action>`.

## Interfaces and contracts

```ts
// ../packages/workbench/src/lib/canvas-gesture.ts
export type CanvasGesture =
  'pan' | 'zoom' | 'move' | 'resize' | 'reshape' | 'marquee' | 'stroke' | 'erase';
export type CanvasGestureState = CanvasGesture | 'idle';
export const ELEMENT_GESTURES: ReadonlySet<CanvasGesture>;
export const WHEEL_SETTLE_MS = 150;
export function beginCanvasGesture(kind: CanvasGesture): () => void;
export function canvasGestureNow(): CanvasGestureState;
export function useCanvasGesture(): CanvasGestureState;
export function selectionMoving(gesture: CanvasGestureState): boolean;
export function resetCanvasGesturesForTests(): void;

// apps/editor/hooks/canvas/drag-gesture.ts
export function gestureOfDrag(drag: DragState): CanvasGesture;
export function dragWaitsToEngage(drag: DragState): boolean;

// ../packages/element-model/src/element-grid.ts
export const ELEMENT_GRID_CELL = 256;
export const ELEMENT_GRID_MAX_CELLS = 64;
export type ElementGrid;
export function buildElementGrid(elements: readonly Element[]): ElementGrid;
export function updateElementGrid(grid: ElementGrid, next: readonly Element[]): ElementGrid;
export function queryElementGrid(grid: ElementGrid, rect: Rect): Element[];
export function elementGridFor(elements: readonly Element[]): ElementGrid;
export function createElementGridTracker(): { gridFor(elements: readonly Element[]): ElementGrid };

// packages/document/src/arrow-behind.ts
export function routeBehindQueryRect(from: Point, to: Point): Rect;

// apps/editor/components/canvas/arrow-view-frame.ts
export type ArrowViewFrame = ReturnType<typeof deriveArrowViewFrame>;
export function sameArrowViewFrame(a: ArrowViewFrame, b: ArrowViewFrame): boolean;
export function sameRects(a: readonly Rect[], b: readonly Rect[]): boolean;
export function arrowViewGeometry(
  arrow: ArrowElement, elementIndex: ElementIndex, grid: ElementGrid,
): { frame: ArrowViewFrame; holes: Rect[] };

// ../packages/workbench/src/components/canvas/CanvasZoomContext.tsx
export function CanvasZoomProvider(props: { zoom: number; children: ReactNode }): ReactElement;
export function useCanvasZoom(): number;
export function CounterScaled(props: ComponentProps<'div'>): ReactElement;

// apps/editor/components/canvas/element-layer-props.ts
export function idBound<T>(make: (id: string) => T): (id: string) => T;
export function useStableCollab(collab: CollabApi): CollabApi;

// apps/editor/hooks/canvas/useSettledElements.ts
export const MAP_REDRAW_MIN_MS = 250;
export function useSettledElements(elements: Element[]): Element[];

// apps/editor/hooks/canvas/useEdgeAwarePlacement.ts
export function useEdgeAwarePlacement(
  bounds: Bounds, canvasOffset: XY, zoom: number, gap: number, suspended?: boolean,
): { ref; placeAbove: boolean; style: CSSProperties };

// ../packages/workbench/src/hooks/canvas/useCanvasClientOrigin.ts
export function useCanvasClientOrigin(
  wrapperRef: RefObject<HTMLElement | null>, active: boolean, viewKey: string,
): ClientOrigin | null;

// ../packages/workbench/src/lib/debug-log.ts
export function debugScopeOn(scope: string): boolean;

// ../packages/e2e-kit/src/perf/budget.ts (each editor names its tabs: Measurement<'whiteboard' | 'diagram'>)
export type Measurement<Tab extends string = string> = {
  tab: Tab; zoom: 'fit' | '100%'; gesture: Gesture;
  longestTaskMs: number; medianFrameMs?: number; idleWorkMs?: number; openMs?: number;
};
export type BudgetRow<Tab extends string = string> = Measurement<Tab> & { rule: string; measured: string; pass: boolean };
export function evaluateBudget<Tab extends string>(m: readonly Measurement<Tab>[]): BudgetRow<Tab>[];
export function budgetTable(rows: readonly BudgetRow<string>[]): string;

// ../packages/e2e-kit/src/perf/budget-report.ts
export function budgetIssueTitle(product: string): string; // 'Canvas performance budget: livediagram'
export function budgetIssueAction(run: { misses: number; issueOpen: boolean; onMain: boolean }): 'open' | 'comment' | 'close' | 'none';
export function budgetIssueComment(report: BudgetIssueReport): string;
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

| Spec rule                                        | Test                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A still canvas does nothing                      | `e2e/canvas-still.spec.ts`: no frame requested over a still second; probe idle row                                                                                                                                                                                                                                          |
| An observer never notifies itself                | `useQuickStylePlacement.test.tsx` (shipped)                                                                                                                                                                                                                                                                                 |
| A pan or zoom moves the canvas, not its elements | `CanvasElementsLayer.renders.test.tsx`: re-render with the same inputs renders no view; a zoom renders zoom consumers only                                                                                                                                                                                                  |
| No layout read in a gesture frame                | `useEdgeAwarePlacement.test.tsx`: no measure while suspended, one on resume                                                                                                                                                                                                                                                 |
| Selection chrome hidden while moving             | `CanvasSelectionToolbars.test.tsx`: stale under `move`, `resize`, `reshape`                                                                                                                                                                                                                                                 |
| The Map redraws when a gesture ends              | `useSettledElements.test.tsx`: frozen, released, throttled, trailing; `Minimap.test.tsx`: held mid-move                                                                                                                                                                                                                     |
| An update that changes nothing renders nothing   | `useDocumentHistory.test.ts`: a tick that maps to the same tabs returns the same history                                                                                                                                                                                                                                    |
| Questions about neighbours ask the index         | `element-grid.test.ts`; `arrow-behind.test.ts`: grid candidates give the same holes                                                                                                                                                                                                                                         |
| Whole-board passes linear and once               | `useArrowLabelLayouts.hook.test.tsx`: `draftLayout` stable across element changes                                                                                                                                                                                                                                           |
| The canvas's cursor stays off the elements       | `CanvasElementsLayer.renders.test.tsx`: every element (boxed and arrow) sits in the one element plane; `app/canvas-motion.test.ts`: `globals.css` keeps the plane's `cursor: auto`                                                                                                                                          |
| A move re-renders what moved                     | `CanvasElementsLayer.renders.test.tsx`: moving one element renders it; a preview frame renders no layer; `useLayerDragPreview.test.ts`; `useSnapGuideState.test.ts`: a guide set tells its readers only on a change; `element-layer-props.collab.test.tsx`                                                                  |
| Gesture store semantics                          | `canvas-gesture.test.ts`                                                                                                                                                                                                                                                                                                    |
| Reference board deterministic, mix as specced    | `reference-board.test.ts`                                                                                                                                                                                                                                                                                                   |
| Budget evaluation and table                      | `budget.test.ts` (e2e-kit)                                                                                                                                                                                                                                                                                                  |
| Opening counts every long frame                  | `interactive.test.ts`: tasks and frames merged, overlaps, a gap of exactly 500 ms, nothing after the response                                                                                                                                                                                                               |
| Adding many elements animates nothing            | `CanvasArrivalContext.test.tsx` (workbench): a commit adding more than `ARRIVAL_BURST` elements mounts them arrived, a handful still pop, the context value keeps its identity                                                                                                                                              |
| A closed panel draws nothing of the board        | `useLayerThumbnails.test.ts`: disabled, no renderer pass and the one empty value; enabled again, the previews are drawn                                                                                                                                                                                                     |
| Opening animates nothing across the board        | `canvas-motion.test.tsx`: arriving elements do not pop and arm no timer, later ones pop; `canvas-motion.test.ts`: the fade rule omits the world                                                                                                                                                                             |
| Timings come from the trace, never a profiler    | `canvas-gestures.ts` (e2e-kit): its CDP session sends no `Profiler.*` command                                                                                                                                                                                                                                               |
| Nothing shown over the page restyles the editor  | `useBodyEndAnchor.test.tsx` (workbench): the anchor stays last as an overlay comes and goes, and leaves with the editor                                                                                                                                                                                                     |
| A press on the canvas selects no text            | `useNoCanvasTextSelection.test.tsx` (workbench): cancelled on the board, left alone in editors, fields and `select-text`                                                                                                                                                                                                    |
| A sweep adds and removes no element              | `MarqueeRect.test.tsx` (workbench): one node through a sweep, hidden between                                                                                                                                                                                                                                                |
| The budget holds                                 | The nightly probe                                                                                                                                                                                                                                                                                                           |
| Dragging a very large selection                  | `drag-affected-arrows.perf.test.ts` (CPU time); `CanvasElementsLayer.renders.test.tsx` (no element renders, 1,770 elements); `drag-ride-dom.test.ts` (a plane carries the move); `e2e/perf/large-selection-drag.perf.ts` (script and frame, by hand); `e2e/drag-live.spec.ts` (a collaborator sees a 250-element move live) |
| A busy canvas eases the canvas, not its parts    | `tab-style-ease.test.ts` (workbench); `canvas-motion.test.ts`: the parts' transition is gated on `:not([data-canvas-busy])` and `Canvas` sets it                                                                                                                                                                            |

## Constants and configuration

| Constant                             | Value        | Provenance                                         | Safe range                       |
| ------------------------------------ | ------------ | -------------------------------------------------- | -------------------------------- |
| `WHEEL_SETTLE_MS`                    | 150          | D62                                                | 100–300                          |
| `MAP_REDRAW_MIN_MS`                  | 250          | Spec                                               | Spec-fixed                       |
| `ELEMENT_GRID_CELL`                  | 256          | D63                                                | 128–1024                         |
| `ELEMENT_GRID_MAX_CELLS`             | 64           | D64                                                | 16–1024                          |
| `REFERENCE_SEED`                     | 1            | D65                                                | Any integer                      |
| `REFERENCE_COUNT`                    | 1000         | Spec                                               | Spec-fixed                       |
| `REFERENCE_AREA`                     | 5760 × 2700  | Spec: four 1440 px screens wide, three 900 px high | Spec-fixed                       |
| `TARGET_SLOWDOWN`                    | 4            | Spec                                               | Spec-fixed                       |
| `REFERENCE_BENCH_MS`                 | 13.6         | Measured on the reference machine, quiet (D70)     | Re-measured only with the budget |
| `LONG_TASK_MS`                       | 50           | Spec                                               | Spec-fixed                       |
| `DRAG_MEDIAN_FRAME_MS`               | 33           | Spec                                               | Spec-fixed                       |
| `SELECT_TASK_MS`                     | 100          | Spec                                               | Spec-fixed                       |
| `OPEN_INTERACTIVE_MS`                | 3000         | Spec                                               | Spec-fixed                       |
| `OPEN_QUIET_MS`                      | 500          | D68                                                | Spec-fixed with D68              |
| `OPEN_POLL_MS`                       | 1000         | D80                                                | 250–2000                         |
| `OPEN_SETTLE_TIMEOUT_MS`             | 60000        | D80                                                | 30000–120000                     |
| `IDLE_WORK_MS`                       | 5            | D66                                                | 0–16                             |
| `schedule.cron` (`canvas-perf.yml`)  | `30 2 * * *` | D67                                                | Any off-peak time                |
| `retention-days` (`canvas-perf.yml`) | 14           | Spec                                               | Spec-fixed                       |
| `BUSY_CANVAS_ELEMENTS`               | 20           | Spec (D129: measured eased restyle per element)    | 10–60                            |

## Defaults ledger

Rows D62 to D68, D70 and D80 in [DEFAULTS.md](DEFAULTS.md).
