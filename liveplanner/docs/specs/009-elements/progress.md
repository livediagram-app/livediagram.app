# Progress elements

Two canvas elements for showing a 0–100 percentage: a **horizontal progress bar** and a **donut progress ring**. In liveplanner they are model kinds: no Plan surface places one, and one arrives with a tab (an import, a paste). They behave like any other shape (move, resize, colour, copy, theme), the element menu sets them, and every export draws them; the canvas has no face for them, so one shows as an empty box with its selection ring ([Elements](README.md)).

## Model

They are `ShapeElement`s with the `ShapeKind`s `'progress-bar'` and `'progress-ring'` (grouped by the `isProgressShape` helper in `packages/project`). Two fields back them:

- `progress?: number`: the filled percentage, clamped to 0–100, default **50**. Set from the element's context menu.
- `progressAnim?: ProgressAnim`: `'fill' | 'pulse' | 'stripes'` (unset = a static fill). Animates **how the filled portion behaves**:
  - **Fill** grows the fill from 0 up to the set value (bar: a `scaleX` reveal; ring: a `stroke-dashoffset` draw keyed off `--lvd-progress`). By default it plays **once and holds** the filled state (`animation-fill-mode: forwards`) rather than looping: a dropped progress element animates in and stays done.
  - **Pulse** breathes the fill's opacity.
  - **Stripes** runs a barber-pole / marching pattern over the fill (bar: an animated `repeating-linear-gradient`; ring: a marching dashed arc masked to the progress sweep).
- `progressAnimSpeed?: AnimationSpeed`: the shared `slowest | slow | normal | fast` set ([Canvas and palette](../008-canvas/canvas-and-palette.md)), the same duration multiplier (`ANIMATION_SPEED_FACTOR`) every element's own animation uses, fed to the `lvd-prog-*` keyframes as `--lvd-prog-speed`. Undefined = slow (`DEFAULT_ANIMATION_SPEED`).
- `progressAnimRepeat?: boolean`: whether the animation loops. Undefined defaults per kind: **fill plays once**, **pulse / stripes loop** (they are continuous by nature). Exposed inline to the keyframes as `--lvd-prog-iter` (`1` or `infinite`).

`createShape` (in `packages/project/src/shape-factory.ts`, re-exported from `factories.ts`) seeds both at `progress: 50` **and `progressAnim: 'fill'`**, so a new bar / ring fills in on arrival; the ring is `aspectLocked` on create so it stays circular. Default sizes: bar 220×44 (a wide pill), ring 130×130.

## Rendering

The export renderer (`svg-render-body.ts`, colours from `progress-colours.ts`) draws the two kinds:

- **Bar**: an HTML track (the element's **fill** colour, fully rounded) with an inner fill (the element's **stroke/accent** colour) sized to `progress%`.
- **Ring**: an SVG track circle plus a progress arc (`pathLength={100}`, `stroke-dasharray="<pct> 100"`, round cap, starting at 12 o'clock).
- Both render a centred **percentage label** and therefore **suppress the standard editable element label**.

Colours map to the existing controls: the **fill colour** is the track, the **stroke colour** is the filled portion. A track with no fill of its own follows the paper the element is drawn on: a pale slate (`#e2e8f0`) on light paper, the dark-ink shape fill on dark paper (a dark canvas, or a page with a dark fill), in every export.

### The percentage stays legible

The bar's percentage sits across the filled portion and the track, so one ink cannot be trusted to read on both. The label's ink is chosen **per part**: over the filled portion it is the element's text colour lifted or deepened until it meets **4.5:1** (WCAG AA) against the stroke colour, and over the track the same against the track (`progressLabelInks`). When both parts want the same ink the bar draws one label; otherwise it draws two, each clipped to its part, so a label that straddles the edge changes ink exactly where the fill ends. The export clips with a nested `<svg>` viewport per part, which every SVG / PNG / PDF consumer honours. The ring's label sits in the hole, over the paper, so it keeps the element's text colour. An animation freezes on export, like every element animation, at its resting frame (the static fill).

### The percentage's size

The bar's percentage is a fixed **14 px** readout: the bar's height is free, and its label sits across the fill. The ring's percentage **scales with the ring**: a **fifth of its diameter** (the box's shorter side, as the ring is drawn), in whole px, never below **14 px** so a small ring stays readable and never above **64 px** so a poster-sized ring keeps a readout rather than a headline. A fifth leaves "100%" inside the hole. The default 130 px ring reads at 26 px, a 180 px ring at 36 px. The element's text size does not change it (the ring sizes its own label, like the bar). The canvas and every export (SVG, PNG, PDF) draw the same size, from one helper (`progressRingLabelPx` in `@liveworkspace/model-core/progress-label`), at weight 600 with tabular numerals.

## Context menu

A **Progress** section inside the menu's **Tools** flyout (only for progress shapes; they are excluded from the **Shape** morph grid, which would drop the `progress` field) offers:

- a **Percentage** slider (0–100, mirrors the Opacity row).

The fill's animation is the **Progress** section of the menu's **Animation** row
([Animated elements](../008-canvas/canvas-and-palette.md#animated-elements)):

- **Fill animation** tiles: None / Fill / Pulse / Stripes (live miniatures of a progress bar, `ProgressAnimPreview`); once an animation is picked, a **Speed** row (Slowest / Slow / Normal / Fast) and a **Repeat** toggle appear beneath it.

Setters `setProgressSelected` / `setProgressAnimSelected` / `setProgressAnimSpeedSelected` / `setProgressAnimRepeatSelected` (`useDataShapeSetters`, exposed through `useElementStyle`) apply to every selected progress shape; changes emit `track('Element', 'Changed', 'Progress' | 'ProgressAnim')`.
