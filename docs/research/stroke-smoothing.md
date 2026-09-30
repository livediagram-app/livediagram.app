# Real-time stroke smoothing for the pen

Research into smoothing a fixed-width freehand stroke **live**, so the line seen mid-stroke is the line that lands. No product code changed. Checked on 2026-09-30 against the sources listed in [Sources](#sources); the numbers in [Measurements](#measurements) come from seeded synthetic traces run offline on that date.

## The problem

- A pen stroke must feel like ink: the line stays glued to the pen tip, never wobbles, keeps intended corners and cusps, reads well as handwriting, and does not change shape when the pen lifts.
- Input differs wildly: a mouse (integer pixels, 60 to 1000 Hz), a finger (noisy centroid, 60 to 120 Hz), a stylus (Apple Pencil samples at up to 240 Hz, per Apple's `coalescedTouches` docs; Surface Pen and Wacom similar), at any canvas zoom.
- Every smoothing method trades three things against each other: **lag** (distance from the pen tip to the drawn head), **wobble** (noise left in the line) and **shape fidelity** (corners cut, small loops shrunk).
- What the code does today:
  - `useCanvasDrawGesture.ts` appends one sample per `pointermove` (no `getCoalescedEvents()`), copies the whole array on every sample (`[...buffer, point]`, quadratic over a stroke), reads `getBoundingClientRect()` on every move (a possible forced layout) and pushes the array through React once per frame.
  - Commit d6c48132a made the live preview run the commit smoothing every frame: RDP over the **whole** stroke at 1.2 screen px, then `catmullRomToBezierPath`.
  - That smoothing is not prefix-stable: RDP chooses its kept points from the endpoints inwards, so a new sample can change which old points survive. On a handwriting trace, 92 of 298 frames changed kept points more than 40 samples behind the pen ([Measurements](#measurements)). Earlier ink visibly shimmers while drawing.
  - `catmullRomToBezierPath` is **uniform** Catmull-Rom (knot alpha 0; the comment's "alpha = 0.5" is the tangent tension, not the centripetal parameter). On RDP's unevenly spaced output it overshoots up to 2.1 px on handwriting, against 1.1 px for centripetal. That overshoot is the wobble and the little loops at cusps.

## Techniques

Latency is the smoother's own added delay; CPU is per sample unless stated.

### Filters on the input stream

| Technique                                                                                          | How it works                                                                                                                                                                             | Latency cost                                                                                                                     | Quality                                                                                                                       | CPU                                                     |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **EMA / streamline** (perfect-freehand, tldraw, Excalidraw)                                        | Each output moves a fixed fraction `t` towards the new sample. perfect-freehand maps `streamline` s to `t = 0.15 + 0.85(1 - s)`.                                                         | Per **sample**, so it depends on the input rate: at 1000 px/s, streamline 0.5 lags 12 px at 60 Hz and 3 px at 240 Hz.            | Good noise removal; shrinks loops and cuts corners in proportion to lag.                                                      | O(1)                                                    |
| **Lazy brush / pulled string** (lazy-brush, Lazy Nezumi "Pulled String", Krita stabiliser "Delay") | The brush moves only when the pointer leaves a dead-zone radius r; it then follows by `distance - r`. Optional friction.                                                                 | Constant r pixels behind the pointer, at every speed.                                                                            | Very straight lines, deliberate sharp corners for slow work; cuts every corner by about r; kills small handwriting.           | O(1)                                                    |
| **Moving average / stabiliser** (Procreate Stabilisation, Krita Stabilizer, Lazy Nezumi MA)        | Averages the last N samples; Krita and Procreate make N speed-dependent.                                                                                                                 | Half the window.                                                                                                                 | Smooth, rounds corners ("soft corners" per Lazy Nezumi).                                                                      | O(N)                                                    |
| **1 Euro filter** (Casiez et al., CHI 2012)                                                        | First-order low-pass whose cutoff rises with speed: `fc = minCutoff + beta * speed`. Time-based, so rate-independent. Chrome uses it on Android input.                                   | Low at speed, higher when slow; with minCutoff 3 Hz and beta 0.1 (screen px units) about 1.3 to 2 px.                            | Best causal trade-off measured; still shrinks loops and cuts corners.                                                         | O(1)                                                    |
| **Kalman / alpha-beta**                                                                            | Estimates position and velocity (plus acceleration) from a motion model; alpha-beta is the fixed-gain form.                                                                              | As a causal smoother it lags like a low-pass. Its strength is **prediction**; run as a fixed-lag smoother it becomes zero-phase. | Excellent predictor (ink-stroke-modeler's `KalmanPredictor`).                                                                 | O(1) small matrices                                     |
| **Spring-mass model** (Google ink-stroke-modeler)                                                  | A pen mass on a zero-length spring pulled along the upsampled input, with drag; a speed-blended moving average removes slow wobble; the stroke "catches up" at lift.                     | Lags, hidden by a stroke-end or Kalman predictor.                                                                                | Designed for handwriting; results are **append-only** (earlier output never changes); favours pretty curves over exact input. | Upsamples to at least 180 Hz; several steps per sample. |
| **Zero-phase fixed-lag smoothing** (centred window)                                                | Smooth each sample with a symmetric window of past **and** later samples; the newest samples stay provisional until the window has passed them; the drawn head is the raw latest sample. | **None at the head.** The last few milliseconds of ink ("wet tail") settle by under a pixel.                                     | Least wobble per unit of corner cut; no lag-induced shrink.                                                                   | O(window)                                               |

### Curve fitting and simplification

| Technique                                                       | How it works                                                                                                                                         | Latency                                               | Quality                                                                                                                              | CPU                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **Catmull-Rom, uniform** (today)                                | Cubic through every point; tangent from neighbours, knots evenly spaced.                                                                             | Segment i is final once point i+2 exists.             | Overshoots and forms cusps or loops where spacing is uneven (Yuksel et al.).                                                         | O(1) per segment                 |
| **Catmull-Rom, centripetal** (alpha 0.5)                        | Knot spacing is the square root of chord length.                                                                                                     | Same locality.                                        | Proven to have no cusps or self-intersections within a segment; tracks the control polygon tightly. The right default.               | O(1), two `sqrt`                 |
| **Catmull-Rom, chordal** (alpha 1)                              | Knots at chord length.                                                                                                                               | Same.                                                 | Wanders further from the points than centripetal.                                                                                    | O(1)                             |
| **Quadratic midpoint** (Excalidraw's outline)                   | Quadratic from midpoint to midpoint with the sample as control point.                                                                                | Segment final once the next point exists.             | C1, very local; does not pass through samples, so it trims corners (a 90 degree corner by roughly a fifth of the neighbour spacing). | O(1)                             |
| **Uniform cubic B-spline** (Apple PencilKit's stored form)      | Samples are control points, the curve approximates them.                                                                                             | Local, 4 points.                                      | Smoothest (C2); rounds corners unless points are repeated.                                                                           | O(1)                             |
| **Schneider fitting** (Graphics Gems 1990; Paper.js `simplify`) | Least-squares cubic with chord-length parameters, up to 4 Newton reparameterisations, split at the worst point when the error stays above tolerance. | Global; a streaming form refits only the open window. | Fewest Beziers for a given error; ideal for storage and editing, not needed for display.                                             | O(n) per fit, iterative          |
| **RDP** (today)                                                 | Keep the farthest point from the chord if over tolerance, recurse.                                                                                   | Global, **not prefix-stable**.                        | Error-bounded, keeps corner samples.                                                                                                 | O(n log n) typical, O(n^2) worst |
| **Visvalingam-Whyatt**                                          | Repeatedly drop the point with the smallest triangle area (min-heap).                                                                                | Global.                                               | Nicer cartographic results; no benefit for ink.                                                                                      | O(n log n)                       |
| **Streaming (greedy) error-bounded simplification**             | From the last kept point, extend while every intermediate point stays within tolerance of the chord; else keep the previous point.                   | Decisions never revisited.                            | Near-RDP result on smoothed input; corner samples survive because deviation jumps there.                                             | O(window)                        |

## What the leading apps and libraries do

- **tldraw** uses its fork of perfect-freehand. For a solid (fixed-width) line: `thinning: 0`, `smoothing: 0.62`, `streamline` 0.64 to 0.74 by stroke width (0.62 with a real pen); `last` only once complete, so the end snaps to the final input on release. It reads `getCoalescedEvents()` except on iOS, where it found the method sometimes missing (it is secure-context only, so plain-HTTP local testing on iPad never has it).
- **Excalidraw** feeds perfect-freehand (default streamline 0.5, "precise" 0.2) for variable width, and for constant width uses `@excalidraw/laser-pointer` (MIT): an EMA `streamline` (default 0.45) plus RDP. Outlines render as quadratic midpoint curves.
- **perfect-freehand** (MIT) is an outline generator for pressure-varying width; its centreline smoothing is only the per-sample EMA above, and it re-processes the whole array on every call.
- **Microsoft Windows Ink / Whiteboard**: `InkDrawingAttributes.FitToCurve` (UWP, default true) renders strokes as fitted Beziers, and `GetRenderingSegments` returns the Bezier approximation; WPF's `FitToCurve` defaults to false. Whiteboard's "ink beautification" is a cloud recogniser (Microsoft Ink Recognizer) connected experience, not live smoothing.
- **Apple PencilKit** stores a stroke as uniform cubic B-spline control points (`PKStrokePath`). UIKit exposes coalesced touches (up to 240 Hz) and predicted touches, to be appended "only temporarily" and dropped on the next event.
- **Google Ink / Jetpack Ink** renders the wet stroke front-buffered (`GLFrontBufferRenderer`) and uses the motion-prediction library (`MotionEventPredictor`) for temporary predicted points. Its smoothing began as ink-stroke-modeler (Apache-2.0: wobble smoother, spring model, stroke-end or Kalman predictor, append-only output) and "has since migrated to a newer input-smoothing implementation", not publicly documented.
- **Procreate** has three per-brush controls: StreamLine (wobble smoothing), Stabilisation (moving average, stronger the faster you draw) and Motion Filtering (removes wobble extremes; "Expression" restores character).
- **Krita** offers none, basic, weighted (distance, stroke ending) and a stabiliser (sample counts at max and min speed, a "Delay" dead zone for sharp corners, finish line), each with optional **scalable distance** that follows zoom.
- **Concepts** has a smoothing slider per tool (100% gives straight lines). **GoodNotes** has per-pen "Stroke Stabilization" for small shakes. **Figma** applies "some basic smoothing" to Pencil paths. **Miro** documents no smoothing; its Visio export redraws pen strokes as short straight lines. **Paper** (WeTransfer): no public technical documentation found, so not assessed.
- **Pattern**: whiteboard and note apps smooth lightly and invisibly; illustration apps expose strong, laggy stabilisers as an opt-in. The native platforms solve lag with coalesced samples, prediction and front-buffer or compositor rendering, not with heavier filters.

## Latency tricks on the web

- **`getCoalescedEvents()`**: every hardware sample between frames. Chrome 58, Firefox 59, Safari and iPadOS 18.2; secure contexts only. Adds fidelity, not speed. Fall back to `[event]`.
- **`getPredictedEvents()`**: the browser's own forecast, Baseline since Safari 18.2 (Chrome 77, Firefox 89). Draw it in the tail only and discard it on the next event.
- **Frame alignment**: Chrome dispatches `pointermove` just before `requestAnimationFrame`, so updating the path inside the handler costs no extra frame. `pointerrawupdate` (Chrome, Firefox; not Safari) fires sooner but rendering still waits for the frame.
- **Direct DOM writes**: set the preview path's `d` from the handler, not through React state.
- **Chunked paths**: changing `d` makes the browser re-parse and re-rasterise the whole path, so freeze finished ink into fixed chunk paths and rewrite only the last chunk and the tail.
- **`desynchronized: true` canvas** (2D or WebGL, Chromium) bypasses the compositor queue. It needs a canvas preview whose antialiasing differs slightly from the committed SVG, so it is a later option.
- **Delegated ink trail** (`navigator.ink.requestPresenter`, Chrome 94, Edge 93; not Safari or Firefox) has the OS compositor draw a round trail of a given colour and **diameter** from the last rendered point to the live pen position. That suits a fixed-width pen exactly.
- **Safari on iPad**: Pencil hardware samples reach the page only through coalesced events (18.2+). Whether ProMotion iPads run the page at 120 Hz by default was **not verified**. The design must therefore work on timestamps, whatever the frame and input rates.

## Measurements

Seeded synthetic traces in screen px: straight line, circle R = 8 px (a handwriting loop), V corners of 90, 45 and 20 degrees with the realistic slow-down near the vertex, a handwriting-like curve. Noise is white (sigma 0.3 to 1.5 px) and, where marked, 10 Hz tremor of 1 px.

| Method                           | Lag px, 120 Hz, 600 px/s | Wobble RMS, white 0.5 | Wobble, white 1.5 | Wobble, tremor | Loop radius error | Corner cut 90 / 45 / 20 deg |
| -------------------------------- | ------------------------ | --------------------- | ----------------- | -------------- | ----------------- | --------------------------- |
| Raw samples                      | 0                        | 0.53                  | 1.60              | 0.75           | +0.07             | 0.72 / 0.83 / 0.78          |
| EMA streamline 0.5               | 3.75                     | 0.35                  | 1.04              | 0.62           | -0.70             | 1.70 / 2.08 / 2.14          |
| 1 Euro 3 Hz, beta 0.1            | 1.73                     | 0.37                  | 1.20              | 0.65           | -0.54             | 1.29 / 1.53 / 1.58          |
| **Centred, sigma 8 ms**          | **0**                    | 0.30                  | 0.91              | 0.63           | -0.52             | 1.38 / 1.57 / 1.59          |
| Centred, sigma 12 ms, cap 1.5 px | 0                        | 0.38                  | 1.16              | 0.69           | -0.08             | 1.15 / 1.75 / 1.91          |
| Centred, sigma 20 ms             | 0                        | 0.20                  | 0.60              | 0.33           | -3.01             | 4.08 / 5.27 / 5.59          |

- Lazy brush, radius 4 px: lag 3.9 px at every speed and rate, loop radius error -1.8 px, corner cut 3.5 / 5.2 / 5.4 px.
- EMA lag scales with the frame interval: at 1000 px/s, streamline 0.5 lags 12.2 / 6.2 / 3.1 px at 60 / 120 / 240 Hz.
- Wet tail of the centred smoother (handwriting, 240 Hz input, 120 Hz frames): a drawn point later moves at most 0.84 px (p95 0.51 px) at sigma 8 ms, and is frozen 24 ms after it was sampled.
- Whole-stroke RDP per frame: 92 of 298 frames changed old kept points.
- Catmull-Rom on RDP(1.2) output, max distance from the input: uniform 2.10 px, centripetal 1.12 px, chordal 2.40 px (handwriting).
- Cost of one whole-stroke RDP + path rebuild (desktop, Bun): 0.015 ms at 500 samples, 0.10 ms at 2 000, 0.42 ms at 5 000, 2.1 ms at 10 000. It grows faster than linear, and an iPad is slower.

## Recommendation

Build a small, pure, **incremental fixed-lag smoother** in `packages/document`. There are no new dependencies and the stored data model stays points. Its three properties:

1. **Zero lag at the head**: the drawn line always ends exactly on the latest sample (plus an optional one-frame prediction).
2. **Zero-phase smoothing behind it**: no lag-induced loop shrink or corner cutting of the kind causal filters cause.
3. **A stable prefix with a short wet tail**: anything older than 3 sigma never changes again, and the committed stroke is the pipeline's own final output, so release causes no jump.

Why not the alternatives:

- perfect-freehand is an outline tool, and its EMA is rate-dependent.
- The 1 Euro filter is the best causal choice but still lags and shrinks loops.
- ink-stroke-modeler (Apache-2.0) is the strongest off-the-shelf option. It favours pretty over exact, needs physics tuning, and its only TypeScript port (WhiteboardCX, Apache-2.0) is a few weeks old with 3 stars. It is worth an A/B test later, not a foundation now.

### Pipeline

All parameters are in **screen px and milliseconds**. The stroke is processed in screen space and converted to canvas coordinates (divided by the zoom) only at output. Zoom is constant within a stroke (a pinch discards it), so every parameter scales with zoom automatically. A stroke drawn at 400% is smoothed as finely as it looks.

1. **Capture**
   - On `pointerdown`: set pointer capture, cache the wrapper rect and zoom once, and pick the parameter set by `pointerType`.
   - On each `pointermove`, take `getCoalescedEvents()` (fallback `[e]`) with each event's `timeStamp`.
   - Drop samples closer than `MIN_SAMPLE_PX` to the previous one or with a non-increasing time.
   - Append to a growable typed buffer, never copying the array.
   - On `pointerup`, append the final position if it moved.
2. **Smooth (fixed-lag, zero-phase)**
   - Sample i becomes a Gaussian-weighted mean over samples within `h = min(3 * sigma, t_i - t_first, t_last - t_i)`, where `sigma = min(SMOOTH_SIGMA_MS, SMOOTH_CAP_PX / localSpeed)`.
   - `localSpeed` is the chord over samples i-2..i+2 divided by their time span.
   - The ends are pinned: the first and the latest samples are drawn raw.
   - Sample i is **frozen** once a sample with `t >= t_i + 3 * SMOOTH_SIGMA_MS` exists; frozen smoothed points are appended to the committed list and never recomputed.
   - A pause needs no special case: samples more than 3 sigma apart in time never mix, so a pen that stops at a corner keeps it.
3. **Simplify (streaming, greedy)**
   - Frozen points enter an error-bounded greedy simplifier: tolerance `SIMPLIFY_TOL_PX`, chord length capped at `MAX_CHORD_PX`.
   - Kept decisions are final.
   - The wet tail is simplified by the same routine on a scratch copy each frame. The last preview frame and the commit therefore run identical code on identical input.
4. **Fit (centripetal Catmull-Rom with corners)**
   - Split the kept points into runs at **corners**: a kept point whose turning angle between the incoming and outgoing chords is at least `CORNER_TURN_DEG`. Handwriting retrace cusps (150 to 180 degrees) and drawn box corners stay sharp; smooth loops down to about 1.5 px radius do not qualify at these tolerances.
   - Render each run as an open centripetal Catmull-Rom converted to cubic Beziers, with phantom end points `2p0 - p1`.
   - This replaces the uniform formula inside `catmullRomToBezierPath`, so the canvas renderer and the SVG export stay one function.
   - Segment i is final when kept point i+2 is final.
5. **Render (preview)**
   - An SVG `<g>` holds frozen chunk paths (`CHUNK_SEGMENTS` Bezier segments each, never rewritten), one live path (the open chunk, the wet tail and a straight segment to the raw head), and, for a pen, one optional predicted segment.
   - All paths are written directly via refs inside the input handler.
   - Colour, width (`penWidth * zoom`), round caps and joins match the committed element.
   - A translucent highlighter puts its opacity and blend mode on the `<g>`, so overlapping chunk caps never double the alpha.
6. **Commit**
   - `onCommitFreehand` receives the pipeline's final kept points, converted to canvas coordinates, instead of raw samples.
   - Close-to-fill, shape recognition and the whiteboard pinch discard read the same points.
   - It never re-simplifies with different parameters or a different zoom.
7. **Enhance later (progressive)**
   - The delegated ink trail on Chromium pens: diameter = `penWidth * zoom`, colour = ink, start point = the last rendered raw event.
   - A desynchronised canvas preview only if measured latency still disappoints.

### Parameters (starting values, tune with recorded traces)

| Constant                    | Pen   | Mouse | Touch | Safe range  | Provenance                                                       |
| --------------------------- | ----- | ----- | ----- | ----------- | ---------------------------------------------------------------- |
| `SMOOTH_SIGMA_MS`           | 6     | 8     | 12    | 4 to 16     | 8 ms matched EMA 0.5 wobble at zero lag; finger noise needs more |
| `SMOOTH_CAP_PX`             | 1.5   | 1.5   | 2.5   | 1 to 3      | cap kept loop error near 0.1 px at speed                         |
| Wet tail (derived, 3 sigma) | 18 ms | 24 ms | 36 ms | under 50 ms | max tail movement under 1 px                                     |
| `MIN_SAMPLE_PX`             | 0.25  | 0.5   | 0.5   | 0 to 1      | drops duplicates and sub-pixel jitter                            |
| `SIMPLIFY_TOL_PX`           | 0.35  | 0.5   | 0.6   | 0.25 to 1.0 | smoothing is done upstream, so simplification only compacts      |
| `MAX_CHORD_PX`              | 48    | 48    | 48    | 24 to 96    | bounds tangent error on fast straight runs                       |
| `CORNER_TURN_DEG`           | 100   | 100   | 110   | 80 to 135   | above loop turning at the tolerance (about 66 degrees at R 3 px) |
| `PREDICT_MS`                | 8     | 0     | 0     | 0 to 16     | one 120 Hz frame; a finger hides the tip anyway                  |
| `PREDICT_MAX_PX`            | 12    | 0     | 0     | 0 to 24     | clamps overshoot whiskers at sudden stops                        |
| `CHUNK_SEGMENTS`            | 64    | 64    | 64    | 32 to 256   | bounds `d` re-rasterisation per frame                            |

### Performance budget per frame

- Frame at 120 Hz: 8.3 ms, most of it the browser's. Stroke work: **at most 1 ms p95 on an iPad, 0.3 ms on a desktop**, independent of stroke length.
- Per frame: 2 to 4 new samples (240 Hz input), each smoothed over about 12 neighbours; a streaming simplifier over its open window; a few new Bezier segments; string work only for the open chunk and tail; 2 or 3 `setAttribute('d')` calls on short paths.
- Nothing per frame is O(stroke length): no whole-array copies, no layout reads, no React render of the stroke.

### Test plan

- **Unit tests** (Vitest, seeded synthetic traces, each under 10 ms), in `packages/document`:
  - Lag: without prediction, the preview head equals the latest sample exactly.
  - Prefix stability (property test over random traces): each frame's frozen points and frozen path string are a prefix of the next frame's.
  - No jump: the final preview path string equals the committed element's rendered path for the same points.
  - Rate independence: one trajectory sampled at 60, 120 and 240 Hz gives curves within 0.5 px (Hausdorff).
  - Wobble: line with 0.5 px noise has RMS at most 0.35 px; 1 px tremor at most 0.65 px.
  - Loops: R 8 px circle at 400 px/s keeps radius error within 0.6 px.
  - Corners: V at 90, 45 and 20 degrees keeps corner cut within 1.5 px; a 180 degree cusp renders with a tangent break (no loop).
  - Zoom: one screen trace at zoom 0.5, 1 and 2 yields canvas points scaled by exactly 1/zoom.
  - Catmull-Rom: centripetal output never leaves the kept polyline by more than the tolerance-derived bound on the handwriting fixture.
- **Replay fixtures**: a dev-only recorder saves `{x, y, t, pointerType, zoom}` JSON from real iPad Pencil, Surface Pen, mouse and finger sessions (handwriting "minimum", digits, a box, a star, fast scribbles). Replays render dark-mode SVG snapshots for visual review and feed the unit metrics.
- **Performance**: a Vitest bench replays a 10 000-sample stroke and asserts p95 per-frame cost. On devices, a dev overlay logs handler time and `requestAnimationFrame` intervals (this also settles the unverified 120 Hz question on iPad). A Chrome trace must show no forced layout inside `pointermove`.
- **End to end** (Playwright, Chromium and WebKit): synthetic pointer paths show the preview `d` updating every frame and the committed element matching the last preview.
- **Perceived lag on hardware**: film the pen at 240 fps slow motion while drawing at a steady speed. Lag in ms is (tip to ink-head distance) / speed. Compare before and after, with and without prediction and the ink trail.

## Open decisions

- Switching `catmullRomToBezierPath` to centripetal with corner splitting also re-renders **existing** freehand strokes slightly differently, mostly less overshoot. The alternatives are a per-element version flag or accepting the change.
- Whether the Shape Pen and the highlighter share the pen pipeline (recommended, for one behaviour), or keep the RDP-only path for recognition input.

## Licences

- Recommended implementation: our own code, MIT with the repository. No dependency needed.
- If adopted instead:
  - perfect-freehand: MIT.
  - lazy-brush: MIT.
  - @excalidraw/laser-pointer: MIT.
  - Paper.js (Schneider fitter): MIT.
  - simplify-js: BSD-2-Clause.
  - 1eurofilter (npm): BSD-3-Clause.
  - Graphics Gems `FitCurves.c`: permissive EULA (use in any product, no credit required).
  - Google ink-stroke-modeler and the ink-stroke-modeler-ts port: Apache-2.0, compatible with an MIT codebase when the licence and NOTICE travel with it. Any adopted package appears on `/licences` through `packages/licences`.

## Sources

- perfect-freehand README: https://raw.githubusercontent.com/steveruizok/perfect-freehand/main/packages/perfect-freehand/README.md
- perfect-freehand `getStrokePoints`: https://raw.githubusercontent.com/steveruizok/perfect-freehand/main/packages/perfect-freehand/src/getStrokePoints.ts
- perfect-freehand constants: https://raw.githubusercontent.com/steveruizok/perfect-freehand/main/packages/perfect-freehand/src/constants.ts
- perfect-freehand licence: https://raw.githubusercontent.com/steveruizok/perfect-freehand/main/LICENSE
- lazy-brush README: https://raw.githubusercontent.com/dulnan/lazy-brush/master/README.md
- 1 Euro filter page: https://gery.casiez.net/1euro/
- 1 Euro filter TypeScript: https://raw.githubusercontent.com/casiez/OneEuroFilter/main/typescript/src/OneEuroFilter.ts
- Krita freehand brush smoothing: https://docs.krita.org/en/reference_manual/tools/freehand_brush.html
- Lazy Nezumi Pro: https://lazynezumi.com/
- Procreate brush studio settings: https://help.procreate.com/procreate/handbook/brushes/brush-studio-settings
- Ink Stroke Modeler README: https://raw.githubusercontent.com/google/ink-stroke-modeler/main/README.md
- Ink Stroke Modeler params: https://raw.githubusercontent.com/google/ink-stroke-modeler/main/ink_stroke_modeler/params.h
- Ink Stroke Modeler licence: https://raw.githubusercontent.com/google/ink-stroke-modeler/main/LICENSE
- ink-stroke-modeler-ts: https://raw.githubusercontent.com/WhiteboardCX/ink-stroke-modeler-ts/main/README.md
- ink-stroke-modeler-ts licence: https://raw.githubusercontent.com/WhiteboardCX/ink-stroke-modeler-ts/main/LICENSE
- Google Ink: https://raw.githubusercontent.com/google/ink/main/README.md
- Android advanced stylus features: https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/advanced-stylus-features
- Jetpack Ink API: https://developer.android.com/develop/ui/compose/touch-input/stylus-input/about-ink-api
- Centripetal Catmull-Rom: https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline
- Yuksel, Schaefer, Keyser, Parameterization of Catmull-Rom Curves: https://www.cemyuksel.com/research/catmullrom_param/
- Schneider `FitCurves.c`: https://raw.githubusercontent.com/erich666/GraphicsGems/master/gems/FitCurves.c
- Graphics Gems licence: https://raw.githubusercontent.com/erich666/GraphicsGems/master/LICENSE.md
- Paper.js `PathFitter`: https://raw.githubusercontent.com/paperjs/paper.js/develop/src/path/PathFitter.js
- RDP: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
- Visvalingam line simplification: https://bost.ocks.org/mike/simplify/
- Alpha-beta filter: https://en.wikipedia.org/wiki/Alpha_beta_filter
- tldraw draw options: https://raw.githubusercontent.com/tldraw/tldraw/main/packages/tldraw/src/lib/shapes/draw/getPath.ts
- tldraw coalesced events: https://raw.githubusercontent.com/tldraw/tldraw/main/packages/editor/src/lib/hooks/useCanvasEvents.ts
- tldraw environment notes: https://raw.githubusercontent.com/tldraw/tldraw/main/apps/docs/content/sdk-features/environment.mdx
- Excalidraw freedraw: https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/shape.ts
- @excalidraw/laser-pointer: https://registry.npmjs.org/@excalidraw/laser-pointer/latest
- MDN `getCoalescedEvents()`: https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents
- MDN `getPredictedEvents()`: https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getPredictedEvents
- Browser compat data, PointerEvent: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/PointerEvent.json
- Browser compat data, Ink: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Ink.json
- WebKit in Safari 18.2: https://webkit.org/blog/16301/webkit-features-in-safari-18-2/
- Pointer Events spec: https://w3c.github.io/pointerevents/
- Chrome aligned input events: https://developer.chrome.com/blog/aligning-input-events
- Chrome desynchronized canvas: https://developer.chrome.com/blog/desynchronized
- Ink API (delegated ink trail): https://wicg.github.io/ink-enhancement/
- UIKit predicted touches: https://developer.apple.com/documentation/uikit/uievent/predictedtouches(for:)
- UIKit coalesced touches: https://developer.apple.com/documentation/uikit/uievent/coalescedtouches(for:)
- PencilKit `PKStrokePath`: https://developer.apple.com/documentation/pencilkit/pkstrokepath-swift.struct
- Windows `FitToCurve` (UWP): https://learn.microsoft.com/en-us/uwp/api/windows.ui.input.inking.inkdrawingattributes.fittocurve
- WPF `FitToCurve`: https://learn.microsoft.com/en-us/dotnet/api/system.windows.ink.drawingattributes.fittocurve
- `InkStroke.GetRenderingSegments`: https://learn.microsoft.com/en-us/uwp/api/windows.ui.input.inking.inkstroke.getrenderingsegments
- Whiteboard ink beautification: https://learn.microsoft.com/en-us/answers/questions/2320167/how-can-i-get-the-ink-beautification-features-work
- Concepts manual: https://concepts.app/en/manual
- GoodNotes pen tool: https://support.goodnotes.com/hc/en-us/articles/7353756785679-Write-and-customize-ink-with-the-Pen-tool
- Figma toolbar (Pencil smoothing): https://help.figma.com/hc/en-us/articles/360041064174-Access-design-tools-from-the-toolbar
- Figma pencil tool: https://help.figma.com/hc/en-us/articles/4402723791511-Sketch-on-the-canvas-with-the-pencil-tool
- Miro pen: https://help.miro.com/hc/en-us/articles/360017730573-Pen
- Miro Visio export: https://help.miro.com/hc/en-us/articles/37623598174354-Export-Miro-diagrams-to-Visio
