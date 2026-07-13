# Isometric view

A fourth **canvas tool** alongside Select / Hand / Laser that renders the
current tab as an **isometric scene with depth** — the flat diagram tilted
onto an isometric plane, each shape extruded into a raised block. It's a way
to _look_ at a diagram (architecture decks, system maps, screenshots), not a
way to edit one.

## What it does

Picking the **Isometric** tool re-projects the canvas content into an
isometric (axonometric, parallel — no perspective) view:

- The whole content layer tilts onto the isometric plane, so the diagram
  reads as a surface seen from above and to the side.
- Each **boxed element** (shapes, tables, images, stickies, link
  cards, annotations) gains **extruded depth** — a solid raised
  block standing off the floor — so the scene looks three-dimensional. The
  block's side walls paint in the **element's own colour** (its accent),
  shaded darker toward the floor, rather than a flat black slab.
  **Frames are one exception**: a frame is a section backdrop, not a solid
  block, so it gets no extrusion column and instead settles **just below
  the base plane** (a -1px translateZ via the `[data-iso] [data-frame]`
  rule) — its big surface would otherwise be exactly coplanar with the
  contents drawn over it, and coplanar 3D layers z-fight (flicker) while
  the camera orbits. **Plain text elements are another**: text draws with
  no background on the flat canvas, so an extrusion column would conjure a
  solid slab behind bare words (the wall-colour fallback). Text stays flat
  on the base plane. **Icon shapes are the third** — line-art glyphs and
  Technology / infra marks alike read as flat markers, like text: a raised
  slab under a glyph turns every icon into an anonymous block and buries
  the artwork, so they stay flat too. All three exemptions live in one
  shared predicate (`isoExtrudes`, `lib/isometric.ts`) consumed by the
  on-screen `IsometricDepthLayer` AND both image exporters, so screen and
  export can't drift.
- **Arrows, freehand strokes, and labels** stay on the base plane (they have
  no box to extrude); they ride the tilt with everything else.

It reuses the existing element rendering wholesale — the same shapes, fonts,
themes, multi-colour tints, SVG shape outlines, and images you see in 2D,
just projected. Nothing is re-drawn in a lower-fidelity form.

## It's a view, not an editor

Isometric is **navigation-only**, modelled on the Hand tool:

- **Dragging pans** the scene, exactly like Hand. Scroll / pinch still zoom.
- **Shift-drag or right-button-drag orbits the camera**: horizontal motion
  spins the view around (azimuth), vertical motion tilts it between edge-on
  and top-down (elevation, clamped so it never goes fully flat or fully
  side-on). A plain right-click (no drag) still opens the context menu; only
  a right-drag orbits and swallows that menu. The
  angle is local, non-synced view state (it opens at the default isometric
  angle and keeps whatever angle you orbit to for the session) — it stays a
  parallel (isometric) projection throughout, never a perspective camera.
- **An orbit button in the zoom bar** offers the same orbit without a held
  modifier: while the isometric tool is active an orbit-icon button appears in
  the bottom-right zoom controls, **after the zoom buttons (before the Zen
  toggle when that shows)**.
  Click-dragging it runs the identical orbit drag (same azimuth / elevation
  deltas, reusing `useIsometricCamera.startOrbit`), and a plain **click**
  (a press released without dragging) snaps the camera back to the default
  isometric angle (`useIsometricCamera.reset`). It only mounts in isometric
  view and disappears on any other tool.
- **No selecting, dragging, resizing, marquee, or editing** while it's
  active — the content layer is non-interactive (like Spotlight, spec/09),
  so there's no reverse hit-testing to get wrong. To edit, switch back to
  Select. **Escape** exits the view to the default editing tool — Select on
  desktop, Hand (pan) on touch viewports where Select isn't the default
  (mirrors how Spotlight reverts to Select).
- It is **purely a view state**: it changes nothing about the diagram, never
  persists to the server, and is **not synced** to other participants — each
  viewer tilts independently (same contract as Zen mode, spec/26).

Available to everyone, including view-only visitors (looking is read-only).

## How it's toggled

- **Tool dropdown** in the palette (its own isometric-cube icon).
  The picker is grouped with menu dividers — editing tools (Select / Hand /
  Eraser), then presenter tools (Laser / Spotlight), then Isometric on its
  own at the end. Selecting it switches the cursor mode the same way Select /
  Hand / Laser do.
- **Keyboard:** `I` selects it (free letter; `S`/`P`/`L` are the other tools,
  `E` eraser, `Z` zen). Obeys the per-device keyboard-shortcuts toggle and the
  text-input / label-edit bailouts so typing `i` into a label never flips the
  mode. Listed in the shortcuts dialog under Tools.
- Switching to any other tool (or `S` for Select) returns to the flat 2D view.

## Telemetry

Selecting the tool emits `Canvas / Used / Isometric` (spec/22) — the same
shape as `Canvas / Used / Laser` and the other distinct-tool selections.
Like Pan / Select, repeated re-selection isn't re-tracked.

## Implementation notes

