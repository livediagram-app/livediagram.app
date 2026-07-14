# 84 — Multi-point line / polygon tool

A click-to-place vertex tool that fills the geometry gap between the Pencil (freehand only) and the fixed shape kinds: clean irregular regions (zones on an architecture diagram, floor plans, highlighted areas) and straight multi-segment polylines.

## Model

A committed polygon **is a `FreehandElement`** — normalised `points`, `closed` flag, everything inherited (selection, resize, rotate, lock, layers, theming via `strokeColor`/`fillColor`, history, sync, export, eraser). No new element type and no new fields: a polygon is just a freehand whose points happen to be sparse straight-line vertices.

One rendering nuance: freehand paths are smoothed through `catmullRomToBezierPath`, which would round off deliberate corners. Both renderers (canvas `FreehandSvg`, headless `svgFreehandShape`) therefore render **straight `M/L` segments when the element has ≤ some vertex-count heuristic?** No — heuristics drift. Instead the element carries one new optional field:

```ts
straightEdges?: boolean; // true = render M/L segments, no Catmull-Rom smoothing
```

Set by this tool at commit; absent on pencil/highlighter strokes. The headless renderer already draws straight segments for all freehands, so only the canvas renderer branches on it. Wire validation accepts the optional boolean.

## Gesture

- New tile `tools:polygon` in the shared catalogue (Tools section, after the Pencil/Highlighter cluster). New `PendingDraw` intent `{ type: 'polygon' }`. No single-letter shortcut.
- **Click** places a vertex. After the first vertex, a preview polyline follows the cursor (rubber-band segment from the last vertex, plus the placed segments).
- **Click near the first vertex** (≤ 12px screen-space, with a visual snap ring on the start vertex when in range) closes the loop: commits a `closed: true` freehand, which takes the theme fill like any closed freehand.
- **Double-click / Enter** commits the open polyline (`closed: false`, stroke only) ending at the last placed vertex.
- **Escape** cancels the in-progress polygon if any vertices are placed; a second Escape (or Escape with none placed) disarms the tool, matching the draw-mode conventions.
- **Backspace** removes the last placed vertex (stays armed).
- Banner copy: "Click to place points — click the start to close, double-click to finish". Mobile taps behave as clicks; the banner keeps the shorter mobile copy convention.
- A minimum of 2 vertices is required to commit an open line, 3 to close; anything less on finish is a cancel, not a degenerate element.

Commit runs through `createFreehand(vertices, closed)` (no RDP simplification — the user placed exactly the vertices they want), spreads theme colours the same way the pencil does (fill only when closed), selects the new element, and pushes one history entry.

## Telemetry

`track('Element', 'Added', 'Polygon')` for closed commits, `track('Element', 'Added', 'Polyline')` for open ones.
