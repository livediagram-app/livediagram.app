# Canvas performance on large boards

Measured 2026-10-02 on a real 658-element whiteboard on staging (277 shapes, 215 arrows, 76
freehand, 74 text, 14 paths, 2 stickies; 164 KB), at the 19% zoom that fits it on screen. The
resulting rules live in [Canvas performance](../specs/008-canvas/canvas-performance.md).

## Method

- A production export of `apps/live` (with `productionBrowserSourceMaps` switched on for the run
  only) pointed at the staging api, served locally; every non-GET api call and the WebSocket were
  stubbed, so the board was never written.
- Headless Chromium, 1440 × 900, dark, the CPU throttled 4× (`Emulation.setCPUThrottlingRate`) to
  stand in for an ordinary laptop.
- Scripted gestures (30 pointer moves 16 ms apart for a drag, 30 wheel ticks for a pan), each under a
  `devtools.timeline` trace and a sampled CPU profile mapped back through the source maps.
- Starting the CPU profiler costs one main-thread task of about 1.1 s at 4× on this page, whatever
  the page is doing (see [The first selection click](#the-first-selection-click)). Timings are
  read from a trace taken without the profiler, or after it has been started once outside any
  measured gesture.

## What the page is

- 658 elements become about 4,500 DOM nodes and about 650 `<svg>` roots: every element is its own
  SVG, and every element is mounted whether on screen or not.
- At fit zoom every element is on screen, so culling off-screen elements would mount none fewer.

## Findings

| Gesture (4× CPU)  | Wall  | Long tasks | Longest | Script | Style + layout | Paint + layerize |
| ----------------- | ----- | ---------- | ------- | ------ | -------------- | ---------------- |
| Drag one shape    | 6.7 s | 30         | 225 ms  | 5.3 s  | 0.87 s         | 0.48 s           |
| Pan (wheel)       | 2.8 s | 9          | 269 ms  | 1.1 s  | 36 ms          | 0.40 s           |
| Zoom (Ctrl+wheel) | 1.8 s | 4          | 195 ms  | 0.67 s | 0.28 s         | 0.12 s           |
| Marquee           | 2.0 s | 2          | 278 ms  | 0.86 s | 35 ms          | 0.11 s           |
| Pen stroke        | 2.1 s | 4          | 180 ms  | 0.39 s | 0.23 s         | 0.24 s           |

Where a drag's time goes (inclusive, of 6.9 s sampled):

1. **The Minimap redraws the whole board on every frame** (1.27 s): `Minimap.tsx` rebuilds the
   full-fidelity markup through the headless renderer (`svgBoxed`, arrows, pen strokes) whenever
   `elements` changes, and the browser re-parses it (0.28 s of HTML parsing).
2. **Selection chrome forces a layout every frame** (0.83 s, most of the 0.87 s of
   `getBoundingClientRect`): `useEdgeAwarePlacement` measures the floating toolbar and selection
   popover in a layout effect as they follow the dragged selection, after the frame's DOM writes.
3. **Arrows that pass behind boxes test every element** (0.67 s): `routeBehindHoles` walks the
   whole board per arrow, so 215 arrows × 658 elements ≈ 141,000 `isBoxed` calls a frame
   (`isBoxed` alone 0.34 s self).
4. **React reconciliation** of the element layer (`propagateParentContextChanges`, `shallowEqual`,
   `BoxedElementView`): a context change walks the tree each frame.

Where a pan's time goes: every `BoxedElementView` re-renders on each wheel tick (0.28 s), though a
pan changes no element; a viewport-dependent prop or context reaches them.

### The first selection click

The first selection click looked like one 0.8 to 1.1 s task of native time with little app code.
It was the probe, not the click: the task is `Profiler.start` itself, which landed in the first
gesture's window because the probe started the profiler per gesture.

- Starting V8's CPU profiler logs every compiled function and makes its source positions available
  (`ProfilingScope` → `LogCompiledFunctions(ensure_source_positions_available = true)` in
  `src/profiler/cpu-profiler.cc`). V8 keeps source positions lazily, so each script is parsed
  again: 4,669 `V8.CollectSourcePositions` and 95 `V8.ParseProgram` events, 1.13 s at 4×,
  in one task with no `EventDispatch` in it. A sampled profile shows it as `(program)`.
- The positions stay collected, so a second start pays only for functions compiled since; hence
  "later clicks are cheaper".
- Traced with an idle 800 ms window first, the idle window carries the 1.13 s task and the click
  after it none of that work.

The click itself, at 4× with no tracing (in-page `longtask` and `event` timing, two runs):

| Click            | Longest task | Event duration |
| ---------------- | ------------ | -------------- |
| First selection  | 77 to 85 ms  | 96 to 112 ms   |
| Second selection | 59 ms        | 80 to 88 ms    |
| Third selection  | 54 to 57 ms  | 72 ms          |

A local export of `main` matches: a 76 ms first click, and a 0.79 to 0.80 s profiler start in
whichever window holds it. The first click is within the 100 ms selection budget; it is about 25 ms dearer than later ones,
partly first-run compilation of the selection chrome (134 `V8.CompileCode`, 13 ms).

## The reference board, first run

Measured 2026-10-02 with the probe (`pnpm perf:canvas`) on the e2e stack, at `main` after the
gesture store, the Map, element view stability and the element grid had landed. The reference board
is 1,000 elements over four screens by three: denser than the staging board above.

- Within budget: opening (1.8 s whiteboard, 2.7 s diagram) and a still canvas (0 ms of
  main-thread work at fit).
- Over budget nearly everywhere else, at both zooms: select and deselect run single tasks of
  270 to 700 ms, a drag's longest task is 340 to 1,000 ms with median frames of 50 to 117 ms, and
  pan, zoom, marquee, stroke and hover each run tasks of 100 to 980 ms.
- At 100% the view holds a few hundred elements, so the spec's "Later" items (culling off-screen
  elements, containment) are now worth weighing; at fit, every element is on screen and only
  per-element cost helps.

## Fixed already

- The Quick Style panel's placement re-ran every frame at rest (its `ResizeObserver` re-observed
  each pass and re-notified itself): about 600 passes per 5 s idle, each a document-wide query and a
  forced layout. Fixed in #277; frames painted in the same scripted pan went from 179 to 343.