- `isometric` joins the `CanvasTool` union (`'pan' | 'select' | 'laser' |
'spotlight' | 'eraser' | 'isometric'`). It's a mutually-exclusive cursor
  mode, so it belongs **inside** the tool group, unlike Zen mode which is an
  orthogonal visibility flag.
- The projection math lives in its own helper (`apps/live/lib/isometric.ts`):
  the camera transform builder, elevation clamp, and per-element extrusion
  metrics, kept out of `Canvas.tsx` so the geometry is unit-testable and the
  canvas just consumes it. The orbit-able angle lives in its own hook
  (`useIsometricCamera`). No god-file accretion.
- Rendering: when the tool is active, the existing transformed content
  wrapper (`Canvas.tsx`, the `scale(zoom) translate(offset)` layer) also
  carries the isometric tilt **innermost** (appended after scale/translate so
  it tilts the content first and the pan translate stays in screen space —
  drag-to-pan then moves the scene the way the cursor moves at any camera
  angle). The wrapper is made `pointer-events-none` so no element kind can be
  selected or dragged; pan still works because drag-to-pan is handled on
  `<main>` (and `wantsPan` gains the `isometric` case, like `pan` / `laser`).
  No change to the diagram data model — every element stays 2D
  (`x, y, width, height`) and the view is a pure projection on top.
- The tilt **pivots around the content centre**, not the wrapper centre. The
  rotation fragment is wrapped in `translate(pivot) … translate(-pivot)`
  (`isoTransform` + `isoPivot` in `lib/isometric.ts`), where the pivot is the
  boxed-content bounding-box centre expressed relative to the wrapper centre
  (its `origin-center`). Without this the rotation pivots about the wrapper
  centre, so any diagram whose centre sits away from that point swings
  off-screen the instant the view tilts and again as it orbits; pinning the
  content centre makes the diagram tilt in place and stay centred while
  orbiting. The pivot translates sit inside the tilt fragment, so the pan
  offset (outside it) still pans in screen space.
- Orbit (Shift-drag) is a self-contained drag in `useIsometricCamera` that
  applies incremental azimuth / elevation deltas, taken before the pan branch
  in the `<main>` pointerdown so plain drag still pans.
- The extrusion is drawn by `IsometricDepthLayer` as a `translateZ`-stacked
  column of rectangle copies per boxed element (a deterministic "voxel"
  stack, so there are no rotated wall faces to mis-orient); it paints behind
  the real element layer, which caps each column at z=0. Each column takes the
  element's accent colour (stroke, else fill, else neutral) dimmed toward the
  floor via `filter: brightness()`.
- Each layer in the column is **clipped to the shape's own silhouette** rather
  than the bounding rectangle, so a circle / diamond / cylinder / hexagon
  extrudes as that outline instead of a square block behind it. The clip is
  derived in `isoShapeSilhouette` (`lib/isometric.ts`): polygonal shapes
  (diamond, hexagon, parallelogram, triangle, trapezoid, star) get a
  `clip-path: polygon()` whose percentages are lifted straight from
  `ShapeSvgOverlay`'s `0 0 100 100` viewBox (one geometry source); curved
  shapes use `border-radius` (circle / progress-ring `50%`, stadium a pill,
  cylinder `50% / 12%` elliptical caps). Shapes without an entry and non-shape
  boxed elements (sticky / image / table / …) keep the rounded
  rectangle.

## Isometric export

The Export dialog (spec/07 `ExportTabDialog`) carries an **Isometric view**
iOS-style toggle, **off by default**. When on, the image exports (PNG / SVG /
PDF) tilt the rendered scene into the same isometric projection as the on-canvas
view; JSON / Markdown ignore it. The export applies the projection's 2D affine
(`isoCanvasMatrix` in `lib/isometric.ts` — an in-plane rotation by the azimuth
then a `cos(elevation)` vertical squash, the parallel-projection equivalent of
the on-screen `rotateX·rotateZ`) and sizes the canvas / SVG viewBox to the
projected footprint (`isoProjectBounds`) so nothing clips. Each element also
gets the same **voxel extrusion** the on-screen view paints: a stack of its
silhouette stepped along the projected depth axis (`isoDepthLayers` /
`isoLayerBrightness`), dimmed toward the floor, behind the element body — so the
export reads with depth, not as a flat tilted plane.

## Scope (first cut) and what's deliberately out

- **In:** the projected, extruded read-only view + pan, for the active tab;
  the flat **projected** isometric image export (above).
- **Out (for now):** a faint isometric floor grid behind the content (a nice
  seat for the scene, deferred), editing in isometric, a perspective (true
  vanishing-point) camera, per-element height authoring, and 3D arrows. These
  are noted as possible follow-ups, not part of this spec — full 3D node
  placement remains out of scope (see the view-modes discussion; it would
  need a `z` field in the model and a different renderer).

See also [spec/09](09-canvas-and-palette.md) (the tool row +
shortcuts), [spec/26](26-zen-mode.md) (view-only, non-synced view state), and
[spec/05](05-diagram-structure.md) (the 2D element model this projects).
