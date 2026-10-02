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

A single selection click ran one 794 ms task that was almost all native time with little app code;
the cause is unconfirmed (first-interaction compile work is a candidate) and needs its own trace.

## Fixed already

- The Quick Style panel's placement re-ran every frame at rest (its `ResizeObserver` re-observed
  each pass and re-notified itself): about 600 passes per 5 s idle, each a document-wide query and a
  forced layout. Fixed in #277; frames painted in the same scripted pan went from 179 to 343.

## Not tried

- `contain` / `content-visibility` on element wrappers, level of detail at low zoom, a raster
  snapshot of still elements during a gesture, and fewer SVG roots. Each is weighed in the spec.