- Selection chrome measured itself every drag frame, and so did the canvas guide overlays (#280).
- The Map rebuilt the whole board's markup on every drag frame (#282).
- Six unstable props and the zoom re-rendered every element view on any editor render (#283).
- Every arrow tested every element for its route-behind holes and re-rendered on any element
  change (#285).

The staging board before and after all of it, deployed, at 4× CPU, same scripted gestures (the
first gesture read without the profiler start, see below):

| Gesture (4× CPU) | Before: long tasks, longest, script | After: long tasks, longest, script |
| ---------------- | ----------------------------------- | ---------------------------------- |
| Drag one shape   | 30, 225 ms, 5.3 s                   | 4, 168 ms, 1.5 s                   |
| Pan (wheel)      | 9, 269 ms, 1.1 s                    | 2, 197 ms, 0.34 s                  |
| Zoom             | 4, 195 ms, 0.67 s                   | 6, 249 ms, 0.51 s                  |
| Marquee          | 2, 278 ms, 0.86 s                   | 3, 219 ms, 0.22 s                  |

The budget is still out of reach on both boards; the next measures are in "Not tried" and the
spec's "Later".

## The hosted runner

- A still board read 40-49 ms of work on the nightly runner, 1 ms locally: two URL-less script
  evaluations at the trace window's edges (Playwright's own, about 20 ms each at the runner's
  speed). The probe no longer counts them; re-read from that run's traces, the idle median is
  0.1-1.3 ms. One window held a 456 ms major GC; the five-run median absorbs it.
- A drag reads about twice as slow on the runner as locally. Its longest tasks (350-400 ms) hold
  almost no traced work (at most 40 ms of hit testing and compositor commit): the main thread is
  waiting, most likely on software compositing in a container without a GPU, which the CPU
  calibration does not model. The same empty-task shape showed locally at fit before the Map became
  an image, so part of it is the board's own paint cost.
- The drag row follows the calibrated throttle, not the commit: across five runs the runner's
  benchmark ranged 18-32 ms, so the throttle ranged 1.7-3.0x, and drag read 543-570 ms at 1.68x and
  626-698 ms at 1.9-2.2x. A 100 ms step in drag between two nights is the runner, until a run at a
  similar throttle says otherwise; `calibration.json` in the run's artefact holds the rate.
- Any branch can be measured on the runner by hand (`gh workflow run canvas-perf.yml --ref
<branch>`); the run writes its job summary and leaves the budget issue alone. Runs queue one at a
  time, about 40 minutes each.

## After the drag preview

Measured 2026-10-03 on the reference board, a focused drag probe splitting each run's longest task
into "during the gesture" and "at release", at the reference speed.

- The preview took the app's own per-frame work down to 25-50 ms of script, and the median frame to
  17-33 ms. The longest task did not move: 140-250 ms during the gesture, 150-210 ms at release.
- During the gesture the long tasks are `LayerTreeHost::WaitForCommitCompletion` (150-310 ms): the
  main thread waiting on the compositor. The page has 5 compositor layers; the board is painted in
  one. Without a GPU, headless Chromium composites in software, which rasterises changed tiles inside
  the commit; moving one element dirties tiles dense with paths. Not established on real GPU devices.
- Lifting the dragged boxes onto their own layers (`will-change: transform`) did not help, and a run
  that also lifted the arrows' canvas-sized SVGs crashed the page. An emulated GPU (SwiftShader) was
  no better: it does its GPU work on the CPU.
- At release, ~105 ms is the Map's picture being parsed (`SVGImage::DataChanged`, an
  `IsolatedSVGDocumentHost` for a 1,000-element document) and ~100 ms the commit's script.

## The Map without labels

Measured 2026-10-03 on the reference board. The Map's picture with labels is 417 KB (550 `<text>`,
642 `<tspan>`); without, 305 KB. Chrome parsing and painting it fresh, CPU throttled 4x: 205-217 ms
with labels, 94-110 ms without (a repeated identical data URL is served from the image cache and
reads 25-34 ms either way, which first hid the difference). In the editor, after a drag release, the
longest task fell 111 → 77 ms (whiteboard) and 210 → 151 ms (diagram), and the long-task total 677 →
266 ms and 753 → 519 ms; the machine was busier for the first run, so part of that is noise. The
Map now draws no labels.

