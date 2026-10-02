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

## Not tried

- `contain` / `content-visibility` on element wrappers, level of detail at low zoom, a raster
  snapshot of still elements during a gesture, and fewer SVG roots. Each is weighed in the spec.
