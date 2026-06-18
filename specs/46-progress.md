# 46. Progress elements

Two canvas elements for showing a 0–100 percentage: a **horizontal progress bar** and a **donut progress ring**. They're added from the floating palette's **Tools** tab (captions "Progress" and "Donut") and behave like any other shape (move, resize, colour, group, copy, format-paint, theme).

## Model

They are `ShapeElement`s with new `ShapeKind`s `'progress-bar'` and `'progress-ring'` (grouped by the `isProgressShape` helper in `packages/diagram`). Two fields back them:

- `progress?: number` — the filled percentage, clamped to 0–100, default **50**. Set from the element's context menu.
- `progressAnim?: ProgressAnim` — `'fill' | 'pulse' | 'stripes'` (unset = a static fill). Animates **how the filled portion behaves**:
  - **Fill** grows the fill from 0 up to the set value (bar: a `scaleX` reveal; ring: a `stroke-dashoffset` draw keyed off `--lvd-progress`). By default it plays **once and holds** the filled state (`animation-fill-mode: forwards`) rather than looping — a dropped progress element animates in and stays done.
  - **Pulse** breathes the fill's opacity.
  - **Stripes** runs a barber-pole / marching pattern over the fill (bar: an animated `repeating-linear-gradient`; ring: a marching dashed arc masked to the progress sweep).
- `progressAnimSpeed?: AnimationSpeed` — `slow | normal | fast`, the same duration multiplier (`ANIMATION_SPEED_FACTOR`) the boxed-element animations use, fed to the `lvd-prog-*` keyframes as `--lvd-prog-speed`. Undefined = normal.
- `progressAnimRepeat?: boolean` — whether the animation loops. Undefined defaults per kind: **fill plays once**, **pulse / stripes loop** (they are continuous by nature). Exposed inline to the keyframes as `--lvd-prog-iter` (`1` or `infinite`).

`createShape` (in `packages/diagram/src/factories.ts`) seeds both at `progress: 50` **and `progressAnim: 'fill'`**, so a freshly dropped bar / ring fills in on arrival; the ring is `aspectLocked` on create so it stays circular. Default sizes: bar 220×44 (a wide pill), ring 130×130.

## Rendering

`ProgressView` (`apps/live/components/ProgressView.tsx`), rendered by `BoxedElementView` for the two kinds (ahead of the generic `ShapeSvgOverlay` branch, which has no case for them):

- **Bar** — an HTML track (the element's **fill** colour, fully rounded) with an inner fill (the element's **stroke/accent** colour) sized to `progress%`.
- **Ring** — an SVG track circle plus a progress arc (`pathLength={100}`, `stroke-dasharray="<pct> 100"`, round cap, starting at 12 o'clock).
- Both render a centred **percentage label** and therefore **suppress the standard editable element label**.

Colours map to the existing controls: the **fill colour** is the track, the **stroke colour** is the filled portion. The `lvd-prog-*` classes (`globals.css`) are pure CSS — **deterministic**, **reduced-motion-safe** (the resting frame is the static fill), and they **freeze on export** like every other element animation.

## Context menu

A **Progress** section (only for progress shapes; they are excluded from the **Shape** morph grid, which would drop the `progress` field) offers:

- a **Percentage** slider (0–100, mirrors the Opacity row), and
- **Fill animation** tiles: None / Fill / Pulse / Stripes (`ProgressAnimKindGlyph`); once an animation is picked, a **Speed** row (Slow / Normal / Fast) and a **Repeat** toggle appear beneath it.

Setters `setProgressSelected` / `setProgressAnimSelected` / `setProgressAnimSpeedSelected` / `setProgressAnimRepeatSelected` (`useElementStyle`) apply to every selected progress shape; changes emit `track('Element', 'Changed', 'Progress' | 'ProgressAnim')`.