## The board lost its identity on whiteboards

Measured 2026-10-03 on the reference board. `createStockColourProjector` returned a fresh array on
every render whenever the board held a colour stored by name, as a whiteboard's pens and stickies
do. Every render (each zoom tick, each marquee frame) then handed a "new" board to everything
downstream: across five zooms the whiteboard's Map redrew 79 to 80 times, and across five marquees 6
times; the diagram board, with no named colours, 0. The arrow frames and the endpoint spread
recomputed with it, which is why they showed in the whiteboard's zoom profile and not the diagram's.
Returning the same array for the same board took the redraws to 0 and the zoom's total long-task
time from 1,702 to 1,630 ms at fit and 2,042 to 1,800 ms at 100% (machine under load, so read the
redraw counts, not the milliseconds). The zoom's longest task did not move: it is the browser
redrawing the board, not script.

## Zoom, marquee and stroke after the Map fixes

Measured 2026-10-03, on the runner unless stated.

- **Zoom** (68-110 ms) is the browser re-rasterising every element at the new scale; script in the
  gesture is small once the board keeps its identity. Two compositor-only remedies, scoped to the
  zoom gesture, measured on the runner (locally they crashed, but so did the unchanged build: swap
  was exhausted, so those crashes said nothing about either):
  - `will-change: transform` on the world: one layer the size of the board, re-rasterised whole;
    zoom 4,463-4,475 ms at fit and 509-531 ms at 100%, against 68-110 ms.
  - `content-visibility: auto` on element wrappers while zooming: the browser toggles rendering on
    every wrapper mid-gesture; 244-311 ms against 68-110 ms.

  Neither ships. What remains is the spec's Later list: level of detail at low zoom, and not
  mounting off-screen elements when zoomed in.

- **Marquee** at fit (61-70 ms): the drag itself costs nothing; the whole task is the release. In a
  local unminified profile (4x): `Canvas`'s own body about 34 ms (two `...props` spreads into
  `CanvasElementsLayer` and `CanvasChrome` about 10 ms of it, the rest the compiler's cache checks),
  the selection toolbar's placement forcing the page's layout about 27 ms, the Quick Style panel's
  one placement a few ms, and reconciling the memoised element views about 12 ms. Placing the
  toolbar and the Quick Style panel in the next frame's `requestAnimationFrame` instead of the
  layout effect moved the layout out of the task: marquee 70 / 61 ms and select 61-68 ms at 2.17x,
  against 67 / 68 ms and 65-73 ms at 1.92x, about 10% once normalised. Not shipped: it does not
  meet the budget, and an edge nudge would land a frame late. The lever left is a selection change
  that does not re-render the editor root.
- **Stroke** (114-130 ms): the release commits the stroke and re-renders the element layer; the Map's
  rebuild follows in its own deferred render. Rendering the Map without `useDeferredValue` read
  142-173 ms, so deferring it stays.
- **Local measuring under memory pressure**: Chromium renderers abort with an `int3` trap in the
  kernel log when an allocation fails. With swap exhausted by other work, a 1,000-element page
  crashed at random points; a 200-element board serves for counts that do not depend on size
  (how often something re-runs), and the runner for timings.

## The selection store

Measured 2026-10-04. Moving the selection out of the canvas's props (a per-editor store, read per
element) stopped the canvas and its element layer rendering for a selection change. Script time on
the reference diagram, unthrottled, alternating `main` and the branch in three rounds of 12:

| Moment   | `main`       | Store        |
| -------- | ------------ | ------------ |
| Select   | 14.2-16.4 ms | 9.1-11.0 ms  |
| Deselect | 6.8-12.6 ms  | 3.5-4.1 ms   |
| Marquee  | 30.3-36.4 ms | 25.1-31.6 ms |

The runner could not show it. Four probe runs of the branch, two on the same commit, read drag at
377-462 ms on three and 633-686 ms on one, against 638-685 ms on `main`. The traces put the
difference in main-thread busy time outside script (about 16 s against 23 s per drag window), so it
is the runner machine's compositor, which the CPU calibration does not model. Read a drag row only
against runs on the same runner, and judge a change in script time by a local A/B, not by the nightly.
What remains in a select's long task is mostly the editor root rendering above the canvas.

## Not tried

- `contain` on element wrappers, a raster snapshot of still elements during a gesture, and fewer
  SVG roots. Each is weighed in the spec.
