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
- Each **boxed element** (shapes, text, tables, images, stickies, link
  cards, annotations, frames) gains **extruded depth** — a solid raised
  block standing off the floor — so the scene looks three-dimensional.
- **Arrows, freehand strokes, and labels** stay on the base plane (they have
  no box to extrude); they ride the tilt with everything else.

It reuses the existing element rendering wholesale — the same shapes, fonts,
themes, multi-colour tints, SVG shape outlines, and images you see in 2D,
just projected. Nothing is re-drawn in a lower-fidelity form.

## It's a view, not an editor

Isometric is **navigation-only**, modelled on the Hand tool:

- **Dragging pans** the scene, exactly like Hand. Scroll / pinch still zoom.
- **No selecting, dragging, resizing, marquee, or editing** while it's
  active — the content layer is non-interactive (like Spotlight, spec/09),
  so there's no reverse hit-testing to get wrong. To edit, switch back to
  Select.
- It is **purely a view state**: it changes nothing about the diagram, never
  persists to the server, and is **not synced** to other participants — each
  viewer tilts independently (same contract as Zen mode, spec/26).

Available to everyone, including view-only visitors (looking is read-only).

## How it's toggled

- **Tool dropdown** in the command palette, sitting directly after Hand in
  the canvas-tool picker (its own isometric-cube icon) since it pans like
  Hand. Selecting it switches the cursor mode the same way Select / Hand /
  Laser do.
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
  the isometric transform string and the per-element extrusion, kept out of
  `Canvas.tsx` so the geometry is unit-testable and the canvas just consumes
  it. No god-file accretion.
- Rendering: when the tool is active, the existing transformed content
  wrapper (`Canvas.tsx`, the `scale(zoom) translate(offset)` layer) also
  carries the isometric tilt, and is made `pointer-events-none` so no element
  kind can be selected or dragged — pan still works because drag-to-pan is
  handled on `<main>` (and `wantsPan` gains the `isometric` case, like
  `pan` / `laser`). Depth is per-boxed-element extrusion applied in that
  layer; no change to the diagram data model — every element stays 2D
  (`x, y, width, height`) and the view is a pure projection on top.
- The extrusion is drawn by `IsometricDepthLayer` as a `translateZ`-stacked
  column of rectangle copies per boxed element (a deterministic "voxel"
  stack, so there are no rotated wall faces to mis-orient); it paints behind
  the real element layer, which caps each column at z=0.

## Scope (first cut) and what's deliberately out

- **In:** the projected, extruded read-only view + pan, for the active tab.
- **Out (for now):** a faint isometric floor grid behind the content (a nice
  seat for the scene, deferred), editing in isometric, a free / orbitable
  camera angle (the tilt is a fixed isometric angle), per-element height
  authoring, and 3D arrows. These are noted as possible follow-ups, not part
  of this spec —
  full 3D node placement remains out of scope (see the view-modes discussion;
  it would need a `z` field in the model and a different renderer).

See also [spec/09](09-canvas-and-command-palette.md) (the tool row +
shortcuts), [spec/26](26-zen-mode.md) (view-only, non-synced view state), and
[spec/05](05-diagram-structure.md) (the 2D element model this projects).
